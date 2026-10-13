"""Premium presentation of stored review insights with their original coverage and freshness."""

from apps.explorer_operations.explore_businesses.serializers.review_insights_serializers import BusinessReviewInsightsSerializer
from apps.merchant_operations.business_profile.services.business_profile_service import BusinessProfileService
from apps.reviews.models import BusinessReviewSummary

from .premium_common import owned_business_data, snapshot_meta


class PremiumReviewInsightsService:
    """Read stored summaries only; analytics requests never trigger review processing."""

    @staticmethod
    def get_report(user, period):
        """Reuse the public content gate and exclude private generation evidence."""
        business = BusinessProfileService.get_business_for_merchant(user)
        summary = BusinessReviewSummary.objects.filter(BUSN_ID=business.pk).first()
        reasons = ["stored_summary_uses_own_coverage"]
        if summary is None:
            insights = None
            reasons.append("stored_summary_missing")
        else:
            # Legacy policy discrepancy: stored sentiment recomputation filters published
            # status/dates, while narrative eligibility also excludes abuse flags.
            insights = dict(BusinessReviewInsightsSerializer(summary).data)
            if not insights["content_available"]:
                reasons.append("stored_content_unavailable")
            if insights["state"] == BusinessReviewSummary.GenerationState.OUTDATED:
                reasons.append("stored_content_outdated")
        return {
            "business": owned_business_data(business), "stored_summary": insights,
            "measurement_note": (
                "Stored insights use their own rolling 30-day generation window, not the selected analytics period. "
                "Mention counts describe analyzed reviews only; is_sampled indicates subset sampling. "
                "No praise or concern polarity is inferred."
            ),
            "meta": snapshot_meta(period, *reasons),
        }
