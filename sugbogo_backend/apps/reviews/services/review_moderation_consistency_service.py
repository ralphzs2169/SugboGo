from django.db import transaction

from apps.reviews.services.business_review_summary_service import (
    BusinessReviewSummaryService,
)
from apps.reviews.services.review_keyword_service import ReviewKeywordService


class ReviewModerationConsistencyService:
    """Removes excluded evidence and schedules authoritative insight regeneration."""

    @staticmethod
    @transaction.atomic
    def refresh_excluded_review(business_id: int, review_id: int) -> None:
        """Refreshes sentiment and invalidates generated evidence in one transaction."""
        from apps.reviews.services.review_service import ReviewService

        BusinessReviewSummaryService.recompute_sentiment(business_id)
        ReviewKeywordService.remove_review_evidence(
            business_id=business_id,
            review_id=review_id,
        )
        ReviewService._queue_review_insights_after_commit(business_id)
