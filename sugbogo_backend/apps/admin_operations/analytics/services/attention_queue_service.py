"""Report current moderation backlog and recorded completed-dispute turnaround."""

from datetime import timedelta
from statistics import median

from django.db.models import Count, Q

from apps.review_disputes.models import MerchantReviewDispute
from apps.reviews.models import ReviewReport
from apps.shared.analytics.metadata import build_meta


class AttentionQueueService:
    """Keep current pending snapshots distinct from resolution-period measurements."""

    @staticmethod
    def age_buckets(queryset, field, now):
        """Count pending record ages with inclusive 24/72-hour lower boundaries."""
        one_day = now - timedelta(days=1)
        three_days = now - timedelta(days=3)
        return queryset.aggregate(
            total=Count("pk"),
            under_1_day=Count("pk", filter=Q(**{f"{field}__gt": one_day, f"{field}__lte": now})),
            days_1_to_2=Count("pk", filter=Q(**{f"{field}__gt": three_days, f"{field}__lte": one_day})),
            days_3_plus=Count("pk", filter=Q(**{f"{field}__lte": three_days})),
            unknown_age=Count("pk", filter=Q(**{f"{field}__isnull": True}) | Q(**{f"{field}__gt": now})),
        )

    @staticmethod
    def completed_turnaround(period):
        """Calculate median elapsed hours for upheld/dismissed resolutions in the period."""
        # Withdrawals also have resolved_at, but are not completed admin reviews.
        completed = MerchantReviewDispute.objects.filter(MRDSP_STATUS__in=(
            MerchantReviewDispute.DisputeStatus.UPHELD,
            MerchantReviewDispute.DisputeStatus.DISMISSED,
        ))
        selected = completed.filter(
            MRDSP_RESOLVED_AT__gte=period.start, MRDSP_RESOLVED_AT__lt=period.end,
        ).values_list("MRDSP_CREATED_AT", "MRDSP_RESOLVED_AT")
        durations = []
        invalid = 0
        for created_at, resolved_at in selected.iterator():
            if created_at is None or resolved_at < created_at:
                invalid += 1
            else:
                durations.append((resolved_at - created_at).total_seconds() / 3600)
        missing = completed.filter(MRDSP_RESOLVED_AT__isnull=True).count()
        return {
            "median_hours": median(durations) if durations else None,
            "sample_count": len(durations),
            "excluded_invalid_duration_count": invalid,
            "missing_resolution_timestamp_count": missing,
            "missing_timestamp_scope": "Current completed disputes across all dates; missing resolution times cannot be assigned to a period.",
            "measurement_type": "resolution_period_current_state",
            "definition": "Upheld/dismissed disputes resolved within the selected period; elapsed hours from creation, excluding withdrawals.",
        }

    @staticmethod
    def get_report(period):
        """Return aggregate current queues with explicit historical and timestamp limitations."""
        reports = ReviewReport.objects.filter(RREP_STATUS=ReviewReport.ReportStatus.PENDING)
        disputes = MerchantReviewDispute.objects.filter(
            MRDSP_STATUS=MerchantReviewDispute.DisputeStatus.PENDING,
        )
        turnaround = AttentionQueueService.completed_turnaround(period)
        reasons = ["queue_history_unavailable"]
        if turnaround["excluded_invalid_duration_count"] or turnaround["missing_resolution_timestamp_count"]:
            reasons.append("completed_dispute_timestamp_anomalies")
        return {
            "open_reports": AttentionQueueService.age_buckets(reports, "RREP_CREATED_AT", period.generated_at),
            "open_disputes": AttentionQueueService.age_buckets(disputes, "MRDSP_CREATED_AT", period.generated_at),
            "queue_meta": {
                "measurement_type": "current_snapshot",
                "as_of": period.generated_at.isoformat(),
                "selected_period_applies": False,
                "age_basis": "Elapsed hours: under 24; 24 to under 72; 72 or more. Future/missing creation times have unknown age.",
                "history_available": False,
                "report_history": "Partial administrator decision audit exists, but complete report lifecycle/backlog history is not verified. No report resolution timestamp exists.",
                "dispute_history": "Creation/resolution timestamps support recorded turnaround; historical pending queue snapshots are unavailable.",
            },
            "completed_dispute_turnaround": turnaround,
            "turnaround_meta": build_meta(
                period, data_through=period.end, coverage_verified=False,
                partial_reasons=("recorded_resolution_timestamps_only",),
            ),
            "meta": build_meta(
                period, data_through=period.end, coverage_verified=False, partial_reasons=reasons,
            ),
        }
