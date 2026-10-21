"""Exercise duplicate advisory locks with real PostgreSQL connections."""

from concurrent.futures import ThreadPoolExecutor
from threading import Event
from unittest.mock import patch

from django.db import close_old_connections, connection, transaction
from django.test import TransactionTestCase
from rest_framework.exceptions import ValidationError
from apps.merchant_application.services.review_submission_service import StaleApplicationSubmission

from apps.admin_operations.business_management.services.manage_application_service import (
    ApplicationService as AdminApplicationService,
)
from apps.business.models import Business
from apps.merchant_application.services.application_service import ApplicationService
from apps.merchant_application.tests.test_duplicate_business_review import DuplicateBusinessReviewTests
from apps.merchant_application.tests.test_services import MerchantApplicationServiceMixin
from apps.users.models import User
from apps.merchant_application.services.identity_service import IdentityService


class DuplicateApprovalConcurrencyTests(MerchantApplicationServiceMixin, TransactionTestCase):
    """Ensure serialized approvals recheck matches without reversing account locks."""

    create_target = DuplicateBusinessReviewTests.create_target
    assess = DuplicateBusinessReviewTests.assess

    def setUp(self):
        super().setUp()
        self.application = ApplicationService.submit_application(self._build_complete_application())
        self.admin = User.objects.create_user(
            email="duplicate-lock-admin@example.com",
            password=None,
            USER_FNAME="Admin",
            USER_LNAME="Locks",
            USER_ROLE="admin",
            USER_STATUS="active",
        )
        self.target = self.create_target()
        notification = patch(
            "apps.notifications.services.notification_event_service."
            "NotificationEventService.merchant_application_resolved",
        )
        notification.start()
        self.addCleanup(notification.stop)

    def run_approval(
        self,
        application_id,
        *,
        advisory_attempt=None,
        account_attempt=None,
        expected_submission_id=None,
    ):
        """Use a separate connection and report the exact lock acquisition attempts."""
        close_old_connections()

        def observe(execute, sql, params, many, context):
            """Signal blocked SQL calls without replacing real database locking."""
            if advisory_attempt is not None and "pg_advisory_xact_lock" in sql:
                advisory_attempt.set()
            if account_attempt is not None and "FOR UPDATE" in sql and '"users_user"' in sql:
                account_attempt.set()
            return execute(sql, params, many, context)

        try:
            with connection.execute_wrapper(observe):
                try:
                    AdminApplicationService.approve_application(
                        application_id,
                        self.admin,
                        expected_submission_id=expected_submission_id,
                    )
                    return "approved"
                except (ValidationError, StaleApplicationSubmission):
                    return "blocked"
        finally:
            close_old_connections()

    def test_second_account_waits_and_cannot_bypass_review_after_first_approval(self):
        self.assess()
        creating = Event()
        release = Event()
        second_attempt = Event()
        create_business = Business.objects.create

        def delayed_create(*args, **kwargs):
            """Hold the first approval after its check but before permanent creation."""
            creating.set()
            if not release.wait(timeout=10):
                raise AssertionError("First approval was not released.")
            return create_business(*args, **kwargs)

        with patch(
            "apps.admin_operations.business_management.services.manage_application_service."
            "Business.objects.create",
            side_effect=delayed_create,
        ):
            with ThreadPoolExecutor(max_workers=2) as pool:
                first = pool.submit(self.run_approval, self.application.pk)
                try:
                    self.assertTrue(creating.wait(timeout=10))
                    second = pool.submit(
                        self.run_approval,
                        self.target.pk,
                        advisory_attempt=second_attempt,
                    )
                    self.assertTrue(second_attempt.wait(timeout=10))
                    self.assertFalse(second.done())
                finally:
                    release.set()
                self.assertEqual(first.result(timeout=10), "approved")
                self.assertEqual(second.result(timeout=10), "blocked")
        self.assertEqual(Business.objects.count(), 1)
        self.target.refresh_from_db()
        self.assertEqual(self.target.MAPP_STATUS, "submitted")

    def test_ordinary_rejection_can_finish_while_approval_waits_for_account(self):
        account_attempt = Event()
        with ThreadPoolExecutor(max_workers=1) as pool:
            with transaction.atomic():
                User.objects.select_for_update().get(pk=self.user.pk)
                approval = pool.submit(
                    self.run_approval,
                    self.application.pk,
                    account_attempt=account_attempt,
                )
                self.assertTrue(account_attempt.wait(timeout=10))
                AdminApplicationService.reject_application(
                    self.application.pk,
                    [{"section": "identity", "message": "Correct the contact details."}],
                    self.admin,
                )
            self.assertEqual(approval.result(timeout=10), "blocked")
        self.assertFalse(Business.objects.exists())

    def test_waiting_approval_cannot_decide_a_replacement_submission(self):
        self.assess()
        previous = self.application.submissions.last()
        account_attempt = Event()
        with ThreadPoolExecutor(max_workers=1) as pool:
            with transaction.atomic():
                User.objects.select_for_update().get(pk=self.user.pk)
                approval = pool.submit(
                    self.run_approval,
                    self.application.pk,
                    account_attempt=account_attempt,
                    expected_submission_id=previous.pk,
                )
                self.assertTrue(account_attempt.wait(timeout=10))
                AdminApplicationService.reject_application(
                    self.application.pk,
                    [{"section": "identity", "message": "Correct the contact details."}],
                    self.admin,
                    expected_submission_id=previous.pk,
                )
                IdentityService.save_identity(
                    self.user,
                    {"MIDN_CONTACT_NUMBER": "09999999999"},
                )
                ApplicationService.submit_application(self.application)
            self.assertEqual(approval.result(timeout=10), "blocked")
        self.application.refresh_from_db()
        self.assertEqual(self.application.MAPP_STATUS, "submitted")
        self.assertEqual(self.application.submissions.count(), 2)
        self.assertFalse(Business.objects.exists())
