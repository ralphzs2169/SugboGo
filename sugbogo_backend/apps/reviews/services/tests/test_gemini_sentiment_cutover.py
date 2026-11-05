"""Verify authoritative transitions without live providers or broker delivery."""

import json
from io import StringIO
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.core.management import call_command
from rest_framework.exceptions import ValidationError

from apps.reviews.models import (
    BusinessRating, BusinessReviewSummary, BusinessSentimentPolicy as Policy,
    Review, ReviewLegacySentimentSnapshot as Snapshot, ReviewRatingResult,
    ReviewSentimentShadow as Shadow,
)
from apps.reviews.services.business_rating_service import BusinessRatingService
from apps.reviews.services.business_rating_work_service import BusinessRatingWorkService
from apps.reviews.services.business_review_summary_service import BusinessReviewSummaryService
from apps.reviews.services.gemini_sentiment_contract import contract_version, text_hash
from apps.reviews.services.gemini_sentiment_cutover_service import GeminiSentimentCutoverService as Cutover
from apps.reviews.services.gemini_sentiment_shadow_service import GeminiSentimentShadowService as Worker
from apps.reviews.services.review_sentiment_service import ReviewSentimentService
from apps.reviews.services.review_service import ReviewService
from apps.reviews.services.tests.test_business_review_summary_service import SummaryFixtureMixin
from apps.shared.services.gemini_structured_service import TransientGenerationError

PROVIDER = "apps.reviews.services.gemini_sentiment_shadow_service.GeminiStructuredService.generate"
LEGACY = "apps.reviews.services.review_sentiment_service.route_sentiment"
POSITIVE = {"label": "positive", "score": 1, "eligible": True, "reason": "evaluative"}


@override_settings(GEMINI_SENTIMENT_CUTOVER_ENABLED=True, GEMINI_SENTIMENT_SHADOW_ENABLED=True, GEMINI_SENTIMENT_SHADOW_MODEL="gemini-test", BUSINESS_RATING_AUTO_UPDATES_ENABLED=True)
class GeminiCutoverTests(SummaryFixtureMixin, TestCase):
    def setUp(self):
        self.business = self.create_business()
        self.scope = override_settings(GEMINI_SENTIMENT_SHADOW_BUSINESS_IDS={self.business.pk})
        self.scope.enable()
        self.addCleanup(self.scope.disable)
        self.reviews = [self.create_review(self.business, i, REVW_STATUS=Review.ReviewStatus.PUBLISHED) for i in range(5)]
        self.jobs = [self.ready(review) for review in self.reviews]
        BusinessRatingService.recompute(self.business.pk, BusinessRatingService.LEGACY_VERSION, allow_legacy=True)

    def ready(self, review, **changes):
        """Persist a validated-looking observation for the exact fixture text."""
        values = {
            "RSSH_SOURCE_TEXT": review.REVW_TEXT, "RSSH_SOURCE_HASH": text_hash(review.REVW_TEXT),
            "RSSH_VERSION": contract_version("gemini-test"), "RSSH_MODEL": "gemini-test",
            "RSSH_STATE": Shadow.State.READY, "RSSH_LABEL": "positive", "RSSH_SCORE": 1,
            "RSSH_ELIGIBLE": True, "RSSH_REASON": "evaluative",
        }
        values.update(changes)
        return Shadow.objects.create(REVW_ID=review, **values)

    def activate(self):
        """Activate fixtures without running deferred broker callbacks."""
        return Cutover.activate(self.business.pk)

    def test_activation_replaces_all_consumers_and_preserves_legacy(self):
        self.assertEqual(self.activate(), "activated")
        self.assertEqual(Snapshot.objects.count(), 5)
        self.assertEqual(ReviewRatingResult.objects.filter(RRSR_IS_ELIGIBLE=True).count(), 5)
        self.assertEqual(set(Review.objects.values_list("REVW_SENTIMENT_SCORE", flat=True)), {1})
        aggregate = BusinessRating.objects.get(BUSN_ID=self.business)
        self.assertEqual(float(aggregate.BRAT_VALUE), 5)
        self.assertEqual(aggregate.BRAT_SCORING_VERSION, contract_version("gemini-test"))
        self.assertEqual(BusinessReviewSummary.objects.get(BUSN_ID=self.business).BRSU_POSITIVE_COUNT, 5)
        self.assertEqual(Snapshot.objects.first().RLSS_SCORE, 0.75)
        self.assertEqual(self.activate(), "already_active")

    def test_incomplete_cohort_rolls_back_entire_activation(self):
        self.jobs[-1].delete()
        with self.assertRaises(ValidationError):
            self.activate()
        self.assertFalse(Policy.objects.exists())
        self.assertFalse(Snapshot.objects.exists())
        self.assertFalse(ReviewRatingResult.objects.exists())
        self.assertEqual(set(Review.objects.values_list("REVW_SENTIMENT_SCORE", flat=True)), {0.75})

    def test_malformed_or_stale_observation_blocks_activation(self):
        for changes in [{"RSSH_SCORE": 0.8}, {"RSSH_SOURCE_TEXT": "old text"}, {"RSSH_STATE": "failed"}, {"RSSH_MODEL": "other-model"}]:
            with self.subTest(changes=changes):
                Shadow.objects.filter(pk=self.jobs[-1].pk).update(**changes)
                with self.assertRaises(ValidationError):
                    self.activate()
                self.assertFalse(Policy.objects.exists())
                Shadow.objects.filter(pk=self.jobs[-1].pk).update(RSSH_SCORE=1, RSSH_SOURCE_TEXT=self.reviews[-1].REVW_TEXT, RSSH_STATE="ready", RSSH_MODEL="gemini-test")

    def test_factual_comment_remains_published_without_three_star_contribution(self):
        Shadow.objects.filter(pk=self.jobs[-1].pk).update(RSSH_LABEL="neutral", RSSH_SCORE=None, RSSH_ELIGIBLE=False, RSSH_REASON="factual")
        self.activate()
        review = Review.objects.get(pk=self.reviews[-1].pk)
        self.assertEqual(review.REVW_STATUS, Review.ReviewStatus.PUBLISHED)
        self.assertIsNone(review.REVW_SENTIMENT_SCORE)
        self.assertIsNone(review.REVW_SENTIMENT_LABEL)
        self.assertFalse(review.rating_result.RRSR_IS_ELIGIBLE)
        aggregate = BusinessRating.objects.get(BUSN_ID=self.business)
        self.assertEqual(aggregate.BRAT_REVIEW_COUNT, 4)
        self.assertIsNone(aggregate.BRAT_VALUE)
        self.assertEqual(BusinessReviewSummary.objects.get(BUSN_ID=self.business).BRSU_CLASSIFIED_REVIEW_COUNT, 4)

    def test_active_reviews_never_invoke_legacy_even_when_paused(self):
        self.activate()
        with override_settings(GEMINI_SENTIMENT_CUTOVER_ENABLED=False), patch(LEGACY) as old:
            self.assertEqual(ReviewSentimentService.process_review(self.reviews[0].pk), "gemini_queued")
            old.assert_not_called()
        self.assertIsNotNone(Cutover.active_policy(self.business.pk))

    def test_old_inflight_legacy_result_cannot_overwrite_activation(self):
        review = self.reviews[0]
        Review.objects.filter(pk=review.pk).update(REVW_SENTIMENT_SCORE=None, REVW_SENTIMENT_LABEL=None)
        def activate_during_call(text):
            """Commit the simulated transition during legacy inference."""
            self.activate()
            return -1, "negative", "en"
        with patch(LEGACY, side_effect=activate_during_call):
            self.assertEqual(ReviewSentimentService.process_review(review.pk), "superseded")
        review.refresh_from_db()
        self.assertEqual(review.REVW_SENTIMENT_SCORE, 1)

    def test_successful_edit_promotes_new_source_and_recomputes_rating(self):
        self.activate()
        review = self.reviews[0]
        Review.objects.filter(pk=review.pk).update(REVW_TEXT="Terrible service.", REVW_SENTIMENT_SCORE=None, REVW_SENTIMENT_LABEL=None)
        ReviewRatingResult.objects.filter(REVW_ID=review).update(RRSR_IS_VALID=False)
        job_id = Worker.request(review.pk)
        with patch(PROVIDER, return_value=(json.dumps(dict(POSITIVE, label="negative", score=-1)), {})):
            with self.captureOnCommitCallbacks(execute=True):
                self.assertEqual(Worker.process(job_id), "ready")
        review.refresh_from_db()
        self.assertEqual(review.REVW_SENTIMENT_SCORE, -1)
        self.assertEqual(review.rating_result.RRSR_SOURCE_TEXT, "Terrible service.")
        BusinessRatingWorkService.process(self.business.pk)
        self.assertAlmostEqual(float(BusinessRating.objects.get(BUSN_ID=self.business).BRAT_VALUE), 4.2)
        self.assertEqual(BusinessReviewSummary.objects.get(BUSN_ID=self.business).BRSU_NEGATIVE_COUNT, 1)

    def test_failure_keeps_review_published_and_never_falls_back(self):
        self.activate()
        review = self.create_review(self.business, 90, REVW_STATUS=Review.ReviewStatus.PUBLISHED, REVW_SENTIMENT_SCORE=None, REVW_SENTIMENT_LABEL=None)
        job = Worker.request(review.pk)
        with patch(PROVIDER, side_effect=TransientGenerationError("private")), patch(LEGACY) as old:
            self.assertEqual(Worker.process(job), "failed")
            ReviewSentimentService.process_review(review.pk)
            old.assert_not_called()
        review.refresh_from_db()
        self.assertEqual(review.REVW_STATUS, Review.ReviewStatus.PUBLISHED)
        self.assertIsNone(review.REVW_SENTIMENT_SCORE)
        self.assertFalse(ReviewRatingResult.objects.filter(REVW_ID=review).exists())

    def test_edit_back_to_previously_analyzed_text_reuses_and_repromotes_result(self):
        self.activate()
        review = self.reviews[0]
        Review.objects.filter(pk=review.pk).update(REVW_TEXT="Temporary edit.")
        ReviewRatingResult.objects.filter(REVW_ID=review).update(RRSR_IS_VALID=False)
        Review.objects.filter(pk=review.pk).update(REVW_TEXT=review.REVW_TEXT, REVW_SENTIMENT_SCORE=None, REVW_SENTIMENT_LABEL=None)
        with self.captureOnCommitCallbacks(execute=True), patch(PROVIDER) as provider:
            self.assertEqual(Worker.request(review.pk), self.jobs[0].pk)
            provider.assert_not_called()
        review.refresh_from_db()
        self.assertEqual(review.REVW_SENTIMENT_SCORE, 1)
        self.assertTrue(review.rating_result.RRSR_IS_VALID)

    def test_ready_projection_recovers_after_database_failure(self):
        self.activate()
        review = self.create_review(self.business, 91, REVW_STATUS=Review.ReviewStatus.PUBLISHED, REVW_SENTIMENT_SCORE=None, REVW_SENTIMENT_LABEL=None)
        job = self.ready(review)
        with patch.object(BusinessReviewSummaryService, "recompute_sentiment", side_effect=RuntimeError("database")):
            self.assertEqual(Cutover.promote_safely(job.pk), "deferred")
        self.assertFalse(ReviewRatingResult.objects.filter(REVW_ID=review).exists())
        self.assertIsNone(Shadow.objects.get(pk=job.pk).RSSH_PROMOTED_AT)
        with patch.object(Worker, "dispatch"):
            Worker.recover()
        self.assertIsNotNone(Shadow.objects.get(pk=job.pk).RSSH_PROMOTED_AT)

    def test_active_model_is_pinned_despite_environment_change(self):
        self.activate()
        review = self.create_review(self.business, 92, REVW_STATUS=Review.ReviewStatus.PUBLISHED, REVW_SENTIMENT_SCORE=None, REVW_SENTIMENT_LABEL=None)
        with override_settings(GEMINI_SENTIMENT_SHADOW_MODEL="different-model", GEMINI_SENTIMENT_SHADOW_BUSINESS_IDS=set()):
            job = Shadow.objects.get(pk=Worker.request(review.pk))
            self.assertEqual(job.RSSH_MODEL, "gemini-test")
            with patch(PROVIDER, return_value=(json.dumps(POSITIVE), {})) as provider:
                with self.captureOnCommitCallbacks(execute=True):
                    Worker.process(job.pk)
                self.assertEqual(provider.call_args.kwargs["model"], "gemini-test")
        review.refresh_from_db()
        self.assertEqual(review.REVW_SENTIMENT_SCORE, 1)

    def test_recovery_repairs_missed_active_requests_without_shadow_backfill(self):
        self.activate()
        active = self.create_review(self.business, 95, REVW_STATUS=Review.ReviewStatus.PUBLISHED, REVW_SENTIMENT_SCORE=None, REVW_SENTIMENT_LABEL=None)
        other = self.create_business(2)
        passive = self.create_review(other, 96, REVW_STATUS=Review.ReviewStatus.PUBLISHED)
        with patch.object(Worker, "dispatch"):
            Worker.recover()
        self.assertTrue(Shadow.objects.filter(REVW_ID=active).exists())
        self.assertFalse(Shadow.objects.filter(REVW_ID=passive).exists())

    def test_recovery_repairs_edit_back_when_observer_was_missed(self):
        self.activate()
        review = self.reviews[0]
        Review.objects.filter(pk=review.pk).update(REVW_SENTIMENT_SCORE=None, REVW_SENTIMENT_LABEL=None)
        ReviewRatingResult.objects.filter(REVW_ID=review).update(RRSR_IS_VALID=False)
        with self.captureOnCommitCallbacks(execute=True), patch.object(Worker, "dispatch"):
            Worker.recover()
        review.refresh_from_db()
        self.assertEqual(review.REVW_SENTIMENT_SCORE, 1)
        self.assertTrue(review.rating_result.RRSR_IS_VALID)

    def test_rollback_restores_legacy_and_preserves_existing_rating_result(self):
        review = self.reviews[0]
        BusinessRatingService.record_result(review.pk, review.REVW_TEXT, -0.5, "negative", "previous-v1")
        self.activate()
        self.assertEqual(Cutover.rollback(self.business.pk), "rolled_back")
        self.assertFalse(Snapshot.objects.exists())
        review.refresh_from_db()
        self.assertEqual(review.REVW_SENTIMENT_SCORE, 0.75)
        self.assertEqual(review.rating_result.RRSR_SCORING_VERSION, "previous-v1")
        self.assertEqual(ReviewRatingResult.objects.count(), 1)
        self.assertEqual(BusinessRating.objects.get(BUSN_ID=self.business).BRAT_SCORING_VERSION, BusinessRatingService.LEGACY_VERSION)
        self.assertEqual(Cutover.promote(self.jobs[1].pk), "shadow")

    def test_rollback_never_restores_a_score_for_old_text(self):
        self.activate()
        review = self.reviews[0]
        Review.objects.filter(pk=review.pk).update(REVW_TEXT="Edited after activation.")
        with patch.object(ReviewService, "_queue_sentiment_after_commit") as queue:
            Cutover.rollback(self.business.pk)
            queue.assert_called_once_with(review.pk, self.business.pk)
        review.refresh_from_db()
        self.assertIsNone(review.REVW_SENTIMENT_SCORE)
        self.assertFalse(ReviewRatingResult.objects.filter(REVW_ID=review).exists())

    def test_wrong_methodology_cannot_replace_active_rating(self):
        self.activate()
        with self.assertRaises(ValidationError):
            BusinessRatingService.recompute(self.business.pk, BusinessRatingService.LEGACY_VERSION, allow_legacy=True)

    def test_missing_aggregate_is_recreated_with_active_methodology(self):
        self.activate()
        BusinessRating.objects.filter(BUSN_ID=self.business).delete()
        BusinessRatingWorkService.request_change(self.business.pk)
        BusinessRatingWorkService.process(self.business.pk)
        aggregate = BusinessRating.objects.get(BUSN_ID=self.business)
        self.assertEqual(aggregate.BRAT_SCORING_VERSION, contract_version("gemini-test"))
        self.assertEqual(float(aggregate.BRAT_VALUE), 5)

    def test_rollback_during_inference_keeps_new_result_isolated(self):
        self.activate()
        review = self.create_review(self.business, 94, REVW_STATUS=Review.ReviewStatus.PUBLISHED, REVW_SENTIMENT_SCORE=None, REVW_SENTIMENT_LABEL=None)
        job = Worker.request(review.pk)
        def rollback_during_call(**kwargs):
            """Restore legacy authority while a Gemini request is outstanding."""
            Cutover.rollback(self.business.pk)
            return json.dumps(POSITIVE), {}
        with patch(PROVIDER, side_effect=rollback_during_call):
            with self.captureOnCommitCallbacks(execute=True):
                Worker.process(job)
        review.refresh_from_db()
        self.assertIsNone(review.REVW_SENTIMENT_SCORE)
        self.assertFalse(ReviewRatingResult.objects.filter(REVW_ID=review).exists())

    def test_readiness_command_is_read_only_by_default(self):
        output = StringIO()
        with patch(PROVIDER) as provider, patch.object(Worker, "request") as request:
            call_command("prepare_sentiment_cutover", business_id=self.business.pk, stdout=output)
            provider.assert_not_called()
            request.assert_not_called()
        self.assertEqual(json.loads(output.getvalue())["ready"], 5)
        self.assertFalse(Policy.objects.exists())

    def test_explicit_backfill_is_bounded_and_does_not_activate(self):
        for i in range(3):
            self.create_review(self.business, 100 + i, REVW_STATUS=Review.ReviewStatus.PUBLISHED)
        result = Cutover.prepare(self.business.pk, queue=True, limit=2)
        self.assertEqual(result["total"], 8)
        self.assertEqual(result["not_ready"], 3)
        self.assertEqual(result["requested"], 2)
        self.assertEqual(Shadow.objects.filter(RSSH_STATE=Shadow.State.PENDING).count(), 2)
        self.assertFalse(Policy.objects.exists())

    def test_rejected_and_deleted_reviews_do_not_receive_projection(self):
        self.activate()
        review = self.create_review(self.business, 93, REVW_STATUS=Review.ReviewStatus.PUBLISHED, REVW_SENTIMENT_SCORE=None, REVW_SENTIMENT_LABEL=None)
        job = self.ready(review)
        Review.objects.filter(pk=review.pk).update(REVW_STATUS=Review.ReviewStatus.REJECTED)
        self.assertEqual(Cutover.promote(job.pk), "ineligible")
        self.assertFalse(ReviewRatingResult.objects.filter(REVW_ID=review).exists())
        review.delete()
        self.assertFalse(Shadow.objects.filter(pk=job.pk).exists())

    @override_settings(GEMINI_SENTIMENT_CUTOVER_ENABLED=False)
    def test_activation_requires_explicit_enablement(self):
        with self.assertRaises(ValidationError):
            self.activate()

    def test_activation_requires_allowlist(self):
        with override_settings(GEMINI_SENTIMENT_SHADOW_BUSINESS_IDS=set()), self.assertRaises(ValidationError):
            self.activate()
