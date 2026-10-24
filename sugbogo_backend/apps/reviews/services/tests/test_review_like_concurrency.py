from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event, Lock

from django.db import connection, connections, transaction
from django.test import TransactionTestCase
from rest_framework.exceptions import NotFound, ValidationError

from apps.admin_operations.system_configuration.models import AnalyticsPolicyConfiguration
from apps.reviews.models import Review, ReviewLike
from apps.reviews.services.review_like_service import ReviewLikeService
from apps.reviews.services.review_moderation_consistency_service import (
    ReviewModerationConsistencyService,
)
from apps.reviews.services.review_service import ReviewService
from apps.reviews.services.tests.test_business_review_summary_service import (
    SummaryFixtureMixin,
)
from apps.users.models import User


class ReviewLikeConcurrencyTests(SummaryFixtureMixin, TransactionTestCase):
    """Verify persisted counters against real concurrent PostgreSQL requests."""

    def setUp(self):
        if connection.vendor != "postgresql":
            self.skipTest("Requires PostgreSQL row locks.")
        AnalyticsPolicyConfiguration.objects.get_or_create(pk=1)
        self.business = self.create_business()
        self.review = self.create_review(self.business)
        self.user = self.review.USER_ID
        self.other_user = User.objects.create_user(
            email="other-review-liker@example.com",
            password=None,
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

    def _assert_duplicate_unlikes(
        self,
        keep_other_like=False,
    ):
        """Keep the parent locked so both legacy unlocked reads can see one like."""
        ReviewLikeService.create_like(
            user=self.user,
            review_id=self.review.pk,
        )
        if keep_other_like:
            ReviewLikeService.create_like(
                user=self.other_user,
                review_id=self.review.pk,
            )
        both_started = Event()
        both_read_like = Event()
        observation_lock = Lock()
        started_count = 0
        read_count = 0

        def remove():
            first_query = True

            def observe(
                execute,
                sql,
                params,
                many,
                context,
            ):
                nonlocal first_query, started_count, read_count
                if first_query and sql.startswith("SELECT"):
                    first_query = False
                    with observation_lock:
                        started_count += 1
                        if started_count == 2:
                            both_started.set()
                result = execute(sql, params, many, context)
                if sql.startswith("SELECT") and '"REVIEW_LIKE"' in sql:
                    with observation_lock:
                        read_count += 1
                        if read_count == 2:
                            both_read_like.set()
                return result

            try:
                with connections["default"].execute_wrapper(observe):
                    ReviewLikeService.remove_like(
                        user=self.user,
                        review_id=self.review.pk,
                    )
                return "removed"
            except NotFound:
                return "missing"
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as executor:
            with transaction.atomic():
                Review.objects.select_for_update().get(pk=self.review.pk)
                first = executor.submit(remove)
                second = executor.submit(remove)
                self.assertTrue(both_started.wait(5))
                # Correctly serialized removals wait before reading the child row.
                both_read_like.wait(1)
            outcomes = [
                first.result(timeout=10),
                second.result(timeout=10),
            ]

        self.review.refresh_from_db()
        remaining_count = ReviewLike.objects.filter(REVW_ID=self.review).count()
        self.assertEqual(self.review.REVW_LIKE_COUNT, remaining_count)
        self.assertCountEqual(outcomes, ["removed", "missing"])
        self.assertFalse(
            ReviewLike.objects.filter(REVW_ID=self.review, USER_ID=self.user).exists(),
        )
        self.assertEqual(remaining_count, int(keep_other_like))

    def test_concurrent_unlikes_decrement_once_while_other_like_remains(self):
        self._assert_duplicate_unlikes(keep_other_like=True)

    def test_concurrent_unlikes_of_only_like(self):
        self._assert_duplicate_unlikes()

    def _run_concurrently(
        self,
        operations,
    ):
        """Start two service requests together and retain their API-level outcomes."""
        ready = Barrier(2)

        def run(operation):
            try:
                ready.wait(timeout=10)
                operation()
                return "success"
            except NotFound:
                return "missing"
            except ValidationError:
                return "duplicate"
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = [
                executor.submit(run, operation)
                for operation in operations
            ]
            return [
                future.result(timeout=10)
                for future in futures
            ]

    def _create(
        self,
        user,
    ):
        """Create a like through the service using the requested identity."""
        return ReviewLikeService.create_like(
            user=user,
            review_id=self.review.pk,
        )

    def _remove(
        self,
        user,
    ):
        """Remove a like through the service using the requested identity."""
        return ReviewLikeService.remove_like(
            user=user,
            review_id=self.review.pk,
        )

    def _assert_count(
        self,
        expected,
    ):
        """Check both persisted representations of the like population."""
        self.review.refresh_from_db()
        self.assertEqual(self.review.REVW_LIKE_COUNT, expected)
        self.assertEqual(
            ReviewLike.objects.filter(REVW_ID=self.review).count(),
            expected,
        )

    def test_concurrent_removal_of_distinct_likes(self):
        self._create(self.user)
        self._create(self.other_user)
        outcomes = self._run_concurrently([
            lambda: self._remove(self.user),
            lambda: self._remove(self.other_user),
        ])
        self.assertEqual(outcomes, ["success", "success"])
        self._assert_count(0)

    def test_concurrent_like_and_unlike_by_different_users(self):
        self._create(self.user)
        outcomes = self._run_concurrently([
            lambda: self._remove(self.user),
            lambda: self._create(self.other_user),
        ])
        self.assertEqual(outcomes, ["success", "success"])
        self._assert_count(1)
        self.assertEqual(ReviewLike.objects.get().USER_ID_id, self.other_user.pk)

    def test_concurrent_relike_and_unlike_by_same_user(self):
        self._create(self.user)
        outcomes = self._run_concurrently([
            lambda: self._remove(self.user),
            lambda: self._create(self.user),
        ])
        self.assertEqual(outcomes[0], "success")
        self.assertIn(outcomes[1], ("success", "duplicate"))
        self._assert_count(int(outcomes[1] == "success"))

    def test_concurrent_first_like_and_unlike_by_same_user(self):
        outcomes = self._run_concurrently([
            lambda: self._remove(self.user),
            lambda: self._create(self.user),
        ])
        self.assertIn(outcomes[0], ("success", "missing"))
        self.assertEqual(outcomes[1], "success")
        self._assert_count(int(outcomes[0] == "missing"))

    def test_concurrent_duplicate_like_creation(self):
        outcomes = self._run_concurrently([
            lambda: self._create(self.user),
            lambda: self._create(self.user),
        ])
        self.assertCountEqual(outcomes, ["success", "duplicate"])
        self._assert_count(1)

    def _assert_lifecycle_race(
        self,
        mutation,
        removal_first=False,
    ):
        """Exercise unlike and lifecycle writes in both review-lock orders."""
        self._create(self.user)
        attempting_lock = Event()
        completed = Event()

        def mutate():
            if mutation == "reject":
                ReviewModerationConsistencyService.reject_review(self.review.pk)
            else:
                ReviewService.delete_review(
                    user=self.user,
                    review_id=self.review.pk,
                )

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

        def run():
            try:
                with connections["default"].execute_wrapper(observe_lock):
                    if removal_first:
                        mutate()
                    else:
                        self._remove(self.user)
                return "success"
            except NotFound as exc:
                self.assertEqual(str(exc), "Your like could not be found.")
                return "missing"
            finally:
                completed.set()
                connections.close_all()

        with ThreadPoolExecutor(max_workers=1) as executor:
            with transaction.atomic():
                if removal_first:
                    self._remove(self.user)
                else:
                    Review.objects.select_for_update().get(pk=self.review.pk)
                pending = executor.submit(run)
                self.assertTrue(attempting_lock.wait(5))
                self.assertFalse(completed.wait(0.1))
                if not removal_first:
                    mutate()
            expected = "success"
            if mutation == "delete" and not removal_first:
                expected = "missing"
            self.assertEqual(pending.result(timeout=10), expected)

        if mutation == "delete":
            self.assertFalse(Review.objects.filter(pk=self.review.pk).exists())
            self.assertFalse(ReviewLike.objects.exists())
        else:
            self._assert_count(0)
            self.assertEqual(self.review.REVW_STATUS, Review.ReviewStatus.REJECTED)

    def test_rejection_before_unlike(self):
        self._assert_lifecycle_race("reject")

    def test_unlike_before_rejection(self):
        self._assert_lifecycle_race("reject", removal_first=True)

    def test_deletion_before_unlike(self):
        self._assert_lifecycle_race("delete")

    def test_unlike_before_deletion(self):
        self._assert_lifecycle_race("delete", removal_first=True)
