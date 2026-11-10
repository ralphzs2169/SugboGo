"""Verify global authority without paid inference or live broker delivery."""

import json
from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings
from rest_framework.exceptions import ValidationError

from apps.reviews.models import BusinessSentimentPolicy as Policy, Review, ReviewSentimentShadow as Shadow
from apps.reviews.services.gemini_sentiment_contract import contract_version, text_hash
from apps.reviews.services.gemini_sentiment_cutover_service import GeminiSentimentCutoverService as Cutover
from apps.reviews.services.gemini_sentiment_shadow_service import GeminiSentimentShadowService as Worker
from apps.reviews.services.business_rating_service import BusinessRatingService
from apps.reviews.services.review_sentiment_service import ReviewSentimentService
from apps.reviews.services.sentiment import _get_model, route_sentiment
from apps.reviews.services.tests.test_business_review_summary_service import SummaryFixtureMixin
from apps.shared.services.gemini_structured_service import TransientGenerationError

PROVIDER = "apps.reviews.services.gemini_sentiment_shadow_service.GeminiStructuredService.generate"
POSITIVE = {"label": "positive", "score": 1, "eligible": True, "reason": "evaluative"}


@override_settings(
    GEMINI_SENTIMENT_ALL_BUSINESSES=True,
    GEMINI_SENTIMENT_CUTOVER_ENABLED=True,
    GEMINI_SENTIMENT_SHADOW_ENABLED=False,
    GEMINI_SENTIMENT_SHADOW_BUSINESS_IDS=frozenset(),
    GEMINI_SENTIMENT_SHADOW_MODEL="gemini-test",
    GEMINI_API_KEY="test-key",
    BUSINESS_RATING_AUTO_UPDATES_ENABLED=True,
)
class GlobalGeminiTests(SummaryFixtureMixin, TestCase):
    def setUp(self):
        self.business = self.create_business()
        self.review = self.create_review(self.business, REVW_STATUS=Review.ReviewStatus.PUBLISHED)

    def ready(self, review):
        return Shadow.objects.create(
            REVW_ID=review, RSSH_SOURCE_TEXT=review.REVW_TEXT,
            RSSH_SOURCE_HASH=text_hash(review.REVW_TEXT),
            RSSH_VERSION=contract_version("gemini-test"), RSSH_MODEL="gemini-test",
            RSSH_STATE=Shadow.State.READY, RSSH_LABEL="positive", RSSH_SCORE=1,
            RSSH_ELIGIBLE=True, RSSH_REASON="evaluative",
        )

    def report(self, *args):
        output = StringIO()
        call_command("rollout_gemini_sentiment", *args, stdout=output)
        return json.loads(output.getvalue())

    def test_unactivated_business_routes_to_gemini_without_allowlist(self):
        with patch("apps.reviews.services.review_sentiment_service.route_sentiment") as legacy:
            self.assertEqual(ReviewSentimentService.process_review(self.review.pk), "gemini_queued")
        legacy.assert_not_called()
        self.assertTrue(Shadow.objects.filter(REVW_ID=self.review).exists())

    def test_last_ready_result_activates_complete_business(self):
        job_id = Worker.request(self.review.pk)
        with patch(PROVIDER, return_value=(json.dumps(POSITIVE), {})):
            with self.captureOnCommitCallbacks(execute=True):
                self.assertEqual(Worker.process(job_id), "ready")
        self.assertIsNotNone(Cutover.active_policy(self.business.pk))
        self.review.refresh_from_db()
        self.assertEqual(self.review.REVW_SENTIMENT_SCORE, 1)
        self.assertEqual(self.review.rating_result.RRSR_SCORING_VERSION, contract_version("gemini-test"))

    def test_partial_cohort_preserves_old_results_until_complete(self):
        other = self.create_review(self.business, 1, REVW_STATUS=Review.ReviewStatus.PUBLISHED)
        old_score = self.review.REVW_SENTIMENT_SCORE
        job = self.ready(self.review)
        self.assertEqual(Cutover.promote(job.pk), "preparing")
        self.assertIsNone(Cutover.active_policy(self.business.pk))
        self.review.refresh_from_db()
        self.assertEqual(self.review.REVW_SENTIMENT_SCORE, old_score)
        self.ready(other)
        self.assertEqual(Cutover.promote(job.pk), "activated")

    def test_pausing_never_restores_legacy_inference(self):
        with override_settings(GEMINI_SENTIMENT_CUTOVER_ENABLED=False):
            with patch("apps.reviews.services.review_sentiment_service.route_sentiment") as legacy:
                ReviewSentimentService.process_review(self.review.pk)
            legacy.assert_not_called()
            self.assertIsNone(Worker.request(self.review.pk))
            self.assertEqual(Worker.recover(), 0)
        self.assertEqual(Cutover.recover_requests(), 1)

    def test_legacy_artifacts_and_cached_models_cannot_be_used(self):
        with patch("apps.reviews.services.sentiment._load_model") as load:
            with self.assertRaises(RuntimeError):
                route_sentiment("Magandang serbisyo")
            with self.assertRaises(RuntimeError):
                _get_model("tagalog")
        load.assert_not_called()

    def test_legacy_rollback_is_rejected(self):
        with self.assertRaises(ValidationError):
            Cutover.rollback(self.business.pk)

    def test_provider_failure_does_not_activate_or_fabricate_score(self):
        original = self.review.REVW_SENTIMENT_SCORE
        job_id = Worker.request(self.review.pk)
        with patch(PROVIDER, side_effect=TransientGenerationError("unavailable")):
            self.assertEqual(Worker.process(job_id), "failed")
        job = Shadow.objects.get(pk=job_id)
        self.assertIsNone(job.RSSH_SCORE)
        self.assertIsNotNone(job.RSSH_RETRY_AT)
        self.assertIsNone(Cutover.active_policy(self.business.pk))
        self.review.refresh_from_db()
        self.assertEqual(self.review.REVW_SENTIMENT_SCORE, original)

    def test_recovery_backfills_unactivated_business_after_ready_rows(self):
        self.ready(self.review)
        other = self.create_review(self.business, 1, REVW_STATUS=Review.ReviewStatus.PUBLISHED)
        self.assertEqual(Cutover.recover_requests(limit=1), 1)
        self.assertTrue(Shadow.objects.filter(REVW_ID=other).exists())

    def test_read_only_report_does_not_queue_or_activate(self):
        result = self.report()
        self.assertEqual(result["requested"], 0)
        self.assertEqual(result["businesses"][0]["not_ready"], 1)
        self.assertFalse(Shadow.objects.exists())
        self.assertFalse(Policy.objects.exists())

    def test_backfill_limit_applies_across_businesses(self):
        other = self.create_business(1)
        self.create_review(other, 1, REVW_STATUS=Review.ReviewStatus.PUBLISHED)
        result = self.report("--queue", "--review-limit", "1")
        self.assertEqual(result["requested"], 1)
        self.assertEqual(Shadow.objects.count(), 1)
        first = self.report("--limit", "1")
        self.assertEqual(first["next_after_business_id"], self.business.pk)
        second = self.report("--after-business-id", str(self.business.pk))
        self.assertEqual(second["businesses"][0]["business_id"], other.pk)

    def test_empty_new_business_activates_without_provider_calls(self):
        self.review.delete()
        with patch(PROVIDER) as provider:
            result = self.report("--activate")
        provider.assert_not_called()
        self.assertEqual(result["businesses"][0]["activation"], "activated")

    def test_ready_recovery_activates_missed_callback(self):
        self.ready(self.review)
        with patch("apps.reviews.services.gemini_sentiment_shadow_service.GeminiSentimentShadowService.dispatch"):
            Worker.recover()
        self.assertIsNotNone(Cutover.active_policy(self.business.pk))

    def test_rollout_refuses_mutations_when_paused(self):
        with override_settings(GEMINI_SENTIMENT_CUTOVER_ENABLED=False):
            with self.assertRaises(CommandError):
                self.report("--queue")

    def test_active_business_keeps_pinned_model_after_environment_change(self):
        self.ready(self.review)
        Cutover.activate(self.business.pk)
        other = self.create_review(self.business, 1, REVW_STATUS=Review.ReviewStatus.PUBLISHED)
        with override_settings(GEMINI_SENTIMENT_SHADOW_MODEL="different-model"):
            Worker.recover()
        job = Shadow.objects.get(REVW_ID=other)
        self.assertEqual(job.RSSH_MODEL, "gemini-test")
        self.assertEqual(job.RSSH_VERSION, contract_version("gemini-test"))

    def test_factual_exclusion_completes_cohort_without_neutral_count(self):
        job_id = Worker.request(self.review.pk)
        factual = {"label": "neutral", "score": None, "eligible": False, "reason": "factual"}
        with patch(PROVIDER, return_value=(json.dumps(factual), {})):
            with self.captureOnCommitCallbacks(execute=True):
                Worker.process(job_id)
        self.review.refresh_from_db()
        self.assertIsNone(self.review.REVW_SENTIMENT_SCORE)
        self.assertIsNone(self.review.REVW_SENTIMENT_LABEL)
        self.assertFalse(self.review.rating_result.RRSR_IS_ELIGIBLE)
        self.assertIsNotNone(Cutover.active_policy(self.business.pk))

    def test_unactivated_business_rejects_unverified_rating_write(self):
        with self.assertRaises(ValidationError):
            BusinessRatingService.record_result(
                self.review.pk, self.review.REVW_TEXT, 1, "positive", "unverified-version",
            )

    def test_ready_callback_for_edited_text_cannot_activate_stale_cohort(self):
        job = self.ready(self.review)
        Review.objects.filter(pk=self.review.pk).update(REVW_TEXT="Changed opinion")
        self.assertEqual(Cutover.promote(job.pk), "preparing")
        self.assertIsNone(Cutover.active_policy(self.business.pk))
        self.assertEqual(Cutover.recover_requests(), 1)
        self.assertEqual(Shadow.objects.filter(REVW_ID=self.review).count(), 2)

    def test_incomplete_early_cohort_does_not_starve_recovery(self):
        self.ready(self.review)
        self.create_review(self.business, 1, REVW_STATUS=Review.ReviewStatus.PUBLISHED)
        other = self.create_business(1)
        other_review = self.create_review(other, REVW_STATUS=Review.ReviewStatus.PUBLISHED)
        self.ready(other_review)
        Worker.recover(limit=1)
        Worker.recover(limit=1)
        self.assertIsNotNone(Cutover.active_policy(other.pk))
        self.assertIsNone(Cutover.active_policy(self.business.pk))
