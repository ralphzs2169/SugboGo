import logging
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.admin_operations.system_configuration.models import (
    AnalyticsPolicyConfiguration,
)
from apps.admin_operations.system_configuration.services.analytics_policy_service import (
    AnalyticsPolicyService,
)
from apps.reviews.models import BusinessReviewSummary, Review, ReviewInsightRegeneration
from apps.reviews.services.business_review_summary_service import BusinessReviewSummaryService
from apps.reviews.services.review_insight_regeneration_service import (
    ReviewInsightRegenerationService,
)
from apps.reviews.services.review_keyword_service import (
    InvalidKeywordResponse,
    RetryableKeywordError,
    ReviewKeywordService,
)
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
    """Route refresh demand and publish claimed narratives independently of sentiment."""

    @staticmethod
    def refresh(
        business_id: int,
        retry_keywords_only: bool = False,
        reference_time=None,
    ) -> dict:
        """Keep legacy callers on durable reconciliation instead of direct generation."""
        from apps.reviews.services.review_insight_scheduling_service import (
            ReviewInsightSchedulingService,
        )

        outcome = ReviewInsightSchedulingService.reconcile(business_id)
        if (
            not retry_keywords_only
            and outcome != "missing"
        ):
            def publish_sentiment():
                """Preserve full administrator refresh without coupling it to generation."""
                from apps.reviews.tasks import reconcile_business_review_sentiment

                try:
                    reconcile_business_review_sentiment.apply_async(
                        args=[business_id],
                        retry=False,
                    )
                except Exception as exc:
                    logger.warning(
                        "Business sentiment delivery failed; daily reconciliation remains available. "
                        "business_id=%s error_type=%s",
                        business_id,
                        type(exc).__name__,
                    )

            transaction.on_commit(publish_sentiment, robust=True)
        return {
            "business_id": business_id,
            "sentiment_recomputed": False,
            "generation_outcome": outcome,
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
        generation_context = {}
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
                        generation_context,
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
                        cls._fail_claim(
                            claim,
                            outcome,
                            generation_context.get("fingerprint"),
                        )
                except (RetryableKeywordError, TimeoutError, ConnectionError):
                    outcome = "provider_unavailable"
                    cls._fail_claim(
                        claim,
                        outcome,
                        generation_context.get("fingerprint"),
                    )
                except InvalidKeywordResponse:
                    outcome = "invalid_response"
                    cls._fail_claim(
                        claim,
                        outcome,
                        generation_context.get("fingerprint"),
                    )
                except Exception as exc:
                    logger.warning(
                        "Coordinated review insight evaluation failed. "
                        "business_id=%s error_type=%s",
                        business_id,
                        type(exc).__name__,
                    )
                    outcome = "failed"
                    cls._fail_claim(
                        claim,
                        outcome,
                        generation_context.get("fingerprint"),
                    )
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
        fingerprint,
        reviews,
    ):
        """Force publication rollback rather than committing a failed acknowledgement."""
        recheck_at = None
        if reviews:
            earliest = Review.objects.values_list("REVW_CREATED_AT", flat=True).get(
                pk=reviews[0][0],
            )
            recheck_at = earliest + timedelta(
                days=BusinessReviewSummaryService.WINDOW_DAYS,
                microseconds=1,
            )
        if not ReviewInsightRegenerationService.acknowledge_evaluation(
            business_id,
            revision,
            attempt_token,
            input_fingerprint=fingerprint,
            recheck_at=recheck_at,
        ):
            raise _RejectedInsightEvaluation("superseded")

    @classmethod
    def _evaluate_claim(
        cls,
        business_id,
        revision,
        attempt_token,
        generation_context,
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
            generation_context["fingerprint"] = fingerprint
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
                    fingerprint,
                    reviews,
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
                    fingerprint,
                    reviews,
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
                fingerprint,
                reviews,
            )
            return outcome

    @staticmethod
    @transaction.atomic
    def _fail_claim(
        claim,
        error_code,
        expected_fingerprint=None,
    ):
        """Persist backoff and summary failure only while the original claim is current."""
        retry_after = min(
            60 * (2 ** min(max(claim.RIRG_ATTEMPTS - 1, 0), 3)),
            300,
        )
        record = ReviewInsightRegenerationService.lock_current_attempt(
            claim.BUSN_ID_id,
            claim.RIRG_CLAIMED_REVISION,
            claim.RIRG_ATTEMPT_TOKEN,
        )
        if record is not None:
            summary = (
                BusinessReviewSummary.objects
                .select_for_update()
                .filter(BUSN_ID_id=claim.BUSN_ID_id)
                .first()
            )
            if summary is not None:
                invalidate_evidence = False
                policy = AnalyticsPolicyService.read()
                if (
                    expected_fingerprint is not None
                    and ReviewKeywordService._fingerprint(
                        ReviewKeywordService._snapshot(claim.BUSN_ID_id),
                        policy=policy,
                    ) != expected_fingerprint
                ):
                    historical_time = summary.BRSU_COVERAGE_END
                    invalidate_evidence = (
                        historical_time is None
                        or ReviewKeywordService._fingerprint(
                            ReviewKeywordService._snapshot(
                                claim.BUSN_ID_id,
                                historical_time,
                            ),
                            policy=policy,
                        ) != summary.BRSU_KEYWORDS_FINGERPRINT
                    )
                ReviewKeywordService._mark_failed_generation(
                    claim.BUSN_ID_id,
                    timezone.now(),
                    retryable=True,
                    invalidate_evidence=invalidate_evidence,
                )
            if not ReviewInsightRegenerationService.record_failure(
                claim.BUSN_ID_id,
                claim.RIRG_CLAIMED_REVISION,
                claim.RIRG_ATTEMPT_TOKEN,
                error_code,
                retry_after_seconds=retry_after,
            ):
                raise _RejectedInsightEvaluation("superseded")
        else:
            ReviewInsightRegenerationService.release_claim(
                claim.BUSN_ID_id,
                claim.RIRG_CLAIMED_REVISION,
                claim.RIRG_ATTEMPT_TOKEN,
            )
