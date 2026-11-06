"""Scoped workload and daily decisions for the three update-request queues."""

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.db.models import Count, Q
from django.utils import timezone

from apps.merchant_operations.business_profile.models import (
    BusinessClassificationChangeRequest,
    BusinessLocationChangeRequest,
    BusinessNameChangeRequest,
)


REQUEST_MODELS = (
    ("business_name", BusinessNameChangeRequest, "BNCR"),
    ("classification", BusinessClassificationChangeRequest, "BCCR"),
    ("location", BusinessLocationChangeRequest, "BLCR"),
)
AGING_HOURS = 48
REQUEST_TIME_ZONE = ZoneInfo("Asia/Manila")


def decision_day_start(now):
    """Return Philippine midnight for the supplied observation time."""
    return datetime.combine(
        now.astimezone(REQUEST_TIME_ZONE).date(),
        time.min,
        tzinfo=REQUEST_TIME_ZONE,
    )


def filter_metric_queue(
    queryset,
    prefix,
    queue_view,
):
    """Apply card filters before pagination while retaining optimized relations."""
    now = timezone.now()
    if queue_view == "aging":
        return queryset.filter(**{
            f"{prefix}_STATUS": "pending",
            f"{prefix}_SUBMITTED_AT__lte": now - timedelta(hours=AGING_HOURS),
        })
    if queue_view == "resolved_today":
        return queryset.filter(**{
            f"{prefix}_STATUS__in": ("approved", "rejected"),
            f"{prefix}_RESOLVED_AT__gte": decision_day_start(now),
            f"{prefix}_RESOLVED_AT__lte": now,
        })
    return queryset


class UpdateRequestMetricsService:
    """Aggregate full inventories independently of table status and search."""

    @staticmethod
    def get_summary(
        request_type="all",
        business_id=None,
    ):
        """Count scoped pending, aging, and approved/rejected requests today."""
        now = timezone.now()
        cutoff = now - timedelta(hours=AGING_HOURS)
        pending_total = 0
        aging_total = 0
        resolved_total = 0
        oldest = None
        for name, model, prefix in REQUEST_MODELS:
            if request_type not in ("all", name):
                continue
            queryset = model.objects.all()
            if business_id is not None:
                queryset = queryset.filter(BUSN_ID_id=business_id)
            pending = Q(**{f"{prefix}_STATUS": model.Status.PENDING})
            aging = pending & Q(**{f"{prefix}_SUBMITTED_AT__lte": cutoff})
            resolved = Q(**{
                f"{prefix}_STATUS__in": (model.Status.APPROVED, model.Status.REJECTED),
                f"{prefix}_RESOLVED_AT__gte": decision_day_start(now),
                f"{prefix}_RESOLVED_AT__lte": now,
            })
            counts = queryset.aggregate(
                pending=Count(
                    "pk",
                    filter=pending,
                ),
                aging=Count(
                    "pk",
                    filter=aging,
                ),
                resolved=Count(
                    "pk",
                    filter=resolved,
                ),
            )
            pending_total += counts["pending"]
            aging_total += counts["aging"]
            resolved_total += counts["resolved"]
            candidate = (
                queryset.filter(pending)
                .order_by(
                    f"{prefix}_SUBMITTED_AT",
                    "pk",
                )
                .values(
                    "pk",
                    f"{prefix}_SUBMITTED_AT",
                )
                .first()
            )
            if candidate is None:
                continue
            submitted_at = candidate[f"{prefix}_SUBMITTED_AT"]
            if (
                oldest is None
                or submitted_at < oldest["submitted_at"]
            ):
                oldest = {
                    "id": candidate["pk"],
                    "request_type": name,
                    "submitted_at": submitted_at,
                    "seconds": max(
                        0,
                        int((now - submitted_at).total_seconds()),
                    ),
                }
        return {
            "pending": pending_total,
            "aging_requests": aging_total,
            "aging_threshold_hours": AGING_HOURS,
            "oldest_pending": oldest,
            "resolved_today": resolved_total,
            "as_of": now,
            "time_zone": str(REQUEST_TIME_ZONE),
        }
