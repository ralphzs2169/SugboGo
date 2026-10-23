from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event, local
from unittest.mock import patch

from django.db import connection, connections
from django.test import TransactionTestCase

from apps.admin_operations.system_configuration.models import AnalyticsPolicyConfiguration
from apps.reviews.models import BusinessReviewSummary, Review
from apps.reviews.services.business_review_summary_service import (
    BusinessReviewSummaryService,
)
from apps.reviews.services.review_moderation_consistency_service import (
    ReviewModerationConsistencyService,
)
from apps.reviews.services.review_sentiment_service import ReviewSentimentService
from apps.reviews.services.review_service import ReviewService
from apps.reviews.services.tests.test_business_review_summary_service import (
    SummaryFixtureMixin,
)


class ReviewSentimentConcurrencyTests(SummaryFixtureMixin, TransactionTestCase):
    """Exercise score/result fencing and aggregate serialization on PostgreSQL."""

    def setUp(self):
        if connection.vendor != "postgresql":
            self.skipTest("Requires PostgreSQL transaction visibility.")
        AnalyticsPolicyConfiguration.objects.get_or_create(pk=1)
        self.business = self.create_business()
        self.review = self.create_review(
            self.business,
            REVW_SENTIMENT_SCORE=None,
            REVW_SENTIMENT_LABEL=None,
        )
        self.worker = local()

    def _process(
        self,
        review_id,
        role=None,
    ):
        """Run classification with a separate connection and worker identity."""
        self.worker.role = role
        try:
            return ReviewSentimentService.process_review(review_id)
        finally:
            connections.close_all()

    def _assert_duplicate_race(
        self,
        fail_first_aggregate=False,
    ):
        """A second in-flight inference must repair rather than replace the winner."""
        both_inferring = Barrier(2)
        release_second = Event()
        recompute = BusinessReviewSummaryService.recompute_sentiment

        def score(text):
            both_inferring.wait(timeout=10)
            if self.worker.role == "second":
                if not release_second.wait(10):
                    raise TimeoutError("Second inference was not released.")
                return -0.6, "Negative", "vader"
            return 0.7, "Positive", "vader"

        def aggregate(business_id):
            if fail_first_aggregate and self.worker.role == "first":
                raise RuntimeError("aggregate unavailable")
            return recompute(business_id)

        with (
            patch(
                "apps.reviews.services.review_sentiment_service.route_sentiment",
                side_effect=score,
            ) as scorer,
            patch.object(
                BusinessReviewSummaryService,
                "recompute_sentiment",
                side_effect=aggregate,
            ),
            ThreadPoolExecutor(max_workers=2) as executor,
        ):
            first = executor.submit(self._process, self.review.pk, "first")
            second = executor.submit(self._process, self.review.pk, "second")
            try:
                if fail_first_aggregate:
                    with self.assertRaisesMessage(RuntimeError, "aggregate unavailable"):
                        first.result(timeout=10)
                else:
                    self.assertEqual(first.result(timeout=10), "updated")
            finally:
                release_second.set()
            self.assertEqual(second.result(timeout=10), "already_scored")

        self.assertEqual(scorer.call_count, 2)
        self.review.refresh_from_db()
        self.assertEqual(self.review.REVW_SENTIMENT_SCORE, 0.7)
        self.assertEqual(self.review.REVW_SENTIMENT_LABEL, "positive")
        summary = BusinessReviewSummary.objects.get(BUSN_ID=self.business)
        self.assertEqual(summary.BRSU_CLASSIFIED_REVIEW_COUNT, 1)
        self.assertEqual(summary.BRSU_POSITIVE_COUNT, 1)
        self.assertEqual(summary.BRSU_NEGATIVE_COUNT, 0)

    def test_duplicate_inflight_classification_preserves_winning_score(self):
        self._assert_duplicate_race()

    def test_inflight_duplicate_repairs_failed_aggregate_after_winning_score(self):
        self._assert_duplicate_race(fail_first_aggregate=True)

    def _assert_multiple_reviews(
        self,
        existing_summary=False,
    ):
        """Concurrent committed scores must both survive serialized aggregation."""
        second_review = self.create_review(
            self.business,
            1,
            REVW_TEXT="Negative experience.",
            REVW_SENTIMENT_SCORE=None,
            REVW_SENTIMENT_LABEL=None,
        )
        if existing_summary:
            BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        both_committed = Barrier(2)
        recompute = BusinessReviewSummaryService.recompute_sentiment

        def aggregate(business_id):
            both_committed.wait(timeout=10)
            return recompute(business_id)

        def score(text):
            if text == second_review.REVW_TEXT:
                return -0.6, "Negative", "vader"
            return 0.7, "Positive", "vader"

        with (
            patch(
                "apps.reviews.services.review_sentiment_service.route_sentiment",
                side_effect=score,
            ),
            patch.object(
                BusinessReviewSummaryService,
                "recompute_sentiment",
                side_effect=aggregate,
            ),
            ThreadPoolExecutor(max_workers=2) as executor,
        ):
            first = executor.submit(self._process, self.review.pk)
            second = executor.submit(self._process, second_review.pk)
            self.assertEqual(first.result(timeout=10), "updated")
            self.assertEqual(second.result(timeout=10), "updated")

        summary = BusinessReviewSummary.objects.get(BUSN_ID=self.business)
        self.assertEqual(summary.BRSU_REVIEW_COUNT, 2)
        self.assertEqual(summary.BRSU_CLASSIFIED_REVIEW_COUNT, 2)
        self.assertEqual(summary.BRSU_POSITIVE_COUNT, 1)
        self.assertEqual(summary.BRSU_NEGATIVE_COUNT, 1)
        self.assertEqual(BusinessReviewSummary.objects.count(), 1)

    def test_multiple_reviews_with_concurrent_initial_summary_creation(self):
        self._assert_multiple_reviews()

    def test_multiple_reviews_with_existing_summary(self):
        self._assert_multiple_reviews(existing_summary=True)

    def _assert_source_mutation(
        self,
        mutation,
    ):
        """Finish inference after a separately committed lifecycle mutation."""
        inferring = Event()
        release = Event()

        def score(text):
            inferring.set()
            if not release.wait(10):
                raise TimeoutError("Inference was not released.")
            return 0.7, "Positive", "vader"

        with (
            patch(
                "apps.reviews.services.review_sentiment_service.route_sentiment",
                side_effect=score,
            ),
            ThreadPoolExecutor(max_workers=1) as executor,
        ):
            pending = executor.submit(self._process, self.review.pk)
            try:
                self.assertTrue(inferring.wait(10))
                if mutation == "reject":
                    ReviewModerationConsistencyService.reject_review(self.review.pk)
                    expected = "ineligible"
                elif mutation == "delete":
                    ReviewService.delete_review(
                        user=self.review.USER_ID,
                        review_id=self.review.pk,
                    )
                    expected = "missing"
                else:
                    Review.objects.filter(pk=self.review.pk).update(
                        REVW_TEXT="Newer accepted text.",
                        REVW_SENTIMENT_SCORE=-0.6,
                        REVW_SENTIMENT_LABEL="negative",
                    )
                    BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
                    expected = "stale"
            finally:
                release.set()
            self.assertEqual(pending.result(timeout=10), expected)

        summary = BusinessReviewSummary.objects.get(BUSN_ID=self.business)
        self.assertEqual(summary.BRSU_POSITIVE_COUNT, 0)
        if mutation == "edit":
            self.review.refresh_from_db()
            self.assertEqual(self.review.REVW_SENTIMENT_LABEL, "negative")
            self.assertEqual(summary.BRSU_NEGATIVE_COUNT, 1)
        else:
            self.assertEqual(summary.BRSU_REVIEW_COUNT, 0)
            self.assertEqual(summary.BRSU_CLASSIFIED_REVIEW_COUNT, 0)

    def test_rejection_during_inference(self):
        self._assert_source_mutation("reject")

    def test_deletion_during_inference(self):
        self._assert_source_mutation("delete")

    def test_newer_edit_and_score_during_inference(self):
        self._assert_source_mutation("edit")
