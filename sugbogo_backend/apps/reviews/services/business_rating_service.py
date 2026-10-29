"""Calculate experimental ratings from one explicitly selected score methodology."""

import math
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import Avg, Count, F
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from apps.business.models import Business
from apps.reviews.models import BusinessRating, Review, ReviewRatingResult


class BusinessRatingService:
    """Own rating compatibility, persisted inputs, and full SQL recomputation."""

    LEGACY_VERSION = "legacy-unverified-v1"
    CALCULATION_VERSION = "signed-average-v1"
    MIN_REVIEWS = 5
    LABELS = ("positive", "neutral", "negative")

    @classmethod
    def validate_version(
        cls,
        scoring_version,
        allow_legacy=False,
    ):
        """Require an explicit methodology identifier and opt-in for unknown provenance."""
        if (
            not isinstance(scoring_version, str)
            or not scoring_version.strip()
            or scoring_version != scoring_version.strip()
            or len(scoring_version) > 100
        ):
            raise ValidationError("Provide a nonblank scoring compatibility version.")
        if scoring_version == cls.LEGACY_VERSION and not allow_legacy:
            raise ValidationError("Legacy scores require explicit experimental opt-in.")

    @staticmethod
    def convert_score(score):
        """Convert one finite signed score without rounding its contribution."""
        try:
            value = Decimal(str(score))
        except (ValueError, ArithmeticError):
            raise ValidationError("Sentiment score must be finite and between -1 and 1.")
        if not value.is_finite() or not Decimal("-1") <= value <= Decimal("1"):
            raise ValidationError("Sentiment score must be finite and between -1 and 1.")
        return Decimal("3") + Decimal("2") * value

    @classmethod
    @transaction.atomic
    def record_result(
        cls,
        review_id,
        source_text,
        score,
        label,
        scoring_version,
    ):
        """Publish a versioned rating input only for the exact currently stored text."""
        cls.validate_version(scoring_version)
        cls.convert_score(score)
        if label not in cls.LABELS:
            raise ValidationError("Provide a recognized sentiment label.")
        if not isinstance(source_text, str) or not source_text.strip():
            raise ValidationError("Analyzed review text must not be blank.")
        try:
            review = Review.objects.select_for_update().get(pk=review_id)
        except Review.DoesNotExist:
            raise NotFound("The review could not be found.") from None
        if review.REVW_TEXT != source_text:
            raise ValidationError("The sentiment result refers to stale review text.")
        result, _ = ReviewRatingResult.objects.update_or_create(
            REVW_ID=review,
            defaults={
                "RRSR_SOURCE_TEXT": source_text,
                "RRSR_SCORE": float(score),
                "RRSR_LABEL": label,
                "RRSR_SCORING_VERSION": scoring_version,
                "RRSR_IS_VALID": True,
            },
        )
        from apps.reviews.services.business_rating_work_service import BusinessRatingWorkService

        BusinessRatingWorkService.request_change(review.BUSN_ID_id)
        return result

    @staticmethod
    @transaction.atomic
    def invalidate_result(review_id):
        """Revoke a versioned input without falling back to unverified legacy scores."""
        from apps.reviews.services.business_rating_work_service import BusinessRatingWorkService

        try:
            review = Review.objects.select_for_update().get(pk=review_id)
        except Review.DoesNotExist:
            raise NotFound("The review could not be found.") from None
        ReviewRatingResult.objects.filter(REVW_ID=review).update(
            RRSR_IS_VALID=False,
            RRSR_UPDATED_AT=timezone.now(),
        )
        BusinessRatingWorkService.request_change(review.BUSN_ID_id)

    @classmethod
    def eligible_reviews(
        cls,
        business_id,
        scoring_version,
    ):
        """Select all-time published valid inputs without mixing score versions."""
        reviews = (
            Review.objects
            .filter(
                BUSN_ID_id=business_id,
                REVW_STATUS=Review.ReviewStatus.PUBLISHED,
                REVW_TEXT__regex=r"\S",
            )
        )
        if scoring_version == cls.LEGACY_VERSION:
            # Any explicit result removes a review from the unknown-provenance lane.
            reviews = reviews.filter(rating_result__isnull=True)
            score_field = "REVW_SENTIMENT_SCORE"
            label_field = "REVW_SENTIMENT_LABEL"
        else:
            reviews = reviews.filter(
                rating_result__RRSR_SCORING_VERSION=scoring_version,
                rating_result__RRSR_IS_VALID=True,
                rating_result__RRSR_SOURCE_TEXT=F("REVW_TEXT"),
            )
            score_field = "rating_result__RRSR_SCORE"
            label_field = "rating_result__RRSR_LABEL"
        # PostgreSQL NaN sorts above finite numbers; these bounds also exclude
        # both infinities and NULL, without loading review rows into Python.
        reviews = reviews.filter(**{
            f"{score_field}__gte": -1.0,
            f"{score_field}__lte": 1.0,
            f"{label_field}__in": cls.LABELS,
        })
        return reviews, score_field

    @classmethod
    @transaction.atomic
    def recompute(
        cls,
        business_id,
        scoring_version,
        allow_legacy=False,
        expected_revision=None,
    ):
        """Serialize full recomputation and store count/value from one SQL snapshot."""
        cls.validate_version(
            scoring_version,
            allow_legacy=allow_legacy,
        )
        try:
            business = Business.objects.select_for_update().get(pk=business_id)
        except Business.DoesNotExist:
            raise NotFound("The business could not be found.") from None
        aggregate, _ = BusinessRating.objects.select_for_update().get_or_create(
            BUSN_ID=business,
            defaults={
                "BRAT_SCORING_VERSION": scoring_version,
                "BRAT_CALCULATION_VERSION": cls.CALCULATION_VERSION,
            },
        )
        if expected_revision is not None and (
            aggregate.BRAT_REQUESTED_REVISION != expected_revision
            or aggregate.BRAT_SCORING_VERSION != scoring_version
        ):
            return aggregate
        reviews, score_field = cls.eligible_reviews(
            business_id,
            scoring_version,
        )
        statistics = reviews.aggregate(
            count=Count("pk"),
            average=Avg(score_field),
        )
        count = statistics["count"]
        value = None
        state = BusinessRating.State.INSUFFICIENT_DATA
        if count >= cls.MIN_REVIEWS:
            average = statistics["average"]
            if average is None or not math.isfinite(average):
                raise ValidationError("The sentiment average is invalid.")
            value = cls.convert_score(average).quantize(
                Decimal("0.0000000001"),
                rounding=ROUND_HALF_UP,
            )
            state = BusinessRating.State.READY
        aggregate.BRAT_VALUE = value
        aggregate.BRAT_REVIEW_COUNT = count
        aggregate.BRAT_COMPUTED_AT = timezone.now()
        aggregate.BRAT_SCORING_VERSION = scoring_version
        aggregate.BRAT_CALCULATION_VERSION = cls.CALCULATION_VERSION
        aggregate.BRAT_STATE = state
        if expected_revision is None:
            aggregate.BRAT_REQUESTED_REVISION += 1
        aggregate.BRAT_COMPLETED_REVISION = aggregate.BRAT_REQUESTED_REVISION
        aggregate.BRAT_ATTEMPTS = 0
        aggregate.BRAT_RETRY_AT = None
        aggregate.BRAT_LAST_ERROR = ""
        aggregate.save()
        return aggregate

