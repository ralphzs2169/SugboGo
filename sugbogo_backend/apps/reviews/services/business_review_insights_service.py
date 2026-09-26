from django.utils import timezone

from apps.reviews.services.business_review_summary_service import (
    BusinessReviewSummaryService,
)
from apps.reviews.services.review_keyword_service import ReviewKeywordService


class BusinessReviewInsightsService:
    """Coordinates existing sentiment and keyword processing for one business."""

    @staticmethod
    def refresh(
        business_id: int,
        retry_keywords_only: bool = False,
        reference_time=None,
    ) -> dict:
        """Refreshes windowed sentiment and generated insights for one business."""
        reference_time = reference_time or timezone.now()
        if not retry_keywords_only:
            BusinessReviewSummaryService.recompute_sentiment(
                business_id,
                reference_time=reference_time,
            )

        generation_outcome = ReviewKeywordService.refresh(
            business_id,
            reference_time=reference_time,
        )

        return {
            "business_id": business_id,
            "sentiment_recomputed": not retry_keywords_only,
            "generation_outcome": generation_outcome,
        }
