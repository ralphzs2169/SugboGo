from apps.reviews.services.business_review_summary_service import (
    BusinessReviewSummaryService,
)
from apps.reviews.services.review_keyword_service import ReviewKeywordService
from apps.reviews.services.review_sentiment_service import ReviewSentimentService


class BusinessReviewInsightsService:
    """Coordinates existing sentiment and keyword processing for one business."""

    @staticmethod
    def refresh(business_id: int, retry_keywords_only: bool = False) -> dict:
        """Refreshes sentiment first, then keywords, except on keyword retries."""
        if not retry_keywords_only:
            ReviewSentimentService.reconcile_business(business_id)
            BusinessReviewSummaryService.recompute_sentiment(business_id)

        keyword_outcome = ReviewKeywordService.refresh(business_id)

        return {
            "business_id": business_id,
            "sentiment_recomputed": not retry_keywords_only,
            "keyword_outcome": keyword_outcome,
        }
