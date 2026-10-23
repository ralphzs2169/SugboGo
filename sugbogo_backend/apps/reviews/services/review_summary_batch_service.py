import logging

from django.utils import timezone

from apps.business.models import Business
from apps.reviews.services.business_review_summary_service import (
    BusinessReviewSummaryService,
)
from apps.reviews.services.review_sentiment_service import ReviewSentimentService
from apps.shared.analytics.policy import with_policy_snapshot
from apps.reviews.services.review_insight_scheduling_service import ReviewInsightSchedulingService

logger = logging.getLogger(__name__)


class ReviewSummaryBatchService:
    """Processes independent business summaries and identifies retryable failures."""

    @staticmethod
    @with_policy_snapshot
    def recompute(
        business_ids=None,
        reference_time=None,
    ):
        """Reconcile sentiment and narrative demand while reporting partial failures."""
        reference_time = reference_time or timezone.now()
        retry_only = business_ids is not None
        if retry_only:
            ids = sorted(set(business_ids))
        else:
            ids = (
                Business.objects.order_by("BUSN_ID")
                .values_list("BUSN_ID", flat=True)
                .iterator()
            )
        result = {
            "considered": 0,
            "sentiment_updated": 0,
            "classification_failed": 0,
            "sentiment_results": [],
            "keywords_updated": 0,
            "keywords_cleared": 0,
            "keywords_skipped": 0,
            "failed_business_ids": [],
            "retry_business_ids": [],
        }
        for business_id in ids:
            result["considered"] += 1
            try:
                if not retry_only:
                    sentiment_result = {
                        "business_id": business_id,
                        "classification": None,
                        "aggregate_updated": False,
                    }
                    result["sentiment_results"].append(sentiment_result)
                    classification = ReviewSentimentService.reconcile_business(
                        business_id,
                        reference_time=reference_time,
                    )
                    sentiment_result["classification"] = classification
                    result["classification_failed"] += classification["failed"]
                    if classification["failed"]:
                        result["failed_business_ids"].append(business_id)
                    BusinessReviewSummaryService.recompute_sentiment(
                        business_id,
                        reference_time=reference_time,
                    )
                    sentiment_result["aggregate_updated"] = True
                    # This legacy counter measures aggregate writes, not classification completeness.
                    result["sentiment_updated"] += 1
            except Exception as exc:
                if business_id not in result["failed_business_ids"]:
                    result["failed_business_ids"].append(business_id)
                logger.error(
                    "Business sentiment reconciliation failed. business_id=%s error_type=%s",
                    business_id,
                    type(exc).__name__,
                )
            try:
                ReviewInsightSchedulingService.reconcile(business_id)
                result["keywords_skipped"] += 1
            except Exception as exc:
                if business_id not in result["failed_business_ids"]:
                    result["failed_business_ids"].append(business_id)
                logger.error(
                    "Business narrative reconciliation failed. business_id=%s error_type=%s",
                    business_id,
                    type(exc).__name__,
                )
        return result
