"""Atomically project complete, versioned business cohorts into sentiment consumers."""

import logging
from types import SimpleNamespace

from django.conf import settings
from django.db import transaction
from django.db.models import Case, CharField, Exists, F, OuterRef, Q, Value, When
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from apps.business.models import Business
from apps.reviews.models import (
    BusinessRating,
    BusinessSentimentPolicy as Policy,
    Review,
    ReviewLegacySentimentSnapshot as Snapshot,
    ReviewRatingResult,
    ReviewSentimentShadow as Shadow,
)
from apps.reviews.services.business_rating_service import BusinessRatingService
from apps.reviews.services.business_rating_work_service import BusinessRatingWorkService
from apps.reviews.services.business_review_summary_service import BusinessReviewSummaryService
from apps.reviews.services.gemini_sentiment_contract import (
    contract_version,
    text_hash,
    validate_output,
)

logger = logging.getLogger(__name__)


class GeminiSentimentCutoverService:
    """Project validated results into existing consumers without mixing methodologies."""

    @staticmethod
    def active_policy(business_id):
        """Read persisted authority even while inference is administratively paused."""
        return Policy.objects.filter(
            BUSN_ID_id=business_id,
            BSPO_MODE=Policy.Mode.GEMINI,
        ).first()

    @classmethod
    def prepare(cls, business_id, queue=False, limit=100):
        """Report complete cohort readiness and optionally queue a bounded explicit backfill."""
        if not Business.objects.filter(pk=business_id).exists():
            raise NotFound("The business could not be found.")
        from apps.reviews.services.gemini_sentiment_shadow_service import GeminiSentimentShadowService

        policy = cls.active_policy(business_id) or SimpleNamespace(
            BSPO_MODEL=settings.GEMINI_SENTIMENT_SHADOW_MODEL,
            BSPO_VERSION=contract_version(settings.GEMINI_SENTIMENT_SHADOW_MODEL),
        )
        result = {
            "business_id": business_id,
            "total": 0,
            "ready": 0,
            "not_ready": 0,
            "requested": 0,
        }
        for review in Review.objects.filter(
            BUSN_ID_id=business_id, REVW_STATUS=Review.ReviewStatus.PUBLISHED,
            REVW_TEXT__regex=r"\S",
        ).order_by("pk").iterator():
            result["total"] += 1
            job = Shadow.objects.filter(
                REVW_ID=review, RSSH_VERSION=policy.BSPO_VERSION,
                RSSH_SOURCE_HASH=text_hash(review.REVW_TEXT),
            ).first()
            try:
                cls.validate_job(review, job, policy)
                result["ready"] += 1
            except ValidationError:
                result["not_ready"] += 1
                if queue and result["requested"] < limit and job is None:
                    if GeminiSentimentShadowService.request(review.pk) is not None:
                        result["requested"] += 1
        return result

    @classmethod
    def recover_requests(cls, limit=50):
        """Repair missing demand globally or within already activated pilot businesses."""
        from apps.reviews.services.gemini_sentiment_shadow_service import GeminiSentimentShadowService

        projections = ReviewRatingResult.objects.filter(
            REVW_ID_id=OuterRef("pk"), RRSR_IS_VALID=True,
            RRSR_SOURCE_TEXT=OuterRef("REVW_TEXT"),
            RRSR_SCORING_VERSION=OuterRef("BUSN_ID__sentiment_policy__BSPO_VERSION"),
        )
        population = Review.objects.all()
        if not settings.GEMINI_SENTIMENT_ALL_BUSINESSES:
            population = population.filter(BUSN_ID__sentiment_policy__BSPO_MODE=Policy.Mode.GEMINI)
        # Unactivated cohorts use the configured contract; activated cohorts stay pinned.
        population = population.annotate(
            demand_version=Case(
                When(BUSN_ID__sentiment_policy__BSPO_MODE=Policy.Mode.GEMINI,
                     then=F("BUSN_ID__sentiment_policy__BSPO_VERSION")),
                default=Value(contract_version(settings.GEMINI_SENTIMENT_SHADOW_MODEL)),
                output_field=CharField(),
            ),
        )
        jobs = Shadow.objects.filter(
            REVW_ID_id=OuterRef("pk"), RSSH_VERSION=OuterRef("demand_version"),
            RSSH_SOURCE_TEXT=OuterRef("REVW_TEXT"),
        )
        ids = list(population.filter(
            REVW_STATUS=Review.ReviewStatus.PUBLISHED,
            REVW_TEXT__regex=r"\S",
        ).annotate(
            has_job=Exists(jobs),
            has_ready_job=Exists(jobs.filter(RSSH_STATE=Shadow.State.READY)),
            has_projection=Exists(projections),
        ).filter(
            Q(has_job=False) | Q(
                BUSN_ID__sentiment_policy__BSPO_MODE=Policy.Mode.GEMINI,
                has_ready_job=True, has_projection=False,
            ),
        ).order_by("pk").values_list("pk", flat=True)[:limit])
        for review_id in ids:
            GeminiSentimentShadowService.observe_after_commit(review_id)
        return len(ids)

    @staticmethod
    def snapshot(review):
        """Retain original caches once, including any preexisting versioned rating input."""
        previous = ReviewRatingResult.objects.filter(REVW_ID=review).values(
            "RRSR_SOURCE_TEXT", "RRSR_SCORE", "RRSR_LABEL", "RRSR_IS_VALID",
            "RRSR_IS_ELIGIBLE", "RRSR_SCORING_VERSION",
        ).first()
        Snapshot.objects.get_or_create(
            REVW_ID=review,
            defaults={
                "RLSS_SOURCE_TEXT": review.REVW_TEXT,
                "RLSS_SCORE": review.REVW_SENTIMENT_SCORE,
                "RLSS_LABEL": review.REVW_SENTIMENT_LABEL,
                "RLSS_OUTLIER": review.REVW_IS_OUTLIER_SENTIMENT,
                "RLSS_RATING_RESULT": previous,
            },
        )

    @staticmethod
    def has_projection(review, job):
        """Recognize an exact current projection, including excluded null-score results."""
        return (
            review.REVW_SENTIMENT_SCORE == job.RSSH_SCORE
            and review.REVW_SENTIMENT_LABEL == (job.RSSH_LABEL if job.RSSH_ELIGIBLE else None)
            and ReviewRatingResult.objects.filter(
                REVW_ID=review, RRSR_SOURCE_TEXT=review.REVW_TEXT,
                RRSR_SCORING_VERSION=job.RSSH_VERSION, RRSR_IS_VALID=True,
                RRSR_IS_ELIGIBLE=job.RSSH_ELIGIBLE,
                RRSR_SCORE=job.RSSH_SCORE, RRSR_LABEL=job.RSSH_LABEL,
            ).exists()
        )

    @staticmethod
    def validate_job(review, job, policy):
        """Reject stale, incompatible, malformed, or incomplete stored observations."""
        if (
            job is None or job.RSSH_STATE != Shadow.State.READY
            or job.RSSH_SOURCE_TEXT != review.REVW_TEXT
            or job.RSSH_SOURCE_HASH != text_hash(review.REVW_TEXT)
            or job.RSSH_VERSION != policy.BSPO_VERSION
            or job.RSSH_MODEL != policy.BSPO_MODEL
            or policy.BSPO_VERSION != contract_version(policy.BSPO_MODEL)
        ):
            raise ValidationError("Every published nonblank review needs a current compatible Gemini result.")
        try:
            return validate_output({
                "label": job.RSSH_LABEL, "score": job.RSSH_SCORE,
                "eligible": job.RSSH_ELIGIBLE, "reason": job.RSSH_REASON,
            })
        except ValueError:
            raise ValidationError("A stored Gemini result failed contract validation.") from None

    @classmethod
    def project(cls, review, job, policy):
        """Write one validated projection while the caller owns its review lock."""
        result = cls.validate_job(review, job, policy)
        cls.snapshot(review)
        ReviewRatingResult.objects.update_or_create(
            REVW_ID=review,
            defaults={
                "RRSR_SOURCE_TEXT": review.REVW_TEXT,
                "RRSR_SCORE": result["score"],
                "RRSR_LABEL": result["label"],
                "RRSR_IS_VALID": True,
                "RRSR_IS_ELIGIBLE": result["eligible"],
                "RRSR_SCORING_VERSION": policy.BSPO_VERSION,
            },
        )
        # Exclusions have no classification in existing analytics denominators.
        review.REVW_SENTIMENT_SCORE = result["score"]
        review.REVW_SENTIMENT_LABEL = result["label"] if result["eligible"] else None
        review.REVW_IS_OUTLIER_SENTIMENT = False
        review.save(update_fields=[
            "REVW_SENTIMENT_SCORE", "REVW_SENTIMENT_LABEL",
            "REVW_IS_OUTLIER_SENTIMENT", "REVW_UPDATED_AT",
        ])
        job.RSSH_PROMOTED_AT = timezone.now()
        job.save(update_fields=["RSSH_PROMOTED_AT", "RSSH_UPDATED_AT"])

    @staticmethod
    def refresh_outliers(business_id):
        """Refresh flags only after all affected caches use the same methodology."""
        from apps.reviews.services.review_service import ReviewService

        for review in Review.objects.filter(BUSN_ID_id=business_id):
            value = (
                review.REVW_STATUS == Review.ReviewStatus.PUBLISHED
                and ReviewService._is_outlier_sentiment(review)
            )
            Review.objects.filter(pk=review.pk).update(REVW_IS_OUTLIER_SENTIMENT=value)

    @classmethod
    @transaction.atomic
    def promote(cls, job_id):
        """Publish a ready result only under current persisted business authority."""
        hint = Shadow.objects.filter(pk=job_id).values("REVW_ID_id", "REVW_ID__BUSN_ID_id").first()
        if hint is None:
            return "missing"
        business_id = hint["REVW_ID__BUSN_ID_id"]
        if (
            settings.GEMINI_SENTIMENT_ALL_BUSINESSES
            and settings.GEMINI_SENTIMENT_CUTOVER_ENABLED
            and cls.active_policy(business_id) is None
        ):
            if cls.prepare(business_id)["not_ready"]:
                return "preparing"
            # Acquire cohort locks in the same order as explicit activation.
            return cls.activate(business_id)
        review = Review.objects.select_for_update().filter(pk=hint["REVW_ID_id"]).first()
        if review is None:
            return "missing"
        policy = cls.active_policy(review.BUSN_ID_id)
        if policy is None:
            return "shadow"
        job = Shadow.objects.select_for_update().filter(pk=job_id).first()
        if job is None:
            return "missing"
        if job.RSSH_PROMOTED_AT is not None and cls.has_projection(review, job):
            return "unchanged"
        if review.REVW_STATUS != Review.ReviewStatus.PUBLISHED:
            return "ineligible"
        if review.REVW_TEXT != job.RSSH_SOURCE_TEXT or job.RSSH_VERSION != policy.BSPO_VERSION:
            return "stale"
        cls.project(review, job, policy)
        cls.refresh_outliers(review.BUSN_ID_id)
        BusinessRatingWorkService.request_change(review.BUSN_ID_id)
        BusinessReviewSummaryService.recompute_sentiment(review.BUSN_ID_id)
        return "promoted"

    @classmethod
    def promote_safely(cls, job_id):
        """Leave ready work recoverable if projection or aggregate persistence fails."""
        try:
            return cls.promote(job_id)
        except Exception as exc:
            logger.warning("Gemini promotion deferred: job=%s type=%s", job_id, type(exc).__name__)
            return "deferred"

    @classmethod
    @transaction.atomic
    def activate(cls, business_id):
        """Atomically adopt a full compatible cohort without making provider calls."""
        if not settings.GEMINI_SENTIMENT_CUTOVER_ENABLED:
            raise ValidationError("Enable GEMINI_SENTIMENT_CUTOVER_ENABLED before activation.")
        if not settings.GEMINI_SENTIMENT_ALL_BUSINESSES and business_id not in settings.GEMINI_SENTIMENT_SHADOW_BUSINESS_IDS:
            raise ValidationError("The business must be explicitly allowlisted for activation.")
        # Existing lifecycle paths acquire review locks before aggregate locks.
        list(Review.objects.select_for_update().filter(BUSN_ID_id=business_id).order_by("pk"))
        business = Business.objects.select_for_update().filter(pk=business_id).first()
        if business is None:
            raise NotFound("The business could not be found.")
        policy = Policy.objects.select_for_update().filter(BUSN_ID=business).first()
        if policy is not None and policy.BSPO_MODE == Policy.Mode.GEMINI:
            if policy.BSPO_VERSION != contract_version(policy.BSPO_MODEL):
                raise ValidationError("The active contract has changed; restore the matching code before continuing.")
            return "already_active"
        model = settings.GEMINI_SENTIMENT_SHADOW_MODEL
        version = contract_version(model)
        aggregate = BusinessRating.objects.filter(BUSN_ID=business).first()
        policy, _ = Policy.objects.update_or_create(
            BUSN_ID=business,
            defaults={
                "BSPO_MODE": Policy.Mode.GEMINI, "BSPO_MODEL": model,
                "BSPO_VERSION": version,
                "BSPO_PREVIOUS_RATING_VERSION": aggregate.BRAT_SCORING_VERSION if aggregate else settings.BUSINESS_RATING_DEFAULT_SCORING_VERSION,
            },
        )
        reviews = list(Review.objects.select_for_update().filter(BUSN_ID=business).order_by("pk"))
        for review in reviews:
            cls.snapshot(review)
            if review.REVW_STATUS == Review.ReviewStatus.PUBLISHED and review.REVW_TEXT.strip():
                job = Shadow.objects.filter(
                    REVW_ID=review, RSSH_VERSION=version,
                    RSSH_SOURCE_HASH=text_hash(review.REVW_TEXT),
                ).first()
                cls.project(review, job, policy)
            else:
                # Hidden and blank reviews must not later surface old cached labels.
                Review.objects.filter(pk=review.pk).update(
                    REVW_SENTIMENT_SCORE=None, REVW_SENTIMENT_LABEL=None,
                    REVW_IS_OUTLIER_SENTIMENT=False,
                )
                ReviewRatingResult.objects.filter(REVW_ID=review).update(RRSR_IS_VALID=False)
        cls.refresh_outliers(business_id)
        BusinessRatingService.recompute(business_id, version)
        BusinessReviewSummaryService.recompute_sentiment(business_id)
        return "activated"

    @classmethod
    @transaction.atomic
    def rollback(cls, business_id):
        """Restore unchanged legacy inputs and requeue edited or new text for legacy analysis."""
        if settings.GEMINI_SENTIMENT_ALL_BUSINESSES:
            raise ValidationError("Global Gemini authority forbids legacy rollback; pause inference instead.")
        list(Review.objects.select_for_update().filter(BUSN_ID_id=business_id).order_by("pk"))
        business = Business.objects.select_for_update().filter(pk=business_id).first()
        if business is None:
            raise NotFound("The business could not be found.")
        policy = Policy.objects.select_for_update().filter(BUSN_ID=business).first()
        if policy is None or policy.BSPO_MODE != Policy.Mode.GEMINI:
            return "already_legacy"
        policy.BSPO_MODE = Policy.Mode.LEGACY
        policy.save(update_fields=["BSPO_MODE", "BSPO_UPDATED_AT"])
        from apps.reviews.services.review_service import ReviewService

        for review in Review.objects.select_for_update().filter(BUSN_ID=business).order_by("pk"):
            snapshot = Snapshot.objects.filter(REVW_ID=review).first()
            matches = snapshot is not None and snapshot.RLSS_SOURCE_TEXT == review.REVW_TEXT
            review.REVW_SENTIMENT_SCORE = snapshot.RLSS_SCORE if matches else None
            review.REVW_SENTIMENT_LABEL = snapshot.RLSS_LABEL if matches else None
            review.REVW_IS_OUTLIER_SENTIMENT = snapshot.RLSS_OUTLIER if matches else False
            review.save(update_fields=[
                "REVW_SENTIMENT_SCORE", "REVW_SENTIMENT_LABEL",
                "REVW_IS_OUTLIER_SENTIMENT", "REVW_UPDATED_AT",
            ])
            if matches and snapshot.RLSS_RATING_RESULT is not None:
                ReviewRatingResult.objects.update_or_create(REVW_ID=review, defaults=snapshot.RLSS_RATING_RESULT)
            else:
                ReviewRatingResult.objects.filter(REVW_ID=review).delete()
            if review.REVW_STATUS == Review.ReviewStatus.PUBLISHED and (
                review.REVW_SENTIMENT_SCORE is None or review.REVW_SENTIMENT_LABEL is None
            ):
                ReviewService._queue_sentiment_after_commit(review.pk, business_id)
        Snapshot.objects.filter(REVW_ID__BUSN_ID=business).delete()
        version = policy.BSPO_PREVIOUS_RATING_VERSION or BusinessRatingService.LEGACY_VERSION
        BusinessRatingService.recompute(business_id, version, allow_legacy=True)
        BusinessReviewSummaryService.recompute_sentiment(business_id)
        return "rolled_back"
