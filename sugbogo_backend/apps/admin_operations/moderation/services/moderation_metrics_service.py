"""Queue-wide workload, aging, and daily decision metrics for moderation."""

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.db.models import Count, DateTimeField, F, OuterRef, Q, Subquery, Value
from django.db.models.fields.json import KeyTextTransform, KeyTransform
from django.db.models.functions import Cast, Least, NullIf
from django.utils import timezone

from apps.admin_operations.activity_management.models import AdminActivity
from apps.business.models import BusinessVouch
from apps.business.services.vouch_service import VouchService
from apps.review_disputes.models import MerchantReviewDispute
from apps.reviews.models import Review, ReviewReport


AGING_HOURS = 48
METRICS_TIME_ZONE = ZoneInfo("Asia/Manila")


def signal_timestamp(
    field,
    reason,
):
    """Read the recorded detection time without substituting submission time."""
    evidence = KeyTransform(
        reason,
        field,
    )
    observed_at = KeyTextTransform(
        "observed_at",
        evidence,
    )
    return Cast(
        NullIf(
            observed_at,
            Value(""),
        ),
        output_field=DateTimeField(),
    )


def with_queue_time(
    queryset,
    queue,
):
    """Attach the entry time used consistently by metrics and aging filters."""
    if queue == "under-review":
        # Reviews enter the publication hold at creation; retries do not reset age.
        expression = F("REVW_CREATED_AT")
    elif queue == "reported":
        expression = Subquery(
            ReviewReport.objects.filter(
                REVW_ID_id=OuterRef("pk"),
                RREP_STATUS=ReviewReport.ReportStatus.PENDING,
            )
            .order_by(
                "RREP_CREATED_AT",
                "RREP_ID",
            )
            .values("RREP_CREATED_AT")[:1],
        )
    elif queue == "disputes":
        expression = F("MRDSP_CREATED_AT")
    elif queue == "suspicious-reviews":
        timestamps = [
            signal_timestamp(
                "REVW_RELIABILITY_EVIDENCE",
                reason,
            )
            for reason in Review.ReliabilityReason.values
        ]
        expression = Least(*timestamps)
    else:
        expression = signal_timestamp(
            "VOUCH_RELIABILITY_EVIDENCE",
            VouchService.CONCENTRATION_REASON,
        )
    return queryset.annotate(queue_entered_at=expression)


def filter_aging_cases(
    queryset,
    queue,
):
    """Limit a queue to cases waiting at least the configured elapsed hours."""
    return with_queue_time(
        queryset,
        queue,
    ).filter(
        queue_entered_at__lte=timezone.now() - timedelta(hours=AGING_HOURS),
    )


class ModerationMetricsService:
    """Aggregate each active queue independently of pagination and filters."""

    @staticmethod
    def queues(tab):
        """Return canonical unresolved inventories and their selection types."""
        if tab == "under-review":
            queryset = Review.objects.filter(
                REVW_STATUS=Review.ReviewStatus.UNDER_REVIEW,
            )
            return [("under-review", queryset)]
        if tab == "reported":
            queryset = Review.objects.filter(
                reports__RREP_STATUS=ReviewReport.ReportStatus.PENDING,
            ).distinct()
            return [("reported", queryset)]
        if tab == "disputes":
            queryset = MerchantReviewDispute.objects.filter(
                MRDSP_STATUS=MerchantReviewDispute.DisputeStatus.PENDING,
            )
            return [("disputes", queryset)]
        reviews = Review.objects.filter(
            REVW_STATUS=Review.ReviewStatus.PUBLISHED,
        ).exclude(REVW_RELIABILITY_REASONS=[])
        vouches = BusinessVouch.objects.filter(
            VOUCH_FLAG_SUSPICIOUS=True,
        )
        return [
            ("suspicious-reviews", reviews),
            ("suspicious-vouches", vouches),
        ]

    @staticmethod
    def resolved_today(
        tab,
        now,
    ):
        """Count distinct human-decided cases since midnight in the Philippines."""
        if tab == "suspicious":
            return None
        local_today = now.astimezone(METRICS_TIME_ZONE).date()
        start = datetime.combine(
            local_today,
            time.min,
            tzinfo=METRICS_TIME_ZONE,
        )
        if tab == "disputes":
            return MerchantReviewDispute.objects.filter(
                MRDSP_STATUS__in=[
                    MerchantReviewDispute.DisputeStatus.UPHELD,
                    MerchantReviewDispute.DisputeStatus.DISMISSED,
                ],
                MRDSP_RESOLVED_AT__gte=start,
                MRDSP_RESOLVED_AT__lte=now,
            ).count()
        if tab == "under-review":
            actions = [
                AdminActivity.Action.REVIEW_MODERATION_APPROVED,
                AdminActivity.Action.REVIEW_MODERATION_REJECTED,
            ]
        else:
            actions = [
                AdminActivity.Action.REPORTED_REVIEW_KEPT,
                AdminActivity.Action.REPORTED_REVIEW_REJECTED,
                AdminActivity.Action.REVIEW_REPORT_APPROVED,
                AdminActivity.Action.REVIEW_REPORT_REJECTED,
            ]
        return (
            AdminActivity.objects
            .filter(
                AACT_ACTION__in=actions,
                AACT_CREATED_AT__gte=start,
                AACT_CREATED_AT__lte=now,
                AACT_CONTEXT__review_id__isnull=False,
            )
            .order_by()
            .values("AACT_CONTEXT__review_id")
            .distinct()
            .count()
        )

    @staticmethod
    def get_summary(tab):
        """Return workload and recorded ages without counting report siblings twice."""
        now = timezone.now()
        cutoff = now - timedelta(hours=AGING_HOURS)
        pending = 0
        aging = 0
        unknown_age = 0
        oldest = None
        for queue, queryset in ModerationMetricsService.queues(tab):
            timed = with_queue_time(
                queryset,
                queue,
            ).order_by()
            counts = timed.aggregate(
                pending=Count(
                    "pk",
                    distinct=True,
                ),
                aging=Count(
                    "pk",
                    filter=Q(queue_entered_at__lte=cutoff),
                    distinct=True,
                ),
                unknown_age=Count(
                    "pk",
                    filter=Q(queue_entered_at__isnull=True),
                    distinct=True,
                ),
            )
            pending += counts["pending"]
            aging += counts["aging"]
            unknown_age += counts["unknown_age"]
            candidate = (
                timed.filter(queue_entered_at__isnull=False)
                .order_by(
                    "queue_entered_at",
                    "pk",
                )
                .values(
                    "pk",
                    "queue_entered_at",
                )
                .first()
            )
            if (
                candidate is not None
                and (
                    oldest is None
                    or candidate["queue_entered_at"] < oldest["entered_at"]
                )
            ):
                oldest = {
                    "id": candidate["pk"],
                    "queue": queue,
                    "entered_at": candidate["queue_entered_at"],
                    "seconds": max(
                        0,
                        int((now - candidate["queue_entered_at"]).total_seconds()),
                    ),
                }
        return {
            "pending": pending,
            "aging_cases": aging,
            "aging_threshold_hours": AGING_HOURS,
            "unknown_age_count": unknown_age,
            "oldest_pending": oldest,
            "resolved_today": ModerationMetricsService.resolved_today(
                tab,
                now,
            ),
            "time_zone": str(METRICS_TIME_ZONE),
        }
