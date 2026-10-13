from django.db import models, transaction
from django.db.models.functions import Greatest

from apps.business.models import Business
from apps.reviews.models import Review

from apps.reviews.services.business_review_summary_service import (
    BusinessReviewSummaryService,
)
from apps.reviews.services.review_keyword_service import ReviewKeywordService
from apps.reviews.services.review_report_service import ReviewReportService


class ReviewModerationConsistencyService:
    """Removes excluded evidence and schedules authoritative insight regeneration."""

    @staticmethod
    @transaction.atomic
    def reject_review(review_id: int) -> tuple[Review, str]:
        """Reject a review once and remove its published count and evidence."""
        review = Review.objects.select_for_update().get(REVW_ID=review_id)
        previous_status = review.REVW_STATUS

        if previous_status == Review.ReviewStatus.REJECTED:
            ReviewReportService.recompute_report_flag(review)
            return review, previous_status

        review.REVW_STATUS = Review.ReviewStatus.REJECTED
        review.save(update_fields=["REVW_STATUS", "REVW_UPDATED_AT"])

        if previous_status == Review.ReviewStatus.PUBLISHED:
            Business.objects.filter(BUSN_ID=review.BUSN_ID_id).update(
                BUSN_REVIEW_COUNT=Greatest(
                    models.F("BUSN_REVIEW_COUNT") - 1,
                    0,
                ),
            )

        ReviewReportService.recompute_report_flag(review)
        ReviewModerationConsistencyService.refresh_excluded_review(
            business_id=review.BUSN_ID_id,
            review_id=review.REVW_ID,
        )
        return review, previous_status

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
