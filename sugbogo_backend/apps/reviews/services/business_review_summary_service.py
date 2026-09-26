from datetime import timedelta

from django.db import transaction
from django.db.models import Count, Q, QuerySet
from django.utils import timezone
from rest_framework.exceptions import NotFound

from apps.business.models import Business
from apps.reviews.models import BusinessReviewSummary, Review


class BusinessReviewSummaryService:
    """Reads stored summaries and recomputes sentiment from eligible reviews."""

    WINDOW_DAYS = 30

    @staticmethod
    def eligible_reviews(business_id: int, reference_time=None) -> QuerySet:
        """Returns eligible reviews in the rolling generation window."""
        reference_time = reference_time or timezone.now()
        coverage_start = reference_time - timedelta(
            days=BusinessReviewSummaryService.WINDOW_DAYS,
        )
        return Review.objects.filter(
            BUSN_ID_id=business_id,
            REVW_STATUS=Review.ReviewStatus.PUBLISHED,
            REVW_IS_SPAM_FLAGGED=False,
            REVW_IS_DEVICE_ABUSE_FLAGGED=False,
            REVW_CREATED_AT__gte=coverage_start,
            REVW_CREATED_AT__lte=reference_time,
        )

    @staticmethod
    def get_summary(business_id: int) -> BusinessReviewSummary:
        """Returns a stored business summary or a controlled not-found error."""
        try:
            return BusinessReviewSummary.objects.get(
                BUSN_ID_id=business_id,
            )
        except BusinessReviewSummary.DoesNotExist:
            raise NotFound(
                "The business review summary could not be found.",
            ) from None

    @staticmethod
    @transaction.atomic
    def recompute_sentiment(
        business_id: int,
        reference_time=None,
    ) -> BusinessReviewSummary:
        """Atomically replaces sentiment counts while preserving keyword state."""
        try:
            business = Business.objects.get(
                BUSN_ID=business_id,
            )
        except Business.DoesNotExist:
            raise NotFound(
                "The business could not be found.",
            ) from None

        # Serialize concurrent recomputations before reading the source counts.
        summary, _ = (
            BusinessReviewSummary.objects.select_for_update().get_or_create(
                BUSN_ID=business,
            )
        )
        counts = BusinessReviewSummaryService.eligible_reviews(
            business_id,
            reference_time=reference_time,
        ).aggregate(
            total=Count("REVW_ID"),
            positive=Count(
                "REVW_ID",
                filter=Q(REVW_SENTIMENT_LABEL="positive"),
            ),
            neutral=Count(
                "REVW_ID",
                filter=Q(REVW_SENTIMENT_LABEL="neutral"),
            ),
            negative=Count(
                "REVW_ID",
                filter=Q(REVW_SENTIMENT_LABEL="negative"),
            ),
        )
        summary.BRSU_POSITIVE_COUNT = counts["positive"]
        summary.BRSU_NEUTRAL_COUNT = counts["neutral"]
        summary.BRSU_NEGATIVE_COUNT = counts["negative"]
        summary.BRSU_REVIEW_COUNT = counts["total"]
        summary.BRSU_CLASSIFIED_REVIEW_COUNT = (
            counts["positive"] + counts["neutral"] + counts["negative"]
        )
        summary.BRSU_SENTIMENT_COMPUTED_AT = timezone.now()
        summary.save(
            update_fields=[
                "BRSU_POSITIVE_COUNT",
                "BRSU_NEUTRAL_COUNT",
                "BRSU_NEGATIVE_COUNT",
                "BRSU_REVIEW_COUNT",
                "BRSU_CLASSIFIED_REVIEW_COUNT",
                "BRSU_SENTIMENT_COMPUTED_AT",
                "BRSU_UPDATED_AT",
            ],
        )
        return summary
