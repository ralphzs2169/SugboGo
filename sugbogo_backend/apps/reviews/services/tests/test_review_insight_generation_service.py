import json
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Event
from unittest.mock import patch
from uuid import uuid4

from django.db import connection, connections, transaction
from django.test import TransactionTestCase, override_settings
from django.utils import timezone

from apps.admin_operations.system_configuration.models import (
    AnalyticsPolicyConfiguration,
)
from apps.reviews.models import BusinessReviewSummary, Review, ReviewInsightRegeneration
from apps.reviews.services.business_review_insights_service import (
    BusinessReviewInsightsService,
)
from apps.reviews.services.review_insight_regeneration_service import (
    ReviewInsightRegenerationService,
)
from apps.reviews.services.review_keyword_service import (
    RetryableKeywordError,
    ReviewKeywordService,
)
from apps.reviews.services.review_sentiment_service import ReviewSentimentService
from apps.reviews.services.tests.test_business_review_summary_service import (
    SummaryFixtureMixin,
)
from apps.reviews.tasks import process_review_sentiment


@override_settings(GEMINI_API_KEY="test-only-key", GEMINI_KEYWORD_MODEL="test-model")
class ReviewInsightGenerationServiceTests(SummaryFixtureMixin, TransactionTestCase):
    def setUp(self):
        AnalyticsPolicyConfiguration.objects.get_or_create(pk=1)
        self.business = self.create_business()
        self.reviews = [
            self.create_review(self.business, index)
            for index in range(5)
        ]
        self.summary = BusinessReviewSummary.objects.create(BUSN_ID=self.business)
        self.clock = patch(
            "django.utils.timezone.now",
            return_value=timezone.now(),
        ).start()
        self.provider = patch.object(
            ReviewKeywordService,
            "_generate",
            return_value=self.response(),
        ).start()
        self.addCleanup(patch.stopall)

    def response(self):
        return json.dumps({
            "narrative": "Visitors mention friendly service.",
            "narrative_review_ids": [self.reviews[0].pk, self.reviews[1].pk],
            "tags": [{
                "text": "friendly service",
                "count": 2,
                "review_ids": [self.reviews[0].pk, self.reviews[1].pk],
            }],
        })

    def advance(
        self,
        seconds,
    ):
        self.clock.return_value += timedelta(seconds=seconds)

    def request_claim(self):
        ReviewInsightRegenerationService.record_change(self.business.pk)
        self.advance(120)
        return ReviewInsightRegenerationService.claim(
            self.business.pk,
            lease_seconds=300,
        )

    def state(self):
        return ReviewInsightRegeneration.objects.get(BUSN_ID=self.business)

    def evaluate(
        self,
        claim,
    ):
        return BusinessReviewInsightsService.refresh_claim(claim)["generation_outcome"]

    def test_success_commits_publication_and_acknowledgement_together(self):
        claim = self.request_claim()

        def generate(reviews):
            self.assertFalse(connection.in_atomic_block)
            self.assertEqual(len(reviews), 5)
            self.assertEqual(self.state().RIRG_COMPLETED_REVISION, 0)
            return self.response()

        self.provider.side_effect = generate
        self.assertEqual(self.evaluate(claim), "updated")
        self.summary.refresh_from_db()
        self.assertEqual(self.summary.BRSU_NARRATIVE, "Visitors mention friendly service.")
        self.assertEqual(self.summary.BRSU_GENERATION_STATE, "ready")
        self.assertEqual(self.summary.BRSU_GENERATED_AT, self.clock.return_value)
        self.assertEqual(self.state().RIRG_COMPLETED_REVISION, 1)
        self.assertIsNone(self.state().RIRG_ATTEMPT_TOKEN)

    def test_failed_acknowledgement_rolls_back_publication(self):
        claim = self.request_claim()
        with patch.object(
            ReviewInsightRegenerationService,
            "acknowledge_evaluation",
            return_value=False,
        ):
            self.assertEqual(self.evaluate(claim), "superseded")
        self.summary.refresh_from_db()
        self.assertEqual(self.summary.BRSU_NARRATIVE, "")
        self.assertIsNone(self.summary.BRSU_GENERATED_AT)
        self.assertEqual(self.state().RIRG_COMPLETED_REVISION, 0)

    def test_publication_error_rolls_back_without_acknowledging(self):
        claim = self.request_claim()
        original = ReviewKeywordService._store

        def fail_after_write(*args):
            original(*args)
            raise RuntimeError("publication failed")

        with patch.object(ReviewKeywordService, "_store", side_effect=fail_after_write):
            self.assertEqual(self.evaluate(claim), "failed")
        self.summary.refresh_from_db()
        self.assertEqual(self.summary.BRSU_NARRATIVE, "")
        self.assertIsNone(self.summary.BRSU_GENERATED_AT)
        self.assertEqual(self.state().RIRG_COMPLETED_REVISION, 0)
        self.assertEqual(self.state().RIRG_LAST_ERROR, "failed")

    def test_duplicate_completion_cannot_change_successful_summary(self):
        claim = self.request_claim()
        self.assertEqual(self.evaluate(claim), "updated")
        before = BusinessReviewSummary.objects.values().get(pk=self.summary.pk)
        self.assertEqual(self.evaluate(claim), "superseded")
        self.assertEqual(
            BusinessReviewSummary.objects.values().get(pk=self.summary.pk),
            before,
        )
        self.provider.assert_called_once()

    def test_unauthorized_token_cannot_start_provider_or_change_state(self):
        claim = self.request_claim()
        claim.RIRG_ATTEMPT_TOKEN = uuid4()
        before = self.state().RIRG_ATTEMPT_TOKEN
        self.assertEqual(self.evaluate(claim), "superseded")
        self.assertEqual(self.state().RIRG_ATTEMPT_TOKEN, before)
        self.provider.assert_not_called()

    def test_new_revision_during_provider_execution_fences_publication(self):
        claim = self.request_claim()

        def generate(_reviews):
            Review.objects.filter(pk=self.reviews[-1].pk).update(REVW_TEXT="Changed.")
            ReviewInsightRegenerationService.record_change(self.business.pk)
            return self.response()

        self.provider.side_effect = generate
        self.assertEqual(self.evaluate(claim), "superseded")
        self.summary.refresh_from_db()
        self.assertEqual(self.summary.BRSU_NARRATIVE, "")
        self.assertEqual(self.state().RIRG_REQUESTED_REVISION, 2)
        self.assertEqual(self.state().RIRG_COMPLETED_REVISION, 0)
        self.assertIsNone(self.state().RIRG_ATTEMPT_TOKEN)

    def test_lease_expiring_during_provider_execution_fences_publication(self):
        claim = self.request_claim()

        def generate(_reviews):
            self.advance(300)
            return self.response()

        self.provider.side_effect = generate
        self.assertEqual(self.evaluate(claim), "superseded")
        self.summary.refresh_from_db()
        self.assertEqual(self.summary.BRSU_NARRATIVE, "")
        self.assertEqual(self.state().RIRG_COMPLETED_REVISION, 0)
        self.assertTrue(ReviewInsightRegenerationService.recover_expired(self.business.pk))
        self.assertIsNotNone(
            ReviewInsightRegenerationService.claim(self.business.pk, lease_seconds=300),
        )

    def test_old_failure_after_new_success_cannot_downgrade_summary_or_work(self):
        old = self.request_claim()
        self.advance(300)
        current = ReviewInsightRegenerationService.claim(
            self.business.pk,
            lease_seconds=300,
        )
        self.assertEqual(self.evaluate(current), "updated")
        summary_before = BusinessReviewSummary.objects.values().get(pk=self.summary.pk)
        state_before = ReviewInsightRegeneration.objects.values().get(pk=current.pk)
        BusinessReviewInsightsService._fail_claim(old, "provider_unavailable")
        self.assertEqual(
            BusinessReviewSummary.objects.values().get(pk=self.summary.pk),
            summary_before,
        )
        self.assertEqual(
            ReviewInsightRegeneration.objects.values().get(pk=current.pk),
            state_before,
        )

    def test_same_day_change_and_revert_with_invalidated_support_regenerates(self):
        self.assertEqual(self.evaluate(self.request_claim()), "updated")
        self.summary.refresh_from_db()
        original_fingerprint = self.summary.BRSU_KEYWORDS_FINGERPRINT
        review = self.reviews[0]
        Review.objects.filter(pk=review.pk).update(REVW_TEXT="Changed supporting text.")
        ReviewKeywordService.remove_review_evidence(self.business.pk, review.pk)
        ReviewInsightRegenerationService.record_change(self.business.pk)
        Review.objects.filter(pk=review.pk).update(REVW_TEXT=review.REVW_TEXT)
        ReviewInsightRegenerationService.record_change(self.business.pk)
        self.advance(120)
        claim = ReviewInsightRegenerationService.claim(self.business.pk, lease_seconds=300)
        self.assertEqual(self.evaluate(claim), "updated")
        self.summary.refresh_from_db()
        self.assertEqual(self.summary.BRSU_KEYWORDS_FINGERPRINT, original_fingerprint)
        self.assertEqual(self.provider.call_count, 2)
        self.assertEqual(self.state().RIRG_COMPLETED_REVISION, 3)

    def test_matching_fingerprint_with_cleared_content_requires_generation(self):
        self.assertEqual(self.evaluate(self.request_claim()), "updated")
        BusinessReviewSummary.objects.filter(pk=self.summary.pk).update(
            BRSU_NARRATIVE="",
            BRSU_KEYWORD_TAGS=[],
            BRSU_SUPPORTING_REVIEW_REFERENCES={},
            BRSU_GENERATED_AT=None,
            BRSU_GENERATION_STATE="outdated",
        )
        self.assertEqual(self.evaluate(self.request_claim()), "updated")
        self.assertEqual(self.provider.call_count, 2)

    def test_matching_valid_retained_content_acknowledges_without_new_generation(self):
        self.assertEqual(self.evaluate(self.request_claim()), "updated")
        self.summary.refresh_from_db()
        generated_at = self.summary.BRSU_GENERATED_AT
        processed_at = self.summary.BRSU_KEYWORDS_PROCESSED_AT
        BusinessReviewSummary.objects.filter(pk=self.summary.pk).update(
            BRSU_GENERATION_STATE="outdated",
        )
        self.assertEqual(self.evaluate(self.request_claim()), "unchanged")
        self.summary.refresh_from_db()
        self.assertEqual(self.summary.BRSU_GENERATED_AT, generated_at)
        self.assertEqual(self.summary.BRSU_KEYWORDS_PROCESSED_AT, processed_at)
        self.assertEqual(self.summary.BRSU_GENERATION_STATE, "ready")
        self.assertEqual(self.state().RIRG_COMPLETED_REVISION, 2)
        self.provider.assert_called_once()

    def test_stale_snapshot_is_retryable_and_next_claim_can_complete(self):
        claim = self.request_claim()

        def generate(_reviews):
            Review.objects.filter(pk=self.reviews[-1].pk).update(REVW_TEXT="Changed.")
            return self.response()

        self.provider.side_effect = generate
        self.assertEqual(self.evaluate(claim), "stale")
        self.assertEqual(self.state().RIRG_LAST_ERROR, "stale")
        self.assertEqual(self.state().RIRG_COMPLETED_REVISION, 0)
        self.assertIsNone(self.state().RIRG_ATTEMPT_TOKEN)
        self.assertIsNone(ReviewInsightRegenerationService.claim(self.business.pk, 300))
        self.advance(60)
        retry = ReviewInsightRegenerationService.claim(self.business.pk, 300)
        self.provider.side_effect = None
        self.assertEqual(self.evaluate(retry), "updated")

    def test_provider_failures_and_invalid_output_persist_recoverable_backoff(self):
        for failure, outcome in [
            (RetryableKeywordError("timeout"), "provider_unavailable"),
            (TimeoutError(), "provider_unavailable"),
            (RuntimeError("provider failure"), "failed"),
            ("not JSON", "invalid_response"),
        ]:
            with self.subTest(outcome=outcome):
                claim = self.request_claim()
                if isinstance(failure, Exception):
                    self.provider.side_effect = failure
                else:
                    self.provider.side_effect = None
                    self.provider.return_value = failure
                self.assertEqual(self.evaluate(claim), outcome)
                state = self.state()
                self.assertEqual(state.RIRG_COMPLETED_REVISION, 0)
                self.assertEqual(state.RIRG_LAST_ERROR, outcome)
                self.assertGreater(state.RIRG_RETRY_NOT_BEFORE, self.clock.return_value)
                self.assertIsNone(state.RIRG_ATTEMPT_TOKEN)
                self.advance(300)

    @override_settings(GEMINI_API_KEY="")
    def test_missing_configuration_leaves_recoverable_work_without_provider_attempt(self):
        self.assertEqual(self.evaluate(self.request_claim()), "unconfigured")
        self.assertEqual(self.state().RIRG_COMPLETED_REVISION, 0)
        self.assertEqual(self.state().RIRG_LAST_ERROR, "unconfigured")
        self.summary.refresh_from_db()
        self.assertIsNone(self.summary.BRSU_KEYWORDS_ATTEMPTED_AT)
        self.provider.assert_not_called()

    def test_insufficient_reviews_clear_bundle_and_acknowledge_without_gemini(self):
        self.reviews[-1].delete()
        self.assertEqual(self.evaluate(self.request_claim()), "insufficient_reviews")
        self.summary.refresh_from_db()
        self.assertEqual(self.summary.BRSU_GENERATION_STATE, "insufficient_reviews")
        self.assertEqual(self.summary.BRSU_ELIGIBLE_REVIEW_COUNT, 4)
        self.assertIsNone(self.summary.BRSU_GENERATED_AT)
        self.assertEqual(self.state().RIRG_COMPLETED_REVISION, 1)
        self.provider.assert_not_called()

    def test_insufficient_review_publication_rolls_back_when_acknowledgement_fails(self):
        self.assertEqual(self.evaluate(self.request_claim()), "updated")
        self.reviews[-1].delete()
        claim = self.request_claim()
        before = BusinessReviewSummary.objects.values().get(pk=self.summary.pk)
        with patch.object(
            ReviewInsightRegenerationService,
            "acknowledge_evaluation",
            return_value=False,
        ):
            self.assertEqual(self.evaluate(claim), "superseded")
        self.assertEqual(
            BusinessReviewSummary.objects.values().get(pk=self.summary.pk),
            before,
        )
        self.assertEqual(self.state().RIRG_COMPLETED_REVISION, 1)

    def test_retained_content_stays_outdated_when_acknowledgement_fails(self):
        self.assertEqual(self.evaluate(self.request_claim()), "updated")
        BusinessReviewSummary.objects.filter(pk=self.summary.pk).update(
            BRSU_GENERATION_STATE="outdated",
        )
        claim = self.request_claim()
        with patch.object(
            ReviewInsightRegenerationService,
            "acknowledge_evaluation",
            return_value=False,
        ):
            self.assertEqual(self.evaluate(claim), "superseded")
        self.summary.refresh_from_db()
        self.assertEqual(self.summary.BRSU_GENERATION_STATE, "outdated")
        self.assertEqual(self.state().RIRG_COMPLETED_REVISION, 1)
        self.provider.assert_called_once()

    def test_generation_can_create_missing_summary_without_sentiment_reconciliation(self):
        self.summary.delete()
        self.assertEqual(self.evaluate(self.request_claim()), "updated")
        summary = BusinessReviewSummary.objects.get(BUSN_ID=self.business)
        self.assertIsNone(summary.BRSU_SENTIMENT_COMPUTED_AT)
        self.assertEqual(summary.BRSU_GENERATION_STATE, "ready")

    def test_window_expiration_during_generation_discards_result(self):
        claim = self.request_claim()
        Review.objects.filter(pk=self.reviews[-1].pk).update(
            REVW_CREATED_AT=self.clock.return_value - timedelta(days=30) + timedelta(seconds=1),
        )

        def generate(_reviews):
            self.advance(2)
            return self.response()

        self.provider.side_effect = generate
        self.assertEqual(self.evaluate(claim), "stale")
        self.assertEqual(self.state().RIRG_COMPLETED_REVISION, 0)
        self.summary.refresh_from_db()
        self.assertEqual(self.summary.BRSU_NARRATIVE, "")

    def test_window_expiration_below_minimum_clears_even_uncited_prior_content(self):
        self.assertEqual(self.evaluate(self.request_claim()), "updated")
        Review.objects.filter(pk=self.reviews[-2].pk).update(REVW_TEXT="Changed input.")
        claim = self.request_claim()
        Review.objects.filter(pk=self.reviews[-1].pk).update(
            REVW_CREATED_AT=self.clock.return_value - timedelta(days=30) + timedelta(seconds=1),
        )

        def generate(_reviews):
            self.advance(2)
            return self.response()

        self.provider.side_effect = generate
        self.assertEqual(self.evaluate(claim), "stale")
        self.summary.refresh_from_db()
        self.assertEqual(self.summary.BRSU_NARRATIVE, "")
        self.assertIsNone(self.summary.BRSU_GENERATED_AT)
        self.assertEqual(self.state().RIRG_COMPLETED_REVISION, 1)

    def test_provider_failure_preserves_safe_prior_content_and_generation_time(self):
        self.assertEqual(self.evaluate(self.request_claim()), "updated")
        self.summary.refresh_from_db()
        generated_at = self.summary.BRSU_GENERATED_AT
        Review.objects.filter(pk=self.reviews[-1].pk).update(REVW_TEXT="Changed input.")
        claim = self.request_claim()
        self.provider.side_effect = TimeoutError()
        self.assertEqual(self.evaluate(claim), "provider_unavailable")
        self.summary.refresh_from_db()
        self.assertEqual(self.summary.BRSU_NARRATIVE, "Visitors mention friendly service.")
        self.assertEqual(self.summary.BRSU_GENERATED_AT, generated_at)
        self.assertEqual(self.summary.BRSU_GENERATION_STATE, "outdated")
        self.assertEqual(self.state().RIRG_COMPLETED_REVISION, 1)

    def test_deleted_supporting_review_during_generation_clears_prior_content(self):
        self.create_review(self.business, 6)
        self.assertEqual(self.evaluate(self.request_claim()), "updated")
        Review.objects.filter(pk=self.reviews[-1].pk).update(REVW_TEXT="Changed input.")
        claim = self.request_claim()

        def generate(_reviews):
            response = self.response()
            self.reviews[0].delete()
            return response

        self.provider.side_effect = generate
        self.assertEqual(self.evaluate(claim), "stale")
        self.summary.refresh_from_db()
        self.assertEqual(self.summary.BRSU_NARRATIVE, "")
        self.assertEqual(self.state().RIRG_COMPLETED_REVISION, 1)

    def test_rejected_supporting_review_during_generation_clears_prior_content(self):
        self.create_review(self.business, 6)
        self.assertEqual(self.evaluate(self.request_claim()), "updated")
        Review.objects.filter(pk=self.reviews[-1].pk).update(REVW_TEXT="Changed input.")
        claim = self.request_claim()

        def generate(_reviews):
            Review.objects.filter(pk=self.reviews[0].pk).update(REVW_STATUS="rejected")
            return self.response()

        self.provider.side_effect = generate
        self.assertEqual(self.evaluate(claim), "stale")
        self.summary.refresh_from_db()
        self.assertEqual(self.summary.BRSU_NARRATIVE, "")
        self.assertEqual(self.state().RIRG_COMPLETED_REVISION, 1)

    def test_policy_change_during_generation_discards_result(self):
        self.assertEqual(self.evaluate(self.request_claim()), "updated")
        Review.objects.filter(pk=self.reviews[-1].pk).update(REVW_TEXT="Changed input.")
        claim = self.request_claim()

        def generate(_reviews):
            configuration = AnalyticsPolicyConfiguration.objects.get(pk=1)
            configuration.APC_NARRATIVE_MIN_REVIEWS = 6
            configuration.APC_VERSION += 1
            configuration.save()
            return self.response()

        self.provider.side_effect = generate
        self.assertEqual(self.evaluate(claim), "stale")
        self.assertEqual(self.state().RIRG_COMPLETED_REVISION, 1)
        self.summary.refresh_from_db()
        self.assertEqual(self.summary.BRSU_NARRATIVE, "")

    def test_irrelevant_policy_revision_does_not_discard_valid_generation(self):
        claim = self.request_claim()

        def generate(_reviews):
            configuration = AnalyticsPolicyConfiguration.objects.get(pk=1)
            configuration.APC_VERSION += 1
            configuration.save()
            return self.response()

        self.provider.side_effect = generate
        self.assertEqual(self.evaluate(claim), "updated")

    def test_sentiment_failure_does_not_block_coordinated_narrative(self):
        Review.objects.filter(BUSN_ID=self.business).update(
            REVW_SENTIMENT_LABEL=None,
            REVW_SENTIMENT_SCORE=None,
        )
        with (
            patch.object(ReviewSentimentService, "process_review", side_effect=RuntimeError()),
            patch.object(ReviewSentimentService, "reconcile_business") as reconciliation,
            patch("apps.reviews.tasks.refresh_business_review_insights.delay") as dispatch,
        ):
            self.assertEqual(process_review_sentiment(self.reviews[0].pk, self.business.pk), "failed")
            self.assertEqual(self.evaluate(self.request_claim()), "updated")
        reconciliation.assert_not_called()
        dispatch.assert_not_called()
        self.summary.refresh_from_db()
        self.assertIsNone(self.summary.BRSU_SENTIMENT_COMPUTED_AT)

    def test_worker_interruption_preserves_demand_until_expired_lease_recovery(self):
        claim = self.request_claim()
        self.provider.side_effect = KeyboardInterrupt()
        with self.assertRaises(KeyboardInterrupt):
            self.evaluate(claim)
        self.assertEqual(self.state().RIRG_COMPLETED_REVISION, 0)
        self.assertEqual(self.state().RIRG_ATTEMPT_TOKEN, claim.RIRG_ATTEMPT_TOKEN)
        self.advance(300)
        retry = ReviewInsightRegenerationService.claim(self.business.pk, 300)
        self.provider.side_effect = None
        self.assertEqual(self.evaluate(retry), "updated")

    def test_concurrent_duplicate_on_separate_connection_is_busy_without_revoking_owner(self):
        if connection.vendor != "postgresql":
            self.skipTest("Requires separate PostgreSQL sessions and advisory locks.")
        claim = self.request_claim()
        started = Event()
        finish = Event()

        def generate(_reviews):
            started.set()
            if not finish.wait(timeout=10):
                raise TimeoutError()
            return self.response()

        def run():
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT pg_backend_pid()")
                    backend_pid = cursor.fetchone()[0]
                return backend_pid, self.evaluate(claim)
            finally:
                connections.close_all()

        self.provider.side_effect = generate
        with ThreadPoolExecutor(max_workers=2) as executor:
            first = executor.submit(run)
            try:
                self.assertTrue(started.wait(timeout=10))
                second_pid, second_outcome = executor.submit(run).result(timeout=10)
                self.assertEqual(second_outcome, "busy")
                self.assertEqual(self.state().RIRG_ATTEMPT_TOKEN, claim.RIRG_ATTEMPT_TOKEN)
                self.assertEqual(self.state().RIRG_COMPLETED_REVISION, 0)
            finally:
                finish.set()
            first_pid, first_outcome = first.result(timeout=10)
        self.assertNotEqual(first_pid, second_pid)
        self.assertEqual(first_outcome, "updated")
        self.assertEqual(self.state().RIRG_COMPLETED_REVISION, 1)
        self.provider.assert_called_once()

    def test_committed_mutation_on_another_connection_fences_running_generation(self):
        if connection.vendor != "postgresql":
            self.skipTest("Requires separate PostgreSQL sessions.")
        claim = self.request_claim()
        started = Event()
        finish = Event()

        def generate(_reviews):
            started.set()
            if not finish.wait(timeout=10):
                raise TimeoutError()
            return self.response()

        def run():
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT pg_backend_pid()")
                    backend_pid = cursor.fetchone()[0]
                return backend_pid, self.evaluate(claim)
            finally:
                connections.close_all()

        self.provider.side_effect = generate
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_backend_pid()")
            mutation_pid = cursor.fetchone()[0]
        with ThreadPoolExecutor(max_workers=1) as executor:
            worker = executor.submit(run)
            try:
                self.assertTrue(started.wait(timeout=10))
                with transaction.atomic():
                    Review.objects.filter(pk=self.reviews[0].pk).update(
                        REVW_TEXT="Changed supporting text.",
                    )
                    ReviewInsightRegenerationService.record_change(self.business.pk)
                    ReviewKeywordService.remove_review_evidence(
                        self.business.pk,
                        self.reviews[0].pk,
                    )
            finally:
                finish.set()
            generation_pid, outcome = worker.result(timeout=10)
        self.assertNotEqual(generation_pid, mutation_pid)
        self.assertEqual(outcome, "superseded")
        self.summary.refresh_from_db()
        self.assertEqual(self.summary.BRSU_NARRATIVE, "")
        self.assertEqual(self.state().RIRG_COMPLETED_REVISION, 0)
        self.assertEqual(self.state().RIRG_REQUESTED_REVISION, 2)
