from concurrent.futures import ThreadPoolExecutor
from queue import Queue
from threading import Event
from time import monotonic
from unittest import skipUnless
from unittest.mock import patch

from django.db import close_old_connections, connection, transaction
from django.test import TestCase, TransactionTestCase
from django.urls import reverse
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.test import APIClient

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.moderation.services.manage_review_dispute_service import (
    ManageReviewDisputeService,
)
from apps.admin_operations.moderation.services.tests import (
    test_manage_review_dispute_service as dispute_tests,
)
from apps.notifications.models import Notification
from apps.review_disputes.models import MerchantReviewDispute
from apps.review_disputes.services.review_dispute_service import ReviewDisputeService
from apps.reviews.models import BusinessReviewSummary, Review
from apps.reviews.services.review_moderation_consistency_service import (
    ReviewModerationConsistencyService,
)
from apps.reviews.services.review_service import ReviewService
from apps.users.models import ReputationEvent


@skipUnless(connection.vendor == "postgresql", "Requires PostgreSQL row locks.")
class ReviewDeletionConcurrencyTests(TransactionTestCase):
    """Exercise deletion and decisions on independent PostgreSQL connections."""

    create_dispute = dispute_tests.ManageReviewDisputeServiceTests.create_dispute

    def setUp(self):
        dispute_tests.ManageReviewDisputeServiceTests.setUp(self)
        self.dispute = self.create_dispute()
        # A second published review makes a double decrement observable.
        Review.objects.create(
            USER_ID=self.second_explorer,
            BUSN_ID=self.business,
            REVW_TEXT="Another retained review.",
        )
        self.business.BUSN_REVIEW_COUNT = 2
        self.business.save(update_fields=["BUSN_REVIEW_COUNT"])
        self.starting_reputation = self.explorer.USER_REPUTATION

        for target in (
            "apps.reviews.tasks.refresh_business_review_insights.delay",
            "apps.notifications.services.notification_service."
            "NotificationRealtimeService.schedule",
        ):
            patcher = patch(target)
            patcher.start()
            self.addCleanup(patcher.stop)

    def _operate(
        self,
        operation,
    ):
        if operation == "delete":
            ReviewService.delete_review(
                user=self.explorer,
                review_id=self.review.pk,
            )
        elif operation == "withdraw":
            ReviewDisputeService.withdraw_dispute(
                user=self.merchant,
                dispute_id=self.dispute.pk,
            )
        else:
            method = getattr(
                ManageReviewDisputeService,
                f"{operation}_dispute",
            )
            method(
                dispute_id=self.dispute.pk,
                actor=self.admin,
            )

    def _worker(
        self,
        operation,
        backend_ids,
    ):
        close_old_connections()
        try:
            with connection.cursor() as cursor:
                cursor.execute("SET lock_timeout = '8s'")
                cursor.execute("SET statement_timeout = '12s'")
                cursor.execute("SELECT pg_backend_pid()")
                backend_ids.put(cursor.fetchone()[0])
            try:
                self._operate(operation)
            except NotFound as exc:
                return ("missing", str(exc.detail))
            except ValidationError:
                return ("resolved", None)
            return ("completed", None)
        finally:
            connection.close()

    def _assert_database_wait(
        self,
        backend_id,
        blocker_id,
        future,
    ):
        deadline = monotonic() + 5
        poll = Event()
        while monotonic() < deadline:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT %s = ANY(pg_blocking_pids(%s))",
                    [blocker_id, backend_id],
                )
                if cursor.fetchone()[0]:
                    self.assertFalse(future.done())
                    return
            if future.done():
                self.fail(f"Contender completed without waiting: {future.result()}")
            poll.wait(0.01)
        self.fail("Contender did not reach the PostgreSQL lock wait.")

    def _race(
        self,
        first,
        second,
        expected,
    ):
        backend_ids = Queue()
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_backend_pid()")
            blocker_id = cursor.fetchone()[0]

        with ThreadPoolExecutor(max_workers=1) as executor:
            with transaction.atomic():
                if first == "delete":
                    Review.objects.select_for_update().get(pk=self.review.pk)
                else:
                    self._operate(first)
                future = executor.submit(self._worker, second, backend_ids)
                backend_id = backend_ids.get(timeout=5)
                self.assertNotEqual(backend_id, blocker_id)
                self._assert_database_wait(backend_id, blocker_id, future)
                if first == "delete":
                    # A waiter must not hold the child while waiting on the parent.
                    MerchantReviewDispute.objects.select_for_update(
                        nowait=True,
                    ).get(pk=self.dispute.pk)
                    self._operate(first)
            outcome, message = future.result(timeout=15)

        self.assertEqual(outcome, expected)
        if expected == "missing":
            if second == "delete":
                expected_message = "The review could not be found."
            else:
                expected_message = "The review dispute could not be found."
            self.assertEqual(message, expected_message)

        deleted = first == "delete" or second == "delete"
        self.assertEqual(
            Review.objects.filter(pk=self.review.pk).exists(),
            not deleted,
        )
        self.assertEqual(
            MerchantReviewDispute.objects.filter(pk=self.dispute.pk).exists(),
            not deleted,
        )
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, 1)
        summary = BusinessReviewSummary.objects.get(BUSN_ID=self.business)
        self.assertEqual(summary.BRSU_REVIEW_COUNT, 1)

        upheld = first == "uphold"
        dismissed = first == "dismiss"
        self.assertEqual(ReputationEvent.objects.count(), int(upheld))
        self.assertEqual(AdminActivity.objects.count(), int(upheld or dismissed))
        if upheld:
            event = ReputationEvent.objects.get()
            self.assertEqual(
                event.REVT_EVENT_TYPE,
                ReputationEvent.EventType.CONFIRMED_VIOLATION_PENALTY,
            )
            self.explorer.refresh_from_db()
            self.assertEqual(
                self.explorer.USER_REPUTATION,
                self.starting_reputation + event.REVT_APPLIED_CHANGE,
            )
            self.assertEqual(Notification.objects.count(), 2)
            self.assertEqual(
                Notification.objects.filter(NOTF_TYPE="review_rejected").count(),
                1,
            )
        else:
            self.explorer.refresh_from_db()
            self.assertEqual(self.explorer.USER_REPUTATION, self.starting_reputation)
            self.assertEqual(Notification.objects.count(), int(dismissed))

    def test_deletion_commits_before_waiting_uphold(self):
        self._race("delete", "uphold", "missing")

    def test_uphold_commits_before_waiting_deletion(self):
        self._race("uphold", "delete", "completed")

    def test_deletion_commits_before_waiting_dismissal(self):
        self._race("delete", "dismiss", "missing")

    def test_dismissal_commits_before_waiting_deletion(self):
        self._race("dismiss", "delete", "completed")

    def test_deletion_commits_before_waiting_withdrawal(self):
        self._race("delete", "withdraw", "missing")

    def test_withdrawal_commits_before_waiting_deletion(self):
        self._race("withdraw", "delete", "completed")

    def test_two_deletions_decrement_once(self):
        self._race("delete", "delete", "missing")

    def test_competing_upholds_do_not_duplicate_effects(self):
        self._race("uphold", "uphold", "resolved")


class DeletedReviewResourceTests(TestCase):
    """Verify controlled service and HTTP responses after committed deletion."""

    setUp = dispute_tests.ManageReviewDisputeServiceTests.setUp
    create_dispute = dispute_tests.ManageReviewDisputeServiceTests.create_dispute

    def test_canonical_rejection_of_missing_review_is_not_found(self):
        with self.assertRaisesMessage(NotFound, "The review could not be found."):
            ReviewModerationConsistencyService.reject_review(999999)

    def test_deleted_review_and_dispute_endpoints_return_not_found(self):
        dispute = self.create_dispute()
        ReviewService.delete_review(
            user=self.explorer,
            review_id=self.review.pk,
        )
        client = APIClient()
        operations = (
            (
                self.admin,
                "admin-review-dispute-uphold",
                "post",
                "dispute_id",
                dispute.pk,
            ),
            (
                self.admin,
                "admin-review-dispute-dismiss",
                "post",
                "dispute_id",
                dispute.pk,
            ),
            (
                self.merchant,
                "review-dispute-withdraw",
                "post",
                "dispute_id",
                dispute.pk,
            ),
            (
                self.explorer,
                "review-detail",
                "delete",
                "review_id",
                self.review.pk,
            ),
        )
        for user, route, method, parameter, resource_id in operations:
            with self.subTest(route=route):
                client.force_authenticate(user=user)
                response = getattr(client, method)(
                    reverse(route, kwargs={parameter: resource_id}),
                    data={"admin_notes": "Reviewed the submitted dispute evidence."},
                    format="json",
                )
                self.assertEqual(response.status_code, 404)
                self.assertFalse(response.data["success"])
                self.assertEqual(response.data["code"], "NOT_FOUND")
        self.assertFalse(AdminActivity.objects.exists())
        self.assertFalse(ReputationEvent.objects.exists())
        self.assertFalse(Notification.objects.exists())
