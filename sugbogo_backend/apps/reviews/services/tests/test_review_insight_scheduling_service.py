import json
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier, Event
from unittest.mock import patch

from django.db import OperationalError, connection, connections, transaction
from django.test import TransactionTestCase, override_settings
from django.utils import timezone

from apps.admin_operations.system_configuration.models import AnalyticsPolicyConfiguration
from apps.admin_operations.system_configuration.services.analytics_policy_service import AnalyticsPolicyService
from apps.admin_operations.system_configuration.services.tests.test_analytics_policy_service import create_policy_admin
from apps.explorer_operations.explore_businesses.serializers.review_insights_serializers import (
    BusinessReviewInsightsSerializer,
)
from apps.reviews.models import (
    BusinessReviewSummary,
    Review,
    ReviewInsightRegeneration,
    ReviewPhoto,
    ReviewReport,
)
from apps.reviews.services.review_insight_regeneration_service import ReviewInsightRegenerationService
from apps.reviews.services.business_review_insights_service import BusinessReviewInsightsService
from apps.reviews.services.review_insight_scheduling_service import ReviewInsightSchedulingService
from apps.reviews.services.review_keyword_service import ReviewKeywordService
from apps.reviews.services.review_moderation_consistency_service import ReviewModerationConsistencyService
from apps.reviews.services.review_sentiment_service import ReviewSentimentService
from apps.reviews.services.review_report_service import ReviewReportService
from apps.reviews.services.review_reply_service import ReviewReplyService
from apps.reviews.services.review_service import ReviewService
from apps.reviews.services.review_summary_batch_service import ReviewSummaryBatchService
from apps.reviews.services.tests.test_business_review_summary_service import SummaryFixtureMixin
from apps.reviews.tasks import (
    process_review_insight_regeneration,
    process_review_sentiment,
    refresh_business_review_insights,
    reconcile_business_review_sentiment,
)
from apps.users.models import User


@override_settings(GEMINI_API_KEY="test-key", GEMINI_KEYWORD_MODEL="test-model")
class ReviewInsightSchedulingServiceTests(SummaryFixtureMixin, TransactionTestCase):
    def setUp(self):
        AnalyticsPolicyConfiguration.objects.get_or_create(pk=1)
        self.business = self.create_business()
        self.reviews = [
            self.create_review(self.business, index)
            for index in range(5)
        ]
        self.summary = BusinessReviewSummary.objects.create(BUSN_ID=self.business)
        self.clock = self.enterContext(
            patch("django.utils.timezone.now", return_value=timezone.now()),
        )
        self.provider = self.enterContext(
            patch.object(
                ReviewKeywordService,
                "_generate",
                return_value=json.dumps({
                    "narrative": "Visitors mention friendly service.",
                    "narrative_review_ids": [self.reviews[0].pk, self.reviews[1].pk],
                    "tags": [],
                }),
            ),
        )
        self.enterContext(
            patch(
                "apps.reviews.services.review_service.ReviewModerationService.moderate",
                return_value={
                    "outcome": "safe",
                    "model": "test",
                    "image_count": 0,
                    "checked_at": self.clock.return_value.isoformat(),
                    "failure_type": None,
                    "findings": [],
                },
            ),
        )

    def advance(
        self,
        seconds,
    ):
        self.clock.return_value += timedelta(seconds=seconds)

    def state(self):
        return ReviewInsightRegeneration.objects.get(BUSN_ID=self.business)

    def evaluate(self):
        self.advance(120)
        return ReviewInsightSchedulingService.process(self.business.pk)

    def edit(
        self,
        text,
    ):
        review = self.reviews[0]
        return ReviewService.update_review(
            review.USER_ID,
            review.pk,
            text=text,
        )

    def test_new_published_review_records_demand_before_any_sentiment_completion(self):
        author = User.objects.create_user(email="new-review@example.com", password=None)
        with patch("apps.reviews.tasks.process_review_sentiment.delay") as sentiment:
            review = ReviewService.create_review(
                author,
                self.business.pk,
                "A new opinion.",
            )
        self.assertEqual(review.REVW_STATUS, "published")
        self.assertEqual(self.state().RIRG_REQUESTED_REVISION, 1)
        self.assertEqual(self.state().RIRG_OBSERVED_REVISION, 1)
        sentiment.assert_called_once_with(review.pk, self.business.pk)
        self.provider.assert_not_called()

    def test_surrounding_whitespace_community_and_photo_only_edits_do_not_request(self):
        self.edit("  Friendly service. \n")
        ReviewService.update_review(
            self.reviews[0].USER_ID,
            self.reviews[0].pk,
            show_in_community=False,
            keep_photo_ids=[],
        )
        self.assertFalse(ReviewInsightRegeneration.objects.exists())

    def test_internal_whitespace_is_meaningful(self):
        self.edit("Friendly  service.")
        self.assertEqual(self.state().RIRG_REQUESTED_REVISION, 1)

    def test_rapid_published_reviews_coalesce_into_one_latest_evaluation(self):
        for index in range(3):
            author = User.objects.create_user(
                email=f"burst-author-{index}@example.com",
                password=None,
            )
            ReviewService.create_review(
                author,
                self.business.pk,
                f"A distinct new review {index}.",
            )
            self.advance(30)
        self.assertEqual(self.state().RIRG_REQUESTED_REVISION, 3)
        self.assertEqual(self.evaluate(), "updated")
        self.assertEqual(self.state().RIRG_COMPLETED_REVISION, 3)
        self.provider.assert_called_once()

    def test_report_attention_and_merchant_reply_do_not_invalidate_or_request(self):
        ReviewInsightSchedulingService.reconcile(self.business.pk)
        self.evaluate()
        review = self.reviews[0]
        for reporter in self.reviews[1:4]:
            ReviewReportService.create_report(
                reporter.USER_ID,
                review.pk,
                ReviewReport.ReportType.SPAM,
            )
        reply = ReviewReplyService.create_reply(
            self.business.USER_ID,
            review.pk,
            "Thank you for visiting.",
        )
        ReviewReplyService.update_reply(
            self.business.USER_ID,
            reply.pk,
            text="Thank you for the detailed feedback.",
        )
        review.refresh_from_db()
        self.summary.refresh_from_db()
        self.assertTrue(review.REVW_IS_REPORT_FLAGGED)
        self.assertEqual(self.state().RIRG_REQUESTED_REVISION, 1)
        self.assertEqual(self.summary.BRSU_GENERATION_STATE, "ready")
        self.assertTrue(self.summary.BRSU_NARRATIVE)

    def test_actual_photo_removal_does_not_record_narrative_demand(self):
        review = self.reviews[0]
        photo = ReviewPhoto.objects.create(
            REVW_ID=review,
            RPHO_PHOTO_URL="https://example.com/review.jpg",
            RPHO_PHOTO_PUBLIC_ID="test-review-photo",
        )
        with patch("apps.reviews.services.review_service.CloudinaryService.delete_image"):
            ReviewService.update_review(
                review.USER_ID,
                review.pk,
                keep_photo_ids=[],
            )
        self.assertFalse(ReviewPhoto.objects.filter(pk=photo.pk).exists())
        self.assertFalse(ReviewInsightRegeneration.objects.exists())

    def test_publication_outside_creation_window_does_not_request_narrative(self):
        review = self.reviews[0]
        Review.objects.filter(pk=review.pk).update(
            REVW_STATUS="under_review",
            REVW_CREATED_AT=self.clock.return_value - timedelta(days=31),
        )
        ReviewService.publish_under_review(review.pk)
        self.assertFalse(ReviewInsightRegeneration.objects.exists())

    def test_support_edit_and_revert_clear_immediately_then_generate_once(self):
        ReviewInsightSchedulingService.reconcile(self.business.pk)
        self.assertEqual(self.evaluate(), "updated")
        self.edit("Different opinion.")
        self.summary.refresh_from_db()
        self.assertEqual(self.summary.BRSU_NARRATIVE, "")
        self.edit("Friendly service.")
        self.assertEqual(self.state().RIRG_REQUESTED_REVISION, 3)
        self.assertEqual(self.evaluate(), "updated")
        self.assertEqual(self.provider.call_count, 2)

    def test_uncited_edit_retains_safe_content_as_outdated(self):
        ReviewInsightSchedulingService.reconcile(self.business.pk)
        self.evaluate()
        review = self.reviews[-1]
        ReviewService.update_review(
            review.USER_ID,
            review.pk,
            text="Another opinion.",
        )
        self.summary.refresh_from_db()
        self.assertTrue(self.summary.BRSU_NARRATIVE)
        self.assertEqual(self.summary.BRSU_GENERATION_STATE, "outdated")

    def test_quiet_deadline_resets_and_ten_minute_cap_is_preserved(self):
        self.edit("First change.")
        first = self.state().RIRG_FIRST_CHANGED_AT
        for index in range(8):
            self.advance(90)
            self.edit(f"Change {index}.")
        self.assertEqual(self.state().RIRG_FIRST_CHANGED_AT, first)
        self.assertEqual(self.state().RIRG_DUE_AT, first + timedelta(seconds=600))
        self.assertEqual(ReviewInsightSchedulingService.process(self.business.pk), "updated")
        self.provider.assert_called_once()

    def test_held_publication_requests_once_and_held_rejection_requests_nothing(self):
        held = self.reviews[0]
        Review.objects.filter(pk=held.pk).update(REVW_STATUS="under_review")
        other = self.reviews[1]
        Review.objects.filter(pk=other.pk).update(REVW_STATUS="under_review")
        ReviewService.publish_under_review(held.pk)
        self.assertEqual(self.state().RIRG_REQUESTED_REVISION, 1)
        ReviewService.reject_under_review(other.pk)
        self.assertEqual(self.state().RIRG_REQUESTED_REVISION, 1)

    def test_rejection_and_deletion_remove_evidence_and_do_not_double_count(self):
        ReviewInsightSchedulingService.reconcile(self.business.pk)
        self.evaluate()
        ReviewModerationConsistencyService.reject_review(self.reviews[0].pk)
        self.summary.refresh_from_db()
        self.assertEqual(self.summary.BRSU_NARRATIVE, "")
        self.assertEqual(self.summary.BRSU_GENERATION_STATE, "insufficient_reviews")
        self.assertEqual(self.state().RIRG_REQUESTED_REVISION, 2)
        ReviewModerationConsistencyService.reject_review(self.reviews[0].pk)
        self.assertEqual(self.state().RIRG_REQUESTED_REVISION, 2)
        ReviewService.delete_review(
            self.reviews[1].USER_ID,
            self.reviews[1].pk,
        )
        self.assertEqual(self.state().RIRG_REQUESTED_REVISION, 3)
        self.assertEqual(self.evaluate(), "insufficient_reviews")
        self.provider.assert_called_once()

    def test_mutation_rollback_discards_request_and_restores_review(self):
        with self.assertRaises(RuntimeError):
            with transaction.atomic():
                self.edit("Rolled back.")
                raise RuntimeError()
        self.assertFalse(ReviewInsightRegeneration.objects.exists())
        self.reviews[0].refresh_from_db()
        self.assertEqual(self.reviews[0].REVW_TEXT, "Friendly service.")

    def test_failed_observation_callback_is_recovered_without_losing_demand(self):
        with patch.object(
            ReviewInsightRegenerationService,
            "observe_changes",
            side_effect=RuntimeError(),
        ):
            self.edit("Committed change.")
        self.assertEqual(self.state().RIRG_OBSERVED_REVISION, 0)
        with patch("apps.reviews.tasks.process_review_insight_regeneration.apply_async") as dispatch:
            ReviewInsightSchedulingService.recover_and_dispatch()
        self.assertEqual(self.state().RIRG_OBSERVED_REVISION, 1)
        dispatch.assert_not_called()

    def test_broker_failure_duplicate_sweeps_and_redelivery_preserve_one_evaluation(self):
        self.edit("Committed change.")
        self.advance(120)
        with patch(
            "apps.reviews.tasks.process_review_insight_regeneration.apply_async",
            side_effect=ConnectionError(),
        ):
            self.assertEqual(
                ReviewInsightSchedulingService.recover_and_dispatch()["dispatched"],
                0,
            )
        self.assertIsNone(self.state().RIRG_ATTEMPT_TOKEN)
        with patch("apps.reviews.tasks.process_review_insight_regeneration.apply_async") as dispatch:
            ReviewInsightSchedulingService.recover_and_dispatch()
            ReviewInsightSchedulingService.recover_and_dispatch()
        self.assertEqual(dispatch.call_count, 2)
        self.assertEqual(process_review_insight_regeneration.run(self.business.pk), "updated")
        self.assertEqual(process_review_insight_regeneration.run(self.business.pk), "not_due")
        self.assertEqual(self.state().RIRG_REQUESTED_REVISION, 1)
        self.provider.assert_called_once()

    def test_interrupted_worker_is_recovered_after_lease_expiration(self):
        self.edit("Committed change.")
        self.advance(120)
        self.provider.side_effect = KeyboardInterrupt()
        with self.assertRaises(KeyboardInterrupt):
            ReviewInsightSchedulingService.process(self.business.pk)
        self.advance(ReviewInsightSchedulingService.lease_seconds())
        with patch("apps.reviews.tasks.process_review_insight_regeneration.apply_async"):
            ReviewInsightSchedulingService.recover_and_dispatch()
        self.provider.side_effect = None
        self.assertEqual(ReviewInsightSchedulingService.process(self.business.pk), "updated")

    def test_sentiment_failure_and_success_do_not_reset_narrative_deadline(self):
        self.edit("Committed change.")
        first = self.state().RIRG_FIRST_CHANGED_AT
        with patch.object(
            ReviewSentimentService,
            "process_review",
            side_effect=RuntimeError(),
        ):
            self.assertEqual(
                process_review_sentiment.run(self.reviews[0].pk, self.business.pk),
                "failed",
            )
        with patch.object(
            ReviewSentimentService,
            "process_review",
            return_value="updated",
        ):
            process_review_sentiment.run(self.reviews[0].pk, self.business.pk)
        self.assertEqual(self.state().RIRG_FIRST_CHANGED_AT, first)
        self.assertEqual(self.state().RIRG_REQUESTED_REVISION, 1)
        self.assertEqual(self.evaluate(), "updated")

    def test_daily_reconciliation_recovers_missed_changes_without_resetting_pending_inputs(self):
        ReviewInsightSchedulingService.reconcile(self.business.pk)
        self.evaluate()
        Review.objects.filter(pk=self.reviews[-1].pk).update(REVW_TEXT="Missed event.")
        ReviewSummaryBatchService.recompute(business_ids=[self.business.pk])
        first = self.state().RIRG_FIRST_CHANGED_AT
        ReviewSummaryBatchService.recompute(business_ids=[self.business.pk])
        self.assertEqual(self.state().RIRG_REQUESTED_REVISION, 2)
        self.assertEqual(self.state().RIRG_FIRST_CHANGED_AT, first)
        self.assertEqual(self.evaluate(), "updated")

    def test_daily_narrative_reconciliation_survives_sentiment_failure(self):
        with patch.object(
            ReviewSentimentService,
            "reconcile_business",
            side_effect=RuntimeError(),
        ):
            ReviewSummaryBatchService.recompute()
        self.assertEqual(self.state().RIRG_REQUESTED_REVISION, 1)

    def test_missed_supporting_text_edit_hides_unverifiable_previous_content(self):
        ReviewInsightSchedulingService.reconcile(self.business.pk)
        self.evaluate()
        Review.objects.filter(pk=self.reviews[0].pk).update(REVW_TEXT="Missed supporting edit.")
        ReviewInsightSchedulingService.reconcile(self.business.pk)
        self.summary.refresh_from_db()
        self.assertEqual(self.summary.BRSU_NARRATIVE, "")
        self.assertEqual(self.state().RIRG_REQUESTED_REVISION, 2)

    def test_untracked_support_edit_during_generation_cannot_retain_unsafe_old_content(self):
        ReviewInsightSchedulingService.reconcile(self.business.pk)
        self.evaluate()
        uncited = self.reviews[-1]
        ReviewService.update_review(
            uncited.USER_ID,
            uncited.pk,
            text="Known uncited edit.",
        )

        def generate(_reviews):
            Review.objects.filter(pk=self.reviews[0].pk).update(REVW_TEXT="Missed supporting edit.")
            return self.provider.return_value

        self.provider.side_effect = generate
        self.assertEqual(self.evaluate(), "stale")
        self.summary.refresh_from_db()
        self.assertEqual(self.summary.BRSU_NARRATIVE, "")
        self.assertEqual(self.state().RIRG_COMPLETED_REVISION, 1)

    def test_uncited_expiration_retains_proven_safe_previous_content(self):
        self.create_review(self.business, 6)
        Review.objects.filter(pk=self.reviews[-1].pk).update(
            REVW_CREATED_AT=self.clock.return_value - timedelta(days=30) + timedelta(seconds=180),
        )
        ReviewInsightSchedulingService.reconcile(self.business.pk)
        self.evaluate()
        self.advance(61)
        with patch("apps.reviews.tasks.process_review_insight_regeneration.apply_async"):
            ReviewInsightSchedulingService.recover_and_dispatch()
        self.summary.refresh_from_db()
        self.assertTrue(self.summary.BRSU_NARRATIVE)
        self.assertEqual(self.summary.BRSU_GENERATION_STATE, "outdated")
        self.assertEqual(self.state().RIRG_REQUESTED_REVISION, 2)

    def test_expiration_is_hidden_before_sweep_and_requests_fresh_evaluation(self):
        Review.objects.filter(pk=self.reviews[0].pk).update(
            REVW_CREATED_AT=self.clock.return_value - timedelta(days=30) + timedelta(seconds=180),
        )
        ReviewInsightSchedulingService.reconcile(self.business.pk)
        self.evaluate()
        self.advance(61)
        summary = (
            BusinessReviewSummary.objects
            .select_related("BUSN_ID__review_insight_regeneration")
            .get(pk=self.summary.pk)
        )
        data = BusinessReviewInsightsSerializer(summary).data
        self.assertEqual(data["state"], "outdated")
        self.assertIsNone(data["narrative"])
        with patch("apps.reviews.tasks.process_review_insight_regeneration.apply_async"):
            ReviewInsightSchedulingService.recover_and_dispatch()
        self.summary.refresh_from_db()
        self.assertEqual(self.summary.BRSU_GENERATION_STATE, "insufficient_reviews")
        self.assertEqual(self.state().RIRG_REQUESTED_REVISION, 2)

    def test_expired_supporting_review_is_invalidated_immediately_on_edit_or_deletion(self):
        for operation in ("edit", "delete"):
            with self.subTest(operation=operation):
                Review.objects.filter(pk=self.reviews[0].pk).update(
                    REVW_CREATED_AT=self.clock.return_value - timedelta(days=30)
                    + timedelta(seconds=180),
                )
                ReviewInsightSchedulingService.reconcile(self.business.pk)
                self.assertEqual(self.evaluate(), "updated")
                self.advance(61)
                if operation == "edit":
                    self.edit("Changed after leaving the eligible window.")
                else:
                    ReviewService.delete_review(
                        self.reviews[0].USER_ID,
                        self.reviews[0].pk,
                    )
                self.summary.refresh_from_db()
                self.assertEqual(self.summary.BRSU_NARRATIVE, "")
                state = self.state()
                self.assertEqual(
                    state.RIRG_REQUESTED_REVISION,
                    state.RIRG_COMPLETED_REVISION,
                )

    def test_legacy_redelivery_only_reconciles_and_cannot_bypass_debounce(self):
        self.edit("Committed change.")
        for _ in range(2):
            outcome = refresh_business_review_insights.run(
                self.business.pk,
                retry_keywords_only=True,
                reference_time_iso="2020-01-01T00:00:00+00:00",
            )
            self.assertEqual(outcome["generation_outcome"], "pending")
        self.assertEqual(self.state().RIRG_REQUESTED_REVISION, 1)
        self.provider.assert_not_called()

    def test_old_unowned_publication_and_failure_on_another_connection_are_fenced(self):
        ReviewInsightSchedulingService.reconcile(self.business.pk)
        self.assertEqual(self.evaluate(), "updated")
        before = BusinessReviewSummary.objects.values().get(pk=self.summary.pk)

        def legacy_write(fields):
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT pg_backend_pid()")
                    backend_pid = cursor.fetchone()[0]
                try:
                    BusinessReviewSummary.objects.filter(pk=self.summary.pk).update(**fields)
                except OperationalError:
                    return backend_pid, "fenced"
                return backend_pid, "published"
            finally:
                connections.close_all()

        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_backend_pid()")
            owner_pid = cursor.fetchone()[0]
        with ThreadPoolExecutor(max_workers=1) as executor:
            for fields in [
                {"BRSU_NARRATIVE": "Old result."},
                {"BRSU_GENERATION_STATE": "outdated", "BRSU_NARRATIVE": ""},
            ]:
                pid, outcome = executor.submit(legacy_write, fields).result(timeout=10)
                self.assertNotEqual(pid, owner_pid)
                self.assertEqual(outcome, "fenced")
        self.assertEqual(BusinessReviewSummary.objects.values().get(pk=self.summary.pk), before)

    def test_lease_and_worker_limits_leave_publication_and_recovery_margin(self):
        self.assertEqual(ReviewInsightSchedulingService.lease_seconds(), 180)
        self.assertEqual(process_review_insight_regeneration.soft_time_limit, 120)
        self.assertEqual(process_review_insight_regeneration.time_limit, 150)
        self.assertTrue(process_review_insight_regeneration.acks_late)
        with override_settings(GEMINI_TIMEOUT_SECONDS=300):
            self.assertEqual(ReviewInsightSchedulingService.lease_seconds(), 420)
        with override_settings(GEMINI_TIMEOUT_SECONDS=301):
            with self.assertRaises(ValueError):
                ReviewInsightSchedulingService.lease_seconds()

    def test_administrator_sentiment_delivery_or_inference_failure_does_not_block_generation(self):
        with patch(
            "apps.reviews.tasks.reconcile_business_review_sentiment.apply_async",
            side_effect=ConnectionError(),
        ):
            result = BusinessReviewInsightsService.refresh(self.business.pk)
        self.assertEqual(result["generation_outcome"], "queued")
        first = self.state().RIRG_FIRST_CHANGED_AT
        with patch.object(
            ReviewSentimentService,
            "reconcile_business",
            side_effect=RuntimeError(),
        ):
            self.assertEqual(
                reconcile_business_review_sentiment.run(self.business.pk),
                "failed",
            )
        self.assertEqual(self.state().RIRG_REQUESTED_REVISION, 1)
        self.assertEqual(self.state().RIRG_FIRST_CHANGED_AT, first)
        self.assertEqual(self.evaluate(), "updated")

    def test_policy_update_records_demand_and_clears_incompatible_content_atomically(self):
        ReviewInsightSchedulingService.reconcile(self.business.pk)
        self.evaluate()
        actor = create_policy_admin()
        AnalyticsPolicyService.update(
            actor=actor,
            expected_version=1,
            reason="Require more supporting reviews.",
            values={"mention_min_supporting_reviews": 3},
        )
        self.summary.refresh_from_db()
        self.assertEqual(self.summary.BRSU_NARRATIVE, "")
        self.assertEqual(self.state().RIRG_REQUESTED_REVISION, 2)
        first = self.state().RIRG_FIRST_CHANGED_AT
        AnalyticsPolicyService.update(
            actor=actor,
            expected_version=2,
            reason="Unrelated sentiment threshold.",
            values={"sentiment_min_classified_reviews": 6},
        )
        self.assertEqual(self.state().RIRG_REQUESTED_REVISION, 2)
        self.assertEqual(self.state().RIRG_FIRST_CHANGED_AT, first)

    def test_competing_processing_messages_claim_once_on_separate_connections(self):
        self.edit("Committed change.")
        self.advance(120)
        barrier = Barrier(2)

        def run():
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT pg_backend_pid()")
                    pid = cursor.fetchone()[0]
                barrier.wait(timeout=10)
                return pid, ReviewInsightSchedulingService.process(self.business.pk)
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as executor:
            first = executor.submit(run)
            second = executor.submit(run)
            results = [
                first.result(timeout=15),
                second.result(timeout=15),
            ]
        self.assertNotEqual(results[0][0], results[1][0])
        self.assertEqual(
            sorted(
                result[1]
                for result in results
            ),
            ["not_due", "updated"],
        )
        self.provider.assert_called_once()

    def test_review_lock_does_not_block_creation_of_missing_summary_by_worker(self):
        self.summary.delete()
        ReviewInsightSchedulingService.reconcile(self.business.pk)
        self.advance(120)

        def run():
            try:
                return ReviewInsightSchedulingService.process(self.business.pk)
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=1) as executor:
            with transaction.atomic():
                ReviewService._get_review(self.reviews[0].pk)
                worker = executor.submit(run)
                self.assertEqual(worker.result(timeout=10), "updated")
                self.edit("Changed after the worker published.")
        self.assertEqual(self.state().RIRG_COMPLETED_REVISION, 1)
        self.assertEqual(self.state().RIRG_REQUESTED_REVISION, 2)

    def test_inflight_legacy_generation_is_fenced_and_busy_coordinated_work_recovers(self):
        started = Event()
        finish = Event()
        parsed = ReviewKeywordService._parse(
            self.provider.return_value,
            ReviewKeywordService._snapshot(self.business.pk),
        )

        def old_worker():
            try:
                with ReviewKeywordService.generation_lock(self.business.pk) as acquired:
                    self.assertTrue(acquired)
                    reviews = ReviewKeywordService._snapshot(self.business.pk)
                    fingerprint = ReviewKeywordService._fingerprint(reviews)
                    started.set()
                    if not finish.wait(timeout=10):
                        raise TimeoutError()
                    try:
                        ReviewKeywordService._store(
                            self.business.pk,
                            self.clock.return_value,
                            fingerprint,
                            reviews,
                            reviews,
                            parsed,
                            self.clock.return_value,
                        )
                    except OperationalError:
                        return "fenced"
                    return "published"
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=1) as executor:
            old = executor.submit(old_worker)
            try:
                self.assertTrue(started.wait(timeout=10))
                ReviewInsightSchedulingService.reconcile(self.business.pk)
                self.assertEqual(self.evaluate(), "busy")
                self.assertEqual(self.state().RIRG_COMPLETED_REVISION, 0)
            finally:
                finish.set()
            self.assertEqual(old.result(timeout=10), "fenced")
        self.advance(ReviewInsightSchedulingService.lease_seconds())
        self.assertEqual(ReviewInsightSchedulingService.process(self.business.pk), "updated")
        self.provider.assert_called_once()
