"""Rating lifecycle and delivery regressions against persisted PostgreSQL state."""

from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Event
from unittest.mock import patch

from django.db import connections, transaction
from django.core.management import call_command
from io import StringIO
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from celery.exceptions import Retry

from apps.business.models import Business
from apps.reviews.models import BusinessRating, Review
from apps.reviews.serializers.business_rating_serializers import BusinessRatingSerializer
from apps.reviews.services.business_rating_service import BusinessRatingService
from apps.reviews.services.business_rating_work_service import BusinessRatingWorkService
from apps.reviews.services.review_moderation_consistency_service import ReviewModerationConsistencyService
from apps.reviews.services.review_sentiment_service import ReviewSentimentService
from apps.reviews.services.review_service import ReviewService, ReviewEditContentFlagged
from apps.reviews.services.tests.test_business_review_summary_service import SummaryFixtureMixin
from apps.reviews.tasks import recalculate_business_rating


@override_settings(BUSINESS_RATING_AUTO_UPDATES_ENABLED=True)
class BusinessRatingLifecycleTests(SummaryFixtureMixin, TestCase):
    """Verify durable mutation effects independently of actual broker or AI availability."""

    def setUp(self):
        """Create a ready five-review snapshot and isolate unrelated notification delivery."""
        self.business = self.create_business()
        self.reviews = [
            self.create_review(self.business, index)
            for index in range(5)
        ]
        BusinessRatingService.recompute(
            self.business.pk,
            BusinessRatingService.LEGACY_VERSION,
            allow_legacy=True,
        )
        for target in [
            "apps.reviews.services.review_service.ReviewInsightSchedulingService.review_changed",
            "apps.reviews.services.review_service.NotificationEventService.business_review_received",
            "apps.reviews.services.review_service.ReputationService.apply_review_reward",
        ]:
            mock = patch(target)
            mock.start()
            self.addCleanup(mock.stop)

    def aggregate(self):
        """Read the current aggregate without a cached related object."""
        return BusinessRating.objects.get(BUSN_ID=self.business)

    def payload(self):
        """Read the same eager-loaded snapshot used by Explorer."""
        business = Business.objects.select_related("business_rating").get(pk=self.business.pk)
        return BusinessRatingSerializer(business).data

    def test_publication_and_score_completion_queue_independent_rating_work(self):
        """Publish through the shared admin/AI path then classify and recompute."""
        review = self.create_review(
            self.business,
            10,
            REVW_STATUS="under_review",
            REVW_SENTIMENT_SCORE=None,
            REVW_SENTIMENT_LABEL=None,
        )
        with patch("apps.reviews.services.review_service.ReviewService._queue_sentiment_after_commit"):
            ReviewService.publish_under_review(review.pk)
        self.assertEqual(self.payload()["state"], "pending")
        self.assertIsNone(self.payload()["value"])
        self.assertIsNone(self.payload()["contributing_review_count"])
        BusinessRatingWorkService.process(self.business.pk)
        self.assertEqual(self.aggregate().BRAT_REVIEW_COUNT, 5)
        with patch(
            "apps.reviews.services.review_sentiment_service.route_sentiment",
            return_value=(-1, "Negative", "test"),
        ):
            ReviewSentimentService.process_review(review.pk)
        self.assertEqual(self.payload()["state"], "pending")
        BusinessRatingWorkService.process(self.business.pk)
        self.assertEqual(self.aggregate().BRAT_REVIEW_COUNT, 6)

    def test_accepted_edit_invalidates_but_rejected_edit_preserves_snapshot(self):
        """Only accepted changed content withdraws its old score."""
        review = self.reviews[0]
        with patch(
            "apps.reviews.services.review_service.ReviewModerationService.moderate",
            return_value={"outcome": "flagged", "findings": []},
        ):
            with self.assertRaises(ReviewEditContentFlagged):
                ReviewService.update_review(review.USER_ID, review.pk, text="Rejected proposal.")
        self.assertEqual(self.payload()["state"], "ready")
        with patch(
            "apps.reviews.services.review_service.ReviewModerationService.moderate",
            return_value={"outcome": "safe", "findings": [], "checked_at": None},
        ):
            ReviewService.update_review(review.USER_ID, review.pk, text="Accepted changed content.")
        self.assertEqual(self.payload()["state"], "pending")
        BusinessRatingWorkService.process(self.business.pk)
        self.assertEqual(self.payload()["state"], "insufficient_data")
        self.assertEqual(self.payload()["contributing_review_count"], 4)

    def test_orm_bulk_deletion_and_rejection_cross_the_threshold(self):
        """Cover deletion signals and the shared administrative rejection service."""
        Review.objects.filter(pk=self.reviews[0].pk).delete()
        self.assertEqual(self.payload()["state"], "pending")
        BusinessRatingWorkService.process(self.business.pk)
        self.assertEqual(self.aggregate().BRAT_REVIEW_COUNT, 4)
        ReviewModerationConsistencyService.reject_review(self.reviews[1].pk)
        self.assertEqual(self.payload()["state"], "pending")
        BusinessRatingWorkService.process(self.business.pk)
        self.assertEqual(self.aggregate().BRAT_REVIEW_COUNT, 3)

    def test_author_deletion_uses_the_same_invalidation(self):
        """Keep author deletion behavior while withdrawing rating membership."""
        review = self.reviews[0]
        ReviewService.delete_review(review.USER_ID, review.pk)
        self.assertEqual(self.payload()["state"], "pending")
        BusinessRatingWorkService.process(self.business.pk)
        self.assertEqual(self.aggregate().BRAT_REVIEW_COUNT, 4)

    def test_request_rollback_discards_demand_and_dispatch(self):
        """Keep callbacks and requested revisions inside the source transaction."""
        revision = self.aggregate().BRAT_REQUESTED_REVISION
        with patch.object(BusinessRatingWorkService, "dispatch") as dispatch:
            with self.captureOnCommitCallbacks(execute=True):
                try:
                    with transaction.atomic():
                        BusinessRatingWorkService.request_change(self.business.pk)
                        raise RuntimeError("rollback")
                except RuntimeError:
                    pass
            dispatch.assert_not_called()
        self.assertEqual(self.aggregate().BRAT_REQUESTED_REVISION, revision)

    def test_publication_rollback_restores_review_and_rating(self):
        """A later lifecycle failure rolls back publication and its rating demand."""
        review = self.create_review(self.business, 10, REVW_STATUS="under_review")
        revision = self.aggregate().BRAT_REQUESTED_REVISION
        with (
            patch.object(BusinessRatingWorkService, "dispatch") as dispatch,
            patch(
                "apps.reviews.services.review_service.ReviewInsightSchedulingService.review_changed",
                side_effect=RuntimeError("later failure"),
            ),
            self.captureOnCommitCallbacks(execute=True),
        ):
            with self.assertRaises(RuntimeError):
                ReviewService.publish_under_review(review.pk)
        dispatch.assert_not_called()
        review.refresh_from_db()
        self.assertEqual(review.REVW_STATUS, "under_review")
        self.assertEqual(self.aggregate().BRAT_REQUESTED_REVISION, revision)

    def test_dispatch_after_commit_and_broker_failure_recovery(self):
        """A failed publication cannot lose demand and due recovery redelivers it."""
        with patch(
            "apps.reviews.tasks.recalculate_business_rating.apply_async",
            side_effect=RuntimeError("broker unavailable"),
        ) as publish:
            with self.captureOnCommitCallbacks(execute=True):
                BusinessRatingWorkService.request_change(self.business.pk)
                publish.assert_not_called()
            publish.assert_called_once()
        self.assertGreater(
            self.aggregate().BRAT_REQUESTED_REVISION,
            self.aggregate().BRAT_COMPLETED_REVISION,
        )
        with patch("apps.reviews.tasks.recalculate_business_rating.apply_async") as publish:
            self.assertEqual(BusinessRatingWorkService.recover_pending(), 1)
            publish.assert_called_once()
        self.assertEqual(BusinessRatingWorkService.process(self.business.pk), "updated")
        self.assertEqual(BusinessRatingWorkService.process(self.business.pk), "unchanged")

    def test_aggregation_retry_does_not_invoke_inference(self):
        """Back off durable demand, bound delivery retries and recover without scoring."""
        BusinessRatingWorkService.request_change(self.business.pk)
        with (
            patch.object(BusinessRatingService, "recompute", side_effect=RuntimeError("SQL failed")),
            patch.object(recalculate_business_rating, "retry", side_effect=Retry()) as retry,
            patch("apps.reviews.services.review_sentiment_service.route_sentiment") as inference,
        ):
            with self.assertRaises(Retry):
                recalculate_business_rating.run(self.business.pk)
            retry.assert_called_once()
            inference.assert_not_called()
        self.assertEqual(self.payload()["state"], "unavailable")
        self.assertIsNone(self.payload()["contributing_review_count"])
        self.assertEqual(BusinessRatingWorkService.process(self.business.pk), "retry_wait")
        BusinessRating.objects.filter(BUSN_ID=self.business).update(
            BRAT_RETRY_AT=timezone.now() - timedelta(seconds=1),
        )
        self.assertEqual(BusinessRatingWorkService.process(self.business.pk), "updated")
        self.assertEqual(self.payload()["state"], "ready")
        self.assertEqual(self.aggregate().BRAT_LAST_ERROR, "")

    def test_old_failure_and_stale_recompute_cannot_overwrite_new_demand(self):
        """Fence failure metadata and direct revision-based publication."""
        BusinessRatingWorkService.request_change(self.business.pk)
        old_revision = self.aggregate().BRAT_REQUESTED_REVISION
        BusinessRatingWorkService.request_change(self.business.pk)
        self.assertIsNone(
            BusinessRatingWorkService.record_failure(
                self.business.pk,
                old_revision,
                "OldFailure",
            ),
        )
        BusinessRatingService.recompute(
            self.business.pk,
            BusinessRatingService.LEGACY_VERSION,
            allow_legacy=True,
            expected_revision=old_revision,
        )
        self.assertEqual(self.payload()["state"], "pending")
        BusinessRatingWorkService.process(self.business.pk)
        self.assertEqual(self.payload()["state"], "ready")

    def test_retry_exhaustion_retains_recoverable_demand(self):
        """Exhausting one delivery never acknowledges failed aggregate work."""
        BusinessRatingWorkService.request_change(self.business.pk)
        recalculate_business_rating.push_request(retries=3)
        try:
            with (
                patch.object(BusinessRatingService, "recompute", side_effect=RuntimeError("SQL failed")),
                patch.object(recalculate_business_rating, "retry") as retry,
            ):
                self.assertEqual(recalculate_business_rating.run(self.business.pk), "failed")
                retry.assert_not_called()
        finally:
            recalculate_business_rating.pop_request()
        self.assertGreater(
            self.aggregate().BRAT_REQUESTED_REVISION,
            self.aggregate().BRAT_COMPLETED_REVISION,
        )
        BusinessRating.objects.filter(BUSN_ID=self.business).update(
            BRAT_RETRY_AT=timezone.now() - timedelta(seconds=1),
        )
        with patch.object(BusinessRatingWorkService, "dispatch", return_value=True):
            self.assertEqual(BusinessRatingWorkService.recover_pending(), 1)

    def test_versioned_replacement_and_revocation_do_not_switch_policy(self):
        """Keep one selected methodology while explicitly replacing or revoking inputs."""
        for review in self.reviews:
            BusinessRatingService.record_result(
                review.pk,
                review.REVW_TEXT,
                -1,
                "negative",
                "future-v1",
            )
        BusinessRatingService.recompute(self.business.pk, "future-v1")
        review = self.reviews[0]
        BusinessRatingService.record_result(
            review.pk,
            review.REVW_TEXT,
            1,
            "positive",
            "future-v2",
        )
        self.assertEqual(self.aggregate().BRAT_SCORING_VERSION, "future-v1")
        BusinessRatingWorkService.process(self.business.pk)
        self.assertEqual(self.aggregate().BRAT_REVIEW_COUNT, 4)
        BusinessRatingService.invalidate_result(self.reviews[1].pk)
        BusinessRatingWorkService.process(self.business.pk)
        self.assertEqual(self.aggregate().BRAT_REVIEW_COUNT, 3)
        BusinessRatingService.recompute(
            self.business.pk,
            BusinessRatingService.LEGACY_VERSION,
            allow_legacy=True,
        )
        self.assertEqual(self.aggregate().BRAT_REVIEW_COUNT, 0)

    def test_versioned_edit_and_reversion_require_a_new_result(self):
        """A text edit revokes the original result even if the old text is restored."""
        for review in self.reviews:
            BusinessRatingService.record_result(
                review.pk,
                review.REVW_TEXT,
                1,
                "positive",
                "future-v1",
            )
        BusinessRatingService.recompute(self.business.pk, "future-v1")
        review = self.reviews[0]
        original_text = review.REVW_TEXT
        with patch(
            "apps.reviews.services.review_service.ReviewModerationService.moderate",
            return_value={"outcome": "safe", "findings": [], "checked_at": None},
        ):
            ReviewService.update_review(review.USER_ID, review.pk, text="Changed text.")
            ReviewService.update_review(review.USER_ID, review.pk, text=original_text)
        BusinessRatingWorkService.process(self.business.pk)
        self.assertEqual(self.aggregate().BRAT_REVIEW_COUNT, 4)

    @override_settings(BUSINESS_RATING_DEFAULT_SCORING_VERSION="future-default-v1")
    def test_missing_aggregates_bootstrap_the_configured_version(self):
        """Reconciliation can initialize empty all-time populations without inference."""
        BusinessRating.objects.all().delete()
        self.assertEqual(BusinessRatingWorkService.reconcile(), 1)
        self.assertEqual(self.aggregate().BRAT_SCORING_VERSION, "future-default-v1")
        BusinessRatingWorkService.process(self.business.pk)
        self.assertEqual(self.payload()["state"], "insufficient_data")
        self.assertEqual(self.payload()["contributing_review_count"], 0)

    def test_reconciliation_repairs_old_bulk_changes_without_inference(self):
        """Repair all-time drift after queryset updates that bypass service hooks."""
        Review.objects.filter(BUSN_ID=self.business).update(
            REVW_CREATED_AT=timezone.now() - timedelta(days=400),
        )
        Review.objects.filter(pk=self.reviews[0].pk).update(REVW_STATUS="rejected")
        BusinessRating.objects.filter(BUSN_ID=self.business).update(
            BRAT_COMPUTED_AT=timezone.now() - timedelta(hours=2),
        )
        with patch("apps.reviews.services.review_sentiment_service.route_sentiment") as inference:
            self.assertEqual(BusinessRatingWorkService.reconcile(), 1)
            BusinessRatingWorkService.process(self.business.pk)
            inference.assert_not_called()
        self.assertEqual(self.aggregate().BRAT_REVIEW_COUNT, 4)

    def test_all_time_inference_repair_is_explicit_and_separate(self):
        """The legacy opt-in repairs old missing scores while default insights stay windowed."""
        review = self.reviews[0]
        Review.objects.filter(pk=review.pk).update(
            REVW_CREATED_AT=timezone.now() - timedelta(days=400),
            REVW_SENTIMENT_SCORE=None,
            REVW_SENTIMENT_LABEL=None,
        )
        self.assertEqual(
            ReviewSentimentService.reconcile_business(self.business.pk)["attempted"],
            0,
        )
        with patch(
            "apps.reviews.services.review_sentiment_service.route_sentiment",
            return_value=(0, "Neutral", "test"),
        ) as inference:
            result = ReviewSentimentService.reconcile_business(
                self.business.pk,
                all_time=True,
            )
        self.assertEqual(result["updated"], 1)
        inference.assert_called_once()
        self.assertEqual(self.payload()["state"], "pending")

    def test_explicit_repair_command_and_parent_cascade(self):
        """Keep repair repeatable and avoid creating orphan rows during cascade deletion."""
        output = StringIO()
        call_command(
            "repair_rating_sentiment",
            "--business-id",
            str(self.business.pk),
            "--legacy-unverified",
            stdout=output,
        )
        self.assertIn("attempted=0", output.getvalue())
        self.business.delete()
        self.assertFalse(BusinessRating.objects.exists())

    def test_bulk_demand_deduplicates_ids(self):
        """Provide a transactional boundary for bulk status or score writers."""
        revision = self.aggregate().BRAT_REQUESTED_REVISION
        BusinessRatingWorkService.request_changes([self.business.pk, self.business.pk])
        self.assertEqual(self.aggregate().BRAT_REQUESTED_REVISION, revision + 1)

    @override_settings(BUSINESS_RATING_AUTO_UPDATES_ENABLED=False)
    def test_disabled_workers_retain_demand_and_report_disabled(self):
        """Pause delivery without losing a committed revision."""
        BusinessRatingWorkService.request_change(self.business.pk)
        self.assertFalse(self.payload()["automatic_updates_enabled"])
        self.assertEqual(BusinessRatingWorkService.process(self.business.pk), "disabled")
        self.assertEqual(BusinessRatingWorkService.recover_pending(), 0)


class BusinessRatingConcurrencyTests(SummaryFixtureMixin, TransactionTestCase):
    """Use independent PostgreSQL connections to exercise actual serialization."""

    def test_concurrent_deliveries_acknowledge_once_and_source_change_remains_pending(self):
        """Block a mutation behind aggregation and ensure its later revision survives."""
        business = self.create_business()
        review = self.create_review(business)
        with patch.object(BusinessRatingWorkService, "dispatch"):
            BusinessRatingWorkService.request_change(business.pk)
        entered = Event()
        release = Event()
        recompute = BusinessRatingService.recompute

        def slow_recompute(*args, **kwargs):
            """Hold the worker lock until the mutation has been submitted."""
            entered.set()
            if not release.wait(10):
                raise TimeoutError("Concurrent rating test timed out.")
            return recompute(*args, **kwargs)

        def process():
            """Run one task on an isolated connection."""
            try:
                return BusinessRatingWorkService.process(business.pk)
            finally:
                connections.close_all()

        def mutate():
            """Commit a new score and demand using the established review-first order."""
            try:
                with transaction.atomic():
                    current = Review.objects.select_for_update().get(pk=review.pk)
                    current.REVW_SENTIMENT_SCORE = -1
                    current.save(update_fields=["REVW_SENTIMENT_SCORE"])
                    BusinessRatingWorkService.request_change(business.pk)
            finally:
                connections.close_all()

        with (
            patch.object(BusinessRatingService, "recompute", side_effect=slow_recompute),
            patch.object(BusinessRatingWorkService, "dispatch"),
            ThreadPoolExecutor(max_workers=2) as executor,
        ):
            first = executor.submit(process)
            self.assertTrue(entered.wait(10))
            mutation = executor.submit(mutate)
            release.set()
            self.assertEqual(first.result(timeout=15), "updated")
            mutation.result(timeout=15)
        row = BusinessRating.objects.get(BUSN_ID=business)
        self.assertGreater(row.BRAT_REQUESTED_REVISION, row.BRAT_COMPLETED_REVISION)
        with ThreadPoolExecutor(max_workers=2) as executor:
            outcomes = list(executor.map(lambda _: process(), range(2)))
        self.assertCountEqual(outcomes, ["updated", "unchanged"])

