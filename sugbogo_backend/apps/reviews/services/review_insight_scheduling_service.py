"""Record input changes and recover debounced work independently of broker delivery."""

import logging
from datetime import timedelta

from django.conf import settings
from django.db import models, transaction
from django.utils import timezone

from apps.admin_operations.system_configuration.models import AnalyticsPolicyConfiguration
from apps.admin_operations.system_configuration.services.analytics_policy_service import (
    AnalyticsPolicyService,
    AnalyticsPolicyUnavailable,
)
from apps.business.models import Business
from apps.reviews.models import BusinessReviewSummary, Review, ReviewInsightRegeneration
from apps.reviews.services.business_review_summary_service import BusinessReviewSummaryService
from apps.reviews.services.review_insight_regeneration_service import (
    ReviewInsightRegenerationService,
)
from apps.reviews.services.review_keyword_service import ReviewKeywordService

logger = logging.getLogger(__name__)


class ReviewInsightSchedulingService:
    """Own lifecycle eligibility, immediate safety, and bounded due-work discovery."""

    BATCH_SIZE = 100
    PROVIDER_TIMEOUT_MAX_SECONDS = 300
    LEASE_MARGIN_SECONDS = 120

    @staticmethod
    def review_input(
        review,
        reference_time=None,
    ):
        """Return precisely the published, creation-windowed, stripped narrative input."""
        reference_time = reference_time or timezone.now()
        if (
            review.REVW_STATUS != Review.ReviewStatus.PUBLISHED
            or review.REVW_CREATED_AT < reference_time - timedelta(
                days=BusinessReviewSummaryService.WINDOW_DAYS,
            )
            or review.REVW_CREATED_AT > reference_time
            or not review.REVW_TEXT.strip()
        ):
            return None
        return review.REVW_ID, review.REVW_TEXT.strip()

    @staticmethod
    @transaction.atomic
    def review_changed(
        business_id,
        previous_input,
        current_input,
    ):
        """Record each meaningful lifecycle transition inside its mutation transaction."""
        if previous_input == current_input:
            return False
        changed_review_id = None
        if previous_input is not None:
            changed_review_id = previous_input[0]
        return ReviewInsightSchedulingService._request(
            business_id,
            force_change=True,
            changed_review_id=changed_review_id,
        )

    @staticmethod
    @transaction.atomic
    def reconcile(
        business_id,
    ):
        """Detect missed input changes without resetting already recorded demand."""
        if not Business.objects.filter(pk=business_id).exists():
            return "missing"
        return ReviewInsightSchedulingService._request(business_id)

    @staticmethod
    def _request(
        business_id,
        force_change=False,
        changed_review_id=None,
    ):
        """Lock policy, demand, then summary before comparing authoritative inputs."""
        try:
            configuration = (
                AnalyticsPolicyConfiguration.objects
                .select_for_update()
                .get(pk=1)
            )
        except AnalyticsPolicyConfiguration.DoesNotExist:
            raise AnalyticsPolicyUnavailable() from None
        policy = AnalyticsPolicyService.snapshot(configuration)
        record = ReviewInsightRegenerationService.get_or_create(business_id)
        reviews = ReviewKeywordService._snapshot(business_id)
        earliest = None
        if reviews:
            earliest = Review.objects.values_list("REVW_CREATED_AT", flat=True).get(
                pk=reviews[0][0],
            )
        record.RIRG_RECHECK_AT = None
        if earliest is not None:
            record.RIRG_RECHECK_AT = earliest + timedelta(
                days=BusinessReviewSummaryService.WINDOW_DAYS,
                microseconds=1,
            )
        record.save(update_fields=["RIRG_RECHECK_AT", "RIRG_UPDATED_AT"])
        fingerprint = ReviewKeywordService._fingerprint(reviews, policy=policy)
        outstanding = record.RIRG_REQUESTED_REVISION > record.RIRG_COMPLETED_REVISION
        changed = (
            force_change
            or fingerprint != record.RIRG_INPUT_FINGERPRINT
        )
        if not changed and not outstanding:
            summary = (
                BusinessReviewSummary.objects
                .select_for_update()
                .filter(BUSN_ID_id=business_id)
                .first()
            )
            changed = (
                summary is None
                or summary.BRSU_KEYWORDS_FINGERPRINT != fingerprint
                or summary.BRSU_GENERATION_STATE not in {
                    BusinessReviewSummary.GenerationState.READY,
                    BusinessReviewSummary.GenerationState.INSUFFICIENT_REVIEWS,
                }
                or (
                    summary.BRSU_GENERATION_STATE == BusinessReviewSummary.GenerationState.READY
                    and not summary.BRSU_NARRATIVE.strip()
                )
            )
        if not changed:
            if outstanding:
                return "pending"
            return "unchanged"
        # Adopt requests recorded before fingerprint tracking without inventing
        # another mutation or moving their existing quiet deadline.
        if (
            force_change
            or not outstanding
            or record.RIRG_INPUT_FINGERPRINT
        ):
            ReviewInsightRegenerationService.record_change(business_id)
        record.RIRG_INPUT_FINGERPRINT = fingerprint
        record.save(update_fields=["RIRG_INPUT_FINGERPRINT", "RIRG_UPDATED_AT"])
        with ReviewInsightRegenerationService.safety_updates(business_id):
            summary = (
                BusinessReviewSummary.objects
                .select_for_update()
                .filter(BUSN_ID_id=business_id)
                .first()
            )
            if summary is not None:
                invalidate_evidence = False
                if (
                    not force_change
                    and summary.BRSU_KEYWORDS_FINGERPRINT != fingerprint
                ):
                    # Reconstructing the entire original input proves retention
                    # safety only; publication still requires the current window.
                    historical_time = summary.BRSU_COVERAGE_END
                    invalidate_evidence = (
                        historical_time is None
                        or ReviewKeywordService._fingerprint(
                            ReviewKeywordService._snapshot(business_id, historical_time),
                            policy=policy,
                        ) != summary.BRSU_KEYWORDS_FINGERPRINT
                    )
                if changed_review_id is not None:
                    ReviewKeywordService.remove_review_evidence(
                        business_id,
                        changed_review_id,
                    )
                ReviewKeywordService._mark_failed_generation(
                    business_id,
                    timezone.now(),
                    invalidate_evidence=invalidate_evidence,
                )
                summary.refresh_from_db()
                summary.BRSU_ELIGIBLE_REVIEW_COUNT = len(reviews)
                if len(reviews) < policy["narrative_min_eligible_reviews"]:
                    summary.BRSU_GENERATION_STATE = (
                        BusinessReviewSummary.GenerationState.INSUFFICIENT_REVIEWS
                    )
                summary.save(
                    update_fields=[
                        "BRSU_ELIGIBLE_REVIEW_COUNT",
                        "BRSU_GENERATION_STATE",
                        "BRSU_UPDATED_AT",
                    ],
                )
        return "queued"

    @staticmethod
    def policy_changed():
        """Persist policy-driven demand in the configuration transaction's lock order."""
        business_ids = (
            Business.objects
            .filter(
                models.Q(review_summary__isnull=False)
                | models.Q(reviews__REVW_STATUS=Review.ReviewStatus.PUBLISHED)
                | models.Q(review_insight_regeneration__isnull=False),
            )
            .order_by("BUSN_ID")
            .values_list("BUSN_ID", flat=True)
            .distinct()
        )
        for business_id in business_ids:
            ReviewInsightSchedulingService.reconcile(business_id)

    @staticmethod
    def lease_seconds():
        """Bound one HTTP timeout plus parsing and publication recovery headroom."""
        timeout = settings.GEMINI_TIMEOUT_SECONDS
        if not (
            1 <= timeout <= ReviewInsightSchedulingService.PROVIDER_TIMEOUT_MAX_SECONDS
        ):
            raise ValueError("Coordinated Gemini timeout must be between 1 and 300 seconds.")
        return timeout + ReviewInsightSchedulingService.LEASE_MARGIN_SECONDS

    @staticmethod
    def recover_and_dispatch():
        """Recover bounded committed work before publishing expendable processing hints."""
        from apps.reviews.tasks import process_review_insight_regeneration

        ReviewInsightRegenerationService._require_autocommit()
        limit = ReviewInsightSchedulingService.BATCH_SIZE
        expired_ids = list(
            ReviewInsightRegenerationService.outstanding_work()
            .filter(
                RIRG_ATTEMPT_TOKEN__isnull=False,
                RIRG_LEASE_EXPIRES_AT__lte=timezone.now(),
            )
            .order_by("RIRG_LEASE_EXPIRES_AT", "RIRG_ID")
            .values_list("BUSN_ID_id", flat=True)[:limit]
        )
        for business_id in expired_ids:
            ReviewInsightRegenerationService.recover_expired(business_id)
        expiring_ids = list(
            ReviewInsightRegeneration.objects
            .filter(RIRG_RECHECK_AT__lte=timezone.now())
            .order_by("RIRG_RECHECK_AT", "RIRG_ID")
            .values_list("BUSN_ID_id", flat=True)[:limit]
        )
        for business_id in expiring_ids:
            ReviewInsightSchedulingService.reconcile(business_id)
        unobserved_ids = list(
            ReviewInsightRegenerationService.unobserved_work()
            .values_list("BUSN_ID_id", flat=True)[:limit]
        )
        for business_id in unobserved_ids:
            ReviewInsightRegenerationService.observe_changes(business_id)
        due_ids = list(
            ReviewInsightRegenerationService.due_work()
            .values_list("BUSN_ID_id", flat=True)[:limit]
        )
        dispatched = 0
        for business_id in due_ids:
            try:
                process_review_insight_regeneration.apply_async(
                    args=[business_id],
                    expires=30,
                    retry=False,
                )
                dispatched += 1
            except Exception:
                logger.warning(
                    "Review insight delivery failed; durable demand remains due. business_id=%s",
                    business_id,
                )
                break
        return {
            "observed": len(unobserved_ids),
            "recovered": len(expired_ids),
            "dispatched": dispatched,
        }

    @staticmethod
    def process(
        business_id,
    ):
        """Claim at execution time so delayed or duplicate messages cannot own stale work."""
        from apps.reviews.services.business_review_insights_service import BusinessReviewInsightsService

        ReviewInsightRegenerationService._require_autocommit()
        claim = ReviewInsightRegenerationService.claim(
            business_id,
            lease_seconds=ReviewInsightSchedulingService.lease_seconds(),
        )
        if claim is None:
            return "not_due"
        return BusinessReviewInsightsService.refresh_claim(claim)["generation_outcome"]
