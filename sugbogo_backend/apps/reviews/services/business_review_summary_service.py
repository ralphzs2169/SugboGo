import hashlib
import json
from datetime import timedelta

from django.db import transaction
from django.db.models import (
    Case,
    Func,
    OuterRef,
    QuerySet,
    Subquery,
    TextField,
    When,
)
from django.db.models.functions import Cast
from django.utils import timezone
from rest_framework.exceptions import NotFound

from apps.business.models import Business
from apps.reviews.models import BusinessReviewSummary, Review


class BusinessReviewSummaryService:
    """Reads stored summaries and recomputes sentiment from eligible reviews."""

    WINDOW_DAYS = 30
    SENTIMENT_LABELS = ("positive", "neutral", "negative")
    SENTIMENT_SOURCE_FIELDS = (
        "REVW_ID",
        "BUSN_ID_id",
        "REVW_TEXT",
        "REVW_SENTIMENT_SCORE",
        "REVW_SENTIMENT_LABEL",
        "REVW_CREATED_AT",
        "REVW_PUBLISHED_AT",
    )

    @staticmethod
    def sentiment_source(review: Review) -> str:
        """Identify the review content and classification represented in counts."""
        values = [
            getattr(review, field)
            for field in BusinessReviewSummaryService.SENTIMENT_SOURCE_FIELDS
        ]
        payload = json.dumps(
            values,
            default=str,
            ensure_ascii=False,
            separators=(",", ":"),
        )
        return "v1:" + hashlib.sha256(payload.encode("utf-8")).hexdigest()

    @staticmethod
    def annotate_sentiment_source(
        queryset: QuerySet,
        user,
    ) -> QuerySet:
        """Load only the author's stored source alongside its current review row."""
        source = (
            BusinessReviewSummary.objects
            .filter(BUSN_ID_id=OuterRef("BUSN_ID_id"))
            .annotate(
                review_source=Func(
                    "BRSU_SENTIMENT_SOURCES",
                    Cast(OuterRef("REVW_ID"), output_field=TextField()),
                    function="jsonb_extract_path_text",
                    output_field=TextField(),
                ),
            )
            .values("review_source")[:1]
        )
        return queryset.annotate(
            sentiment_aggregate_source=Case(
                When(
                    USER_ID=user,
                    then=Subquery(source),
                ),
                output_field=TextField(),
            ),
        )

    @staticmethod
    def is_sentiment_included(review: Review) -> bool:
        """Verify the current eligible classification against stored provenance."""
        reference_time = timezone.now()
        coverage_start = reference_time - timedelta(
            days=BusinessReviewSummaryService.WINDOW_DAYS,
        )
        if (
            review.REVW_STATUS != Review.ReviewStatus.PUBLISHED
            or review.REVW_SENTIMENT_SCORE is None
            or (
                review.REVW_SENTIMENT_LABEL
                not in BusinessReviewSummaryService.SENTIMENT_LABELS
            )
            or review.REVW_CREATED_AT > reference_time
            or review.REVW_CREATED_AT < coverage_start
        ):
            return False
        source = getattr(review, "sentiment_aggregate_source", None)
        return (
            source is not None
            and source == BusinessReviewSummaryService.sentiment_source(review)
        )

    @staticmethod
    def eligible_reviews(
        business_id: int,
        reference_time=None,
    ) -> QuerySet:
        """Returns eligible reviews in the rolling generation window."""
        reference_time = reference_time or timezone.now()
        coverage_start = reference_time - timedelta(
            days=BusinessReviewSummaryService.WINDOW_DAYS,
        )
        return Review.objects.filter(
            BUSN_ID_id=business_id,
            REVW_STATUS=Review.ReviewStatus.PUBLISHED,
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
        # Counts and provenance must use one SELECT snapshot, never separate reads.
        reviews = list(
            BusinessReviewSummaryService.eligible_reviews(
                business_id,
                reference_time=reference_time,
            )
            .only(*BusinessReviewSummaryService.SENTIMENT_SOURCE_FIELDS)
            .order_by("REVW_ID"),
        )
        counts = dict.fromkeys(BusinessReviewSummaryService.SENTIMENT_LABELS, 0)
        sources = {}
        for review in reviews:
            label = review.REVW_SENTIMENT_LABEL
            if label in counts:
                counts[label] += 1
                sources[str(review.pk)] = BusinessReviewSummaryService.sentiment_source(
                    review,
                )
        summary.BRSU_POSITIVE_COUNT = counts["positive"]
        summary.BRSU_NEUTRAL_COUNT = counts["neutral"]
        summary.BRSU_NEGATIVE_COUNT = counts["negative"]
        summary.BRSU_REVIEW_COUNT = len(reviews)
        summary.BRSU_CLASSIFIED_REVIEW_COUNT = (
            counts["positive"] + counts["neutral"] + counts["negative"]
        )
        summary.BRSU_SENTIMENT_COMPUTED_AT = timezone.now()
        summary.BRSU_SENTIMENT_SOURCES = sources
        summary.save(
            update_fields=[
                "BRSU_POSITIVE_COUNT",
                "BRSU_NEUTRAL_COUNT",
                "BRSU_NEGATIVE_COUNT",
                "BRSU_REVIEW_COUNT",
                "BRSU_CLASSIFIED_REVIEW_COUNT",
                "BRSU_SENTIMENT_COMPUTED_AT",
                "BRSU_SENTIMENT_SOURCES",
                "BRSU_UPDATED_AT",
            ],
        )
        return summary
