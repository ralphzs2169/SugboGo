import logging

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.admin_operations.system_configuration.models import (
    AnalyticsPolicyConfiguration,
)
from apps.admin_operations.system_configuration.services.analytics_policy_service import (
    AnalyticsPolicyService,
)
from apps.reviews.models import BusinessReviewSummary, ReviewInsightRegeneration
from apps.reviews.services.business_review_summary_service import (
    BusinessReviewSummaryService,
)
from apps.reviews.services.review_insight_regeneration_service import (
    ReviewInsightRegenerationService,
)
from apps.reviews.services.review_keyword_service import (
    InvalidKeywordResponse,
    RetryableKeywordError,
    ReviewKeywordService,
)
from apps.reviews.services.review_sentiment_service import ReviewSentimentService
from apps.shared.analytics.policy import current_policy, with_policy_snapshot

logger = logging.getLogger(__name__)


class _RejectedInsightEvaluation(Exception):
    """Roll back every publication write when evaluation cannot be acknowledged."""

    def __init__(
        self,
        outcome,
    ):
        """Retain the controlled recovery outcome without provider or review data."""
        self.outcome = outcome
        super().__init__(outcome)


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
            ReviewSentimentService.reconcile_business(
                business_id,
                reference_time=reference_time,
            )
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

    @classmethod
    @with_policy_snapshot
    def refresh_claim(
        cls,
        claim: ReviewInsightRegeneration,
    ) -> dict:
        """Evaluate durable demand without coupling narrative generation to sentiment."""
        ReviewInsightRegenerationService._require_autocommit()
        business_id = claim.BUSN_ID_id
        revision = claim.RIRG_CLAIMED_REVISION
        attempt_token = claim.RIRG_ATTEMPT_TOKEN
        with ReviewKeywordService.generation_lock(business_id) as acquired:
            if not acquired:
                # A duplicate carrying the same token must not revoke its worker.
                outcome = "busy"
            else:
                try:
                    outcome = cls._evaluate_claim(
                        business_id,
                        revision,
                        attempt_token,
                    )
                except _RejectedInsightEvaluation as exc:
                    outcome = exc.outcome
                    if outcome == "superseded":
                        ReviewInsightRegenerationService.release_claim(
                            business_id,
                            revision,
                            attempt_token,
                        )
                    else:
                        cls._fail_claim(claim, outcome)
                except (RetryableKeywordError, TimeoutError, ConnectionError):
                    outcome = "provider_unavailable"
                    cls._fail_claim(claim, outcome)
                except InvalidKeywordResponse:
                    outcome = "invalid_response"
                    cls._fail_claim(claim, outcome)
                except Exception as exc:
                    logger.warning(
                        "Coordinated review insight evaluation failed. "
                        "business_id=%s error_type=%s",
                        business_id,
                        type(exc).__name__,
                    )
                    outcome = "failed"
                    cls._fail_claim(claim, outcome)
        return {
            "business_id": business_id,
            "sentiment_recomputed": False,
            "generation_outcome": outcome,
        }

    @staticmethod
    def _claim_summary(
        business_id,
        revision,
        attempt_token,
    ):
        """Lock policy, coordinator, then summary for short fenced write phases."""
        configuration = (
            AnalyticsPolicyConfiguration.objects
            .select_for_update()
            .get(pk=1)
        )
        record = ReviewInsightRegenerationService.lock_current_attempt(
            business_id,
            revision,
            attempt_token,
        )
        if record is None:
            raise _RejectedInsightEvaluation("superseded")
        if (
            AnalyticsPolicyService.snapshot(configuration).review_rules
            != current_policy().review_rules
        ):
            raise _RejectedInsightEvaluation("stale")
        summary, _ = (
            BusinessReviewSummary.objects
            .select_for_update()
            .get_or_create(BUSN_ID_id=business_id)
        )
        return summary

    @staticmethod
    def _acknowledge_claim(
        business_id,
        revision,
        attempt_token,
    ):
        """Force publication rollback rather than committing a failed acknowledgement."""
        if not ReviewInsightRegenerationService.acknowledge_evaluation(
            business_id,
            revision,
            attempt_token,
        ):
            raise _RejectedInsightEvaluation("superseded")

    @classmethod
    def _evaluate_claim(
        cls,
        business_id,
        revision,
        attempt_token,
    ):
        """Prepare and publish under locks while keeping the provider call outside SQL."""
        with transaction.atomic():
            summary = cls._claim_summary(
                business_id,
                revision,
                attempt_token,
            )
            reference_time = timezone.now()
            reviews = ReviewKeywordService._snapshot(business_id, reference_time)
            fingerprint = ReviewKeywordService._fingerprint(reviews)
            if len(reviews) < current_policy()["narrative_min_eligible_reviews"]:
                outcome = ReviewKeywordService._store_insufficient(
                    business_id,
                    reference_time,
                    fingerprint,
                    len(reviews),
                )
                if outcome == "stale":
                    raise _RejectedInsightEvaluation("stale")
                cls._acknowledge_claim(
                    business_id,
                    revision,
                    attempt_token,
                )
                return outcome
            if ReviewKeywordService.has_current_content(
                summary,
                reviews,
                fingerprint,
            ):
                summary.BRSU_GENERATION_STATE = BusinessReviewSummary.GenerationState.READY
                summary.save(
                    update_fields=["BRSU_GENERATION_STATE", "BRSU_UPDATED_AT"],
                )
                cls._acknowledge_claim(
                    business_id,
                    revision,
                    attempt_token,
                )
                return "unchanged"
            if not settings.GEMINI_API_KEY.strip():
                raise _RejectedInsightEvaluation("unconfigured")
            selected = ReviewKeywordService._select_reviews(reviews)
            summary.BRSU_KEYWORDS_ATTEMPTED_AT = timezone.now()
            summary.BRSU_KEYWORDS_ATTEMPT_FINGERPRINT = fingerprint
            summary.BRSU_KEYWORDS_RETRYABLE = False
            summary.BRSU_GENERATION_STATE = BusinessReviewSummary.GenerationState.PENDING
            summary.save(
                update_fields=[
                    "BRSU_KEYWORDS_ATTEMPTED_AT",
                    "BRSU_KEYWORDS_ATTEMPT_FINGERPRINT",
                    "BRSU_KEYWORDS_RETRYABLE",
                    "BRSU_GENERATION_STATE",
                    "BRSU_UPDATED_AT",
                ],
            )

        generated = ReviewKeywordService._parse(
            ReviewKeywordService._generate(selected),
            selected,
        )

        with transaction.atomic():
            cls._claim_summary(
                business_id,
                revision,
                attempt_token,
            )
            # Re-evaluate the live window, including expiration while Gemini ran.
            publication_time = timezone.now()
            if ReviewKeywordService._fingerprint(
                ReviewKeywordService._snapshot(business_id, publication_time),
            ) != fingerprint:
                raise _RejectedInsightEvaluation("stale")
            outcome = ReviewKeywordService._store(
                business_id,
                publication_time,
                fingerprint,
                reviews,
                selected,
                generated,
                publication_time,
            )
            if outcome != "updated":
                raise _RejectedInsightEvaluation("stale")
            cls._acknowledge_claim(
                business_id,
                revision,
                attempt_token,
            )
            return outcome

    @staticmethod
    @transaction.atomic
    def _fail_claim(
        claim,
        error_code,
    ):
        """Persist backoff and summary failure only while the original claim is current."""
        retry_after = min(
            60 * (2 ** min(max(claim.RIRG_ATTEMPTS - 1, 0), 3)),
            300,
        )
        recorded = ReviewInsightRegenerationService.record_failure(
            claim.BUSN_ID_id,
            claim.RIRG_CLAIMED_REVISION,
            claim.RIRG_ATTEMPT_TOKEN,
            error_code,
            retry_after_seconds=retry_after,
        )
        if recorded:
            if BusinessReviewSummary.objects.filter(
                BUSN_ID_id=claim.BUSN_ID_id,
            ).exists():
                ReviewKeywordService._mark_failed_generation(
                    claim.BUSN_ID_id,
                    timezone.now(),
                    retryable=True,
                )
        else:
            ReviewInsightRegenerationService.release_claim(
                claim.BUSN_ID_id,
                claim.RIRG_CLAIMED_REVISION,
                claim.RIRG_ATTEMPT_TOKEN,
            )
