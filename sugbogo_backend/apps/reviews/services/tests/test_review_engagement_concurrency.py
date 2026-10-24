from concurrent.futures import ThreadPoolExecutor
from threading import Event

from django.db import connection, connections, transaction
from django.test import TransactionTestCase
from rest_framework.exceptions import NotFound

from apps.admin_operations.system_configuration.models import AnalyticsPolicyConfiguration
from apps.reviews.models import Review, ReviewLike, ReviewReply
from apps.reviews.services.review_like_service import ReviewLikeService
from apps.reviews.services.review_moderation_consistency_service import (
    ReviewModerationConsistencyService,
)
from apps.reviews.services.review_reply_service import ReviewReplyService
from apps.reviews.services.review_service import ReviewService
from apps.reviews.services.tests.test_business_review_summary_service import (
    SummaryFixtureMixin,
)


class ReviewEngagementConcurrencyTests(SummaryFixtureMixin, TransactionTestCase):
    """Check publication enforcement with separate PostgreSQL transactions."""

    def setUp(self):
        if connection.vendor != "postgresql":
            self.skipTest("Requires PostgreSQL row locks.")
        AnalyticsPolicyConfiguration.objects.get_or_create(pk=1)
        self.business = self.create_business()
        self.review = self.create_review(self.business)
        self.author = self.review.USER_ID
        self.owner = self.business.USER_ID

    def _engage(
        self,
        kind,
    ):
        """Create the requested engagement using its actual service."""
        if kind == "like":
            return ReviewLikeService.create_like(
                user=self.author,
                review_id=self.review.pk,
            )
        return ReviewReplyService.create_reply(
            user=self.owner,
            review_id=self.review.pk,
            text="Thank you for visiting.",
        )

    def _assert_mutation_wins(
        self,
        kind,
        delete=False,
    ):
        """Hold the review lock until rejection or deletion has committed."""
        attempting_lock = Event()
        completed = Event()

        def observe_lock(
            execute,
            sql,
            params,
            many,
            context,
        ):
            if "FOR UPDATE" in sql:
                attempting_lock.set()
            return execute(sql, params, many, context)

        def engage():
            try:
                with connections["default"].execute_wrapper(observe_lock):
                    self._engage(kind)
                return "created"
            except NotFound:
                return "unavailable"
            finally:
                completed.set()
                connections.close_all()

        with ThreadPoolExecutor(max_workers=1) as executor:
            with transaction.atomic():
                Review.objects.select_for_update().get(pk=self.review.pk)
                pending = executor.submit(engage)
                self.assertTrue(attempting_lock.wait(5))
                self.assertFalse(completed.wait(0.1))
                if delete:
                    ReviewService.delete_review(
                        user=self.author,
                        review_id=self.review.pk,
                    )
                else:
                    ReviewModerationConsistencyService.reject_review(self.review.pk)
            self.assertEqual(pending.result(timeout=10), "unavailable")

        self.assertFalse(ReviewLike.objects.exists())
        self.assertFalse(ReviewReply.objects.exists())
        if delete:
            self.assertFalse(Review.objects.filter(pk=self.review.pk).exists())
        else:
            self.review.refresh_from_db()
            self.assertEqual(self.review.REVW_STATUS, Review.ReviewStatus.REJECTED)
            self.assertEqual(self.review.REVW_LIKE_COUNT, 0)

    def test_rejection_commits_before_like_creation(self):
        self._assert_mutation_wins("like")

    def test_rejection_commits_before_reply_creation(self):
        self._assert_mutation_wins("reply")

    def test_deletion_commits_before_like_creation(self):
        self._assert_mutation_wins("like", delete=True)

    def test_deletion_commits_before_reply_creation(self):
        self._assert_mutation_wins("reply", delete=True)

    def _assert_engagement_wins(
        self,
        kind,
    ):
        """Verify rejection waits for accepted engagement and forbids later writes."""
        attempting_lock = Event()
        completed = Event()

        def observe_lock(
            execute,
            sql,
            params,
            many,
            context,
        ):
            if "FOR UPDATE" in sql:
                attempting_lock.set()
            return execute(sql, params, many, context)

        def reject():
            try:
                with connections["default"].execute_wrapper(observe_lock):
                    ReviewModerationConsistencyService.reject_review(self.review.pk)
            finally:
                completed.set()
                connections.close_all()

        with ThreadPoolExecutor(max_workers=1) as executor:
            with transaction.atomic():
                engagement = self._engage(kind)
                pending = executor.submit(reject)
                self.assertTrue(attempting_lock.wait(5))
                self.assertFalse(completed.wait(0.1))
            pending.result(timeout=10)

        self.review.refresh_from_db()
        self.assertEqual(self.review.REVW_STATUS, Review.ReviewStatus.REJECTED)
        with self.assertRaises(NotFound):
            self._engage(kind)
        if kind == "like":
            self.assertEqual(ReviewLike.objects.get().pk, engagement.pk)
            self.assertEqual(self.review.REVW_LIKE_COUNT, 1)
            self.assertFalse(ReviewReply.objects.exists())
        else:
            self.assertEqual(ReviewReply.objects.get().pk, engagement.pk)
            self.assertEqual(self.review.REVW_LIKE_COUNT, 0)
            self.assertFalse(ReviewLike.objects.exists())

    def test_accepted_like_creation_commits_before_rejection(self):
        self._assert_engagement_wins("like")

    def test_accepted_reply_creation_commits_before_rejection(self):
        self._assert_engagement_wins("reply")
