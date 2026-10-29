"""Current listing-change workload and selected-period administrator decisions."""

from django.db.models import Count, Q

from apps.merchant_operations.business_profile.models import (
    BusinessClassificationChangeRequest,
    BusinessLocationChangeRequest,
    BusinessNameChangeRequest,
)
from apps.shared.analytics.metadata import build_meta

from .attention_queue_service import AttentionQueueService
from .reporting_helpers import summarize_turnaround


class ChangeRequestAnalyticsService:
    """Keep merchant withdrawals separate from administrator decision turnaround."""

    REQUEST_TYPES = (
        ("name", "Business name", BusinessNameChangeRequest, "BNCR"),
        ("classification", "Classification", BusinessClassificationChangeRequest, "BCCR"),
        ("location", "Location", BusinessLocationChangeRequest, "BLCR"),
    )

    @classmethod
    def get_report(
        cls,
        period,
    ):
        """Pool exact duration samples and backlog counts across the three persisted request types."""
        types = []
        all_rows = []
        backlog = dict.fromkeys(
            ("total", "under_1_day", "days_1_to_2", "days_3_plus", "unknown_age"),
            0,
        )
        outcomes = {"approved": 0, "rejected": 0, "withdrawn": 0}
        missing_resolution = 0
        for name, label, model, prefix in cls.REQUEST_TYPES:
            status_field = f"{prefix}_STATUS"
            submitted_field = f"{prefix}_SUBMITTED_AT"
            resolved_field = f"{prefix}_RESOLVED_AT"
            queryset = model.objects.all()
            pending = queryset.filter(**{status_field: model.Status.PENDING})
            aging = AttentionQueueService.age_buckets(
                pending,
                submitted_field,
                period.generated_at,
            )
            window = Q(**{
                f"{resolved_field}__gte": period.start,
                f"{resolved_field}__lt": period.end,
            })
            terminal = (
                model.Status.APPROVED,
                model.Status.REJECTED,
                model.Status.WITHDRAWN,
            )
            expressions = {
                status: Count("pk", filter=window & Q(**{status_field: status}))
                for status in terminal
            }
            counts = queryset.aggregate(
                **expressions,
                missing_resolution_timestamp_count=Count(
                    "pk",
                    filter=Q(**{
                        f"{status_field}__in": terminal,
                        f"{resolved_field}__isnull": True,
                    }),
                ),
            )
            decisions = queryset.filter(
                window,
                **{f"{status_field}__in": (model.Status.APPROVED, model.Status.REJECTED)},
            )
            rows = [
                (submitted_at, resolved_at, True)
                for submitted_at, resolved_at
                in decisions.values_list(submitted_field, resolved_field).iterator()
            ]
            all_rows.extend(rows)
            type_outcomes = {
                status: counts[status]
                for status in terminal
            }
            for field in backlog:
                backlog[field] += aging[field]
            for status in outcomes:
                outcomes[status] += type_outcomes[status]
            missing_resolution += counts["missing_resolution_timestamp_count"]
            types.append({
                "type": name,
                "label": label,
                "backlog": aging,
                "period_outcomes": type_outcomes,
                "turnaround": summarize_turnaround(rows),
                "missing_resolution_timestamp_count": counts["missing_resolution_timestamp_count"],
            })
        return {
            "backlog": backlog,
            "backlog_meta": {
                "measurement_type": "current_snapshot",
                "selected_period_applies": False,
                "as_of": period.generated_at.isoformat(),
                "age_basis": (
                    "Elapsed hours since submitted_at: under 24; 24 to under 72; "
                    "72 or more; missing/future times are unknown."
                ),
            },
            "period_outcomes": outcomes,
            "turnaround": summarize_turnaround(all_rows),
            "types": types,
            "missing_resolution_timestamp_count": missing_resolution,
            "missing_resolution_timestamp_scope": (
                "All current terminal requests across all dates; these cannot be "
                "attributed to a selected period."
            ),
            "definition": (
                "Outcomes use current terminal status and resolved_at in the selected period. "
                "Approved/rejected requests alone contribute elapsed submitted-to-resolved "
                "administrator decision durations; merchant withdrawals never do. Missing "
                "timestamps and negative chronology are excluded from duration samples. "
                "Pooled means/medians use all valid individual samples, not per-type averages. "
                "Backlog is current and includes old pending requests regardless of selected dates."
            ),
            "meta": build_meta(
                period,
                coverage_verified=True,
                data_through=period.end,
                partial_reasons=("current_request_state", "recorded_resolution_timestamps_only"),
            ),
        }
