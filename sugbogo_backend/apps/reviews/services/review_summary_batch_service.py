import logging

from django.utils import timezone

from apps.business.models import Business
from apps.reviews.services.business_review_summary_service import (
    BusinessReviewSummaryService,
)
from apps.reviews.services.review_keyword_service import (
    RetryableKeywordError,
    ReviewKeywordService,
)

logger = logging.getLogger(__name__)


class ReviewSummaryBatchService:
    """Processes independent business summaries and identifies retryable failures."""

    @staticmethod
    def recompute(business_ids=None, reference_time=None):
        """Runs a full batch or retries generation for explicitly selected IDs."""
        reference_time = reference_time or timezone.now()
        retry_only = business_ids is not None
        ids = (
            sorted(set(business_ids))
            if retry_only
            else Business.objects.order_by("BUSN_ID")
            .values_list("BUSN_ID", flat=True)
            .iterator()
        )
        result = {
            "considered": 0,
            "sentiment_updated": 0,
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
                    BusinessReviewSummaryService.recompute_sentiment(
                        business_id,
                        reference_time=reference_time,
                    )
                    result["sentiment_updated"] += 1
                outcome = ReviewKeywordService.refresh(
                    business_id,
                    reference_time=reference_time,
                )
                if outcome == "updated":
                    result["keywords_updated"] += 1
                elif outcome == "cleared":
                    result["keywords_cleared"] += 1
                elif outcome in {
                    "unchanged",
                    "already_attempted",
                    "busy",
                    "stale",
                    "insufficient_reviews",
                }:
                    result["keywords_skipped"] += 1
                else:
                    result["failed_business_ids"].append(business_id)
            except RetryableKeywordError:
                result["retry_business_ids"].append(business_id)
                logger.warning(
                    "Business keyword extraction requires a transient retry.",
                    extra={"business_id": business_id},
                )
            except Exception as exc:
                result["failed_business_ids"].append(business_id)
                logger.error(
                    "Business review summary failed; continuing the batch.",
                    extra={"business_id": business_id, "error_type": type(exc).__name__},
                )
        return result
