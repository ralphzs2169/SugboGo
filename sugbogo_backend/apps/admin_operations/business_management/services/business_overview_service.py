"""Focused SQL inventory, additions, and listing-maintenance overview."""

from datetime import UTC, timedelta

from django.db.models import Count, Q
from django.utils import timezone

from apps.admin_operations.dashboard.services import DashboardSummaryService
from apps.business.models import Business
from apps.shared.analytics.date_ranges import MANILA


class BusinessOverviewService:
    """Keep current inventories separate from retained creation-period counts."""

    @staticmethod
    def get_overview():
        """Read five aggregate queries using one captured PHT reporting reference."""
        as_of = timezone.now()
        local_now = as_of.astimezone(MANILA)
        month_start = local_now.replace(
            day=1,
            hour=0,
            minute=0,
            second=0,
            microsecond=0,
        )
        previous_start = (month_start - timedelta(days=1)).replace(day=1)
        elapsed = local_now - month_start
        previous_end = previous_start + elapsed
        comparison_available = previous_end <= month_start
        expressions = {
            "count": Count(
                "BUSN_ID",
                filter=Q(
                    BUSN_CREATED_AT__gte=month_start,
                    BUSN_CREATED_AT__lt=as_of,
                ),
            ),
        }
        if comparison_available:
            expressions["previous_count"] = Count(
                "BUSN_ID",
                filter=Q(
                    BUSN_CREATED_AT__gte=previous_start,
                    BUSN_CREATED_AT__lt=previous_end,
                ),
            )

        # Match platform growth's retained-row, half-open creation definition.
        additions = Business.objects.filter(
            BUSN_CREATED_AT__gte=previous_start,
            BUSN_CREATED_AT__lt=as_of,
        ).aggregate(**expressions)
        previous_count = additions.get("previous_count")
        difference = None
        comparison_reason = "previous_month_shorter"
        previous_period_end = None
        if comparison_available:
            difference = additions["count"] - previous_count
            comparison_reason = None
            previous_period_end = previous_end.astimezone(UTC)

        return {
            "as_of": as_of,
            "business_status": DashboardSummaryService.get_business_status(),
            "new_businesses": {
                "count": additions["count"],
                "previous_count": previous_count,
                "difference": difference,
                "comparison_available": comparison_available,
                "comparison_reason": comparison_reason,
                "period_start": month_start.astimezone(UTC),
                "period_end": as_of,
                "previous_period_start": previous_start.astimezone(UTC),
                "previous_period_end": previous_period_end,
                "timezone": "Asia/Manila",
            },
            "change_requests": DashboardSummaryService.get_pending_business_updates(),
        }
