from django.db import models, transaction
from django.db.models.functions import Greatest
from rest_framework.exceptions import NotFound

from apps.business.models import Business
from apps.reviews.models import BusinessReviewSummary, Review, ReviewInsightRegeneration
from apps.reviews.services.review_keyword_service import ReviewKeywordService

from apps.reviews.services.business_review_summary_service import (
    BusinessReviewSummaryService,
)
from apps.reviews.services.review_insight_scheduling_service import ReviewInsightSchedulingService
from apps.reviews.services.review_report_service import ReviewReportService


class ReviewModerationConsistencyService:
    """Removes excluded evidence and schedules authoritative insight regeneration."""

    @staticmethod
    @transaction.atomic
    def reject_review(review_id: int) -> tuple[Review, str]:
        """Reject a review once and remove its published count and evidence."""
        try:
            review = Review.objects.select_for_update().get(
                REVW_ID=review_id,
            )
        except Review.DoesNotExist:
            raise NotFound("The review could not be found.") from None
        previous_status = review.REVW_STATUS
        previous_input = ReviewInsightSchedulingService.review_input(review)

        if previous_status == Review.ReviewStatus.REJECTED:
            ReviewReportService.recompute_report_flag(review)
            return review, previous_status

        review.REVW_STATUS = Review.ReviewStatus.REJECTED
        review.save(update_fields=["REVW_STATUS", "REVW_UPDATED_AT"])
        ReviewInsightSchedulingService.review_changed(
            review.BUSN_ID_id,
            previous_input,
            None,
        )

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
    def refresh_excluded_review(
        business_id: int,
        review_id: int,
    ) -> None:
        """Reconcile already tracked or cited exclusions before locking sentiment totals."""
        summary = BusinessReviewSummary.objects.filter(BUSN_ID_id=business_id).first()
        cited = False
        if summary is not None:
            cited = review_id in ReviewKeywordService._reference_ids(
                summary.BRSU_SUPPORTING_REVIEW_REFERENCES,
            )
        if (
            cited
            or ReviewInsightRegeneration.objects.filter(BUSN_ID_id=business_id).exists()
        ):
            ReviewInsightSchedulingService.reconcile(business_id)
        BusinessReviewSummaryService.recompute_sentiment(business_id)
