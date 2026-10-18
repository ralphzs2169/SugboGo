"""Current actionable published-review backlog, independent of reporting periods."""

from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone

from apps.merchant_operations.business_profile.services.business_profile_service import (
    BusinessProfileService,
)

from .standard_analytics_service import StandardAnalyticsService


class AgedUnansweredReviewsService:
    """Aggregate elapsed review ages without historical snapshots or Plus dependencies."""

    @staticmethod
    def get_report(
        user,
    ):
        """Resolve ownership and count the actionable backlog using one server reference time."""
        reference_time = timezone.now()
        business = BusinessProfileService.get_business_for_merchant(user)
        three_days_ago = reference_time - timedelta(hours=72)
        seven_days_ago = reference_time - timedelta(hours=168)

        backlog = StandardAnalyticsService.published_reviews_at_cutoff(
            business.pk,
            reference_time,
        ).filter(
            has_eligible_reply=False,
            # Any retained one-to-one reply prevents another create_reply, even if
            # its timestamps do not qualify for Standard's reply-rate statistics.
            reply__isnull=True,
        )
        counts = backlog.aggregate(
            total_unanswered=Count("pk"),
            under_3_days=Count(
                "pk",
                filter=Q(REVW_CREATED_AT__gt=three_days_ago),
            ),
            days_3_to_6=Count(
                "pk",
                filter=(
                    Q(REVW_CREATED_AT__gt=seven_days_ago)
                    & Q(REVW_CREATED_AT__lte=three_days_ago)
                ),
            ),
            days_7_plus=Count(
                "pk",
                filter=Q(REVW_CREATED_AT__lte=seven_days_ago),
            ),
        )
        return {
            "business": {
                "id": business.pk,
                "name": business.BUSN_NAME,
                "status": business.BUSN_STATUS,
            },
            **counts,
            "snapshot_as_of": reference_time.isoformat(),
        }
