import logging

from django.db import transaction
from django.db.models import Q

from apps.reviews.models import Review
from apps.reviews.services.business_review_summary_service import (
    BusinessReviewSummaryService,
)
from apps.reviews.services.review_service import ReviewService
from apps.reviews.services.sentiment import route_sentiment

logger = logging.getLogger(__name__)


class ReviewSentimentService:
    """Scores pending reviews and reconciles missing eligible sentiment."""

    @staticmethod
    def process_review(
        review_id: int,
        recompute_summary: bool = True,
    ) -> str:
        """Stores a score only while its source text is still current."""
        source = (
            Review.objects
            .filter(REVW_ID=review_id)
            .values("REVW_TEXT", "REVW_SENTIMENT_SCORE", "REVW_SENTIMENT_LABEL")
            .first()
        )
        if source is None:
            return "missing"
        if (
            source["REVW_SENTIMENT_SCORE"] is not None
            and source["REVW_SENTIMENT_LABEL"] is not None
        ):
            return "already_scored"

        source_text = source["REVW_TEXT"]
        score, label, _ = route_sentiment(source_text)

        with transaction.atomic():
            review = (
                Review.objects
                .select_for_update()
                .filter(REVW_ID=review_id)
                .first()
            )
            if review is None:
                return "missing"
            if review.REVW_TEXT != source_text:
                return "stale"
            if (
                review.REVW_SENTIMENT_SCORE is not None
                and review.REVW_SENTIMENT_LABEL is not None
            ):
                return "already_scored"

            review.REVW_SENTIMENT_SCORE = score
            review.REVW_SENTIMENT_LABEL = label.lower()
            review.REVW_IS_OUTLIER_SENTIMENT = ReviewService._is_outlier_sentiment(
                review,
            )
            business_id = review.BUSN_ID_id
            review.save(
                update_fields=[
                    "REVW_SENTIMENT_SCORE",
                    "REVW_SENTIMENT_LABEL",
                    "REVW_IS_OUTLIER_SENTIMENT",
                    "REVW_UPDATED_AT",
                ],
            )

        if recompute_summary:
            BusinessReviewSummaryService.recompute_sentiment(business_id)
        return "updated"

    @staticmethod
    def reconcile_business(business_id: int) -> dict:
        """Attempts each eligible incomplete review before summary aggregation."""
        review_ids = (
            BusinessReviewSummaryService.eligible_reviews(business_id)
            .filter(
                Q(REVW_SENTIMENT_SCORE__isnull=True)
                | Q(REVW_SENTIMENT_LABEL__isnull=True),
            )
            .order_by("REVW_ID")
            .values_list("REVW_ID", flat=True)
            .iterator()
        )
        result = {
            "business_id": business_id,
            "attempted": 0,
            "updated": 0,
            "failed": 0,
        }
        for review_id in review_ids:
            result["attempted"] += 1
            try:
                outcome = ReviewSentimentService.process_review(
                    review_id,
                    recompute_summary=False,
                )
                if outcome == "updated":
                    result["updated"] += 1
                elif outcome == "stale":
                    logger.info(
                        "Stale review sentiment discarded during reconciliation.",
                        extra={"review_id": review_id, "business_id": business_id},
                    )
                elif outcome == "missing":
                    logger.info(
                        "Review missing during sentiment reconciliation.",
                        extra={"review_id": review_id, "business_id": business_id},
                    )
            except Exception as exc:
                result["failed"] += 1
                logger.error(
                    "Review sentiment reconciliation failed.",
                    extra={
                        "review_id": review_id,
                        "business_id": business_id,
                        "error_type": type(exc).__name__,
                    },
                )

        logger.info("Review sentiment reconciliation completed.", extra=result)
        return result
