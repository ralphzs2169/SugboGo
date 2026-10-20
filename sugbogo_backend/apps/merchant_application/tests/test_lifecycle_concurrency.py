from concurrent.futures import ThreadPoolExecutor
from threading import Event
from unittest.mock import patch

from django.db import close_old_connections, connection, transaction
from django.test import TransactionTestCase
from rest_framework.exceptions import ValidationError

from apps.admin_operations.business_management.services.manage_application_service import (
    ApplicationService as AdminApplicationService,
)
from apps.authentication.services.account_deactivation_service import AccountDeactivationService
from apps.business.models import Business
from apps.merchant_application.services.application_service import ApplicationService
from apps.merchant_application.tests.test_services import MerchantApplicationServiceMixin
from apps.users.models import User


class MerchantLifecycleConcurrencyTests(MerchantApplicationServiceMixin, TransactionTestCase):
    """Verify account transitions and approval against real PostgreSQL row locks."""

    def setUp(self):
        super().setUp()
        self.user.USER_ROLE = User.UserRole.EXPLORER
        self.user.save(update_fields=["USER_ROLE"])
        self.admin = User.objects.create_user(
            email="concurrent-merchant-admin@example.com", password=None,
            USER_FNAME="Admin", USER_LNAME="Reviewer",
            USER_ROLE=User.UserRole.ADMIN, USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.application = ApplicationService.submit_application(self._build_complete_application())
        self.realtime = patch("apps.notifications.services.notification_realtime_service.NotificationRealtimeService.schedule")
        self.realtime.start()
        self.addCleanup(self.realtime.stop)

    def run_on_connection(self, operation, *, locking=None, completed=None):
        """Run one service operation on its own connection and report lock attempts."""
        close_old_connections()

        def observe(execute, sql, params, many, context):
            if locking is not None and "FOR UPDATE" in sql and '"users_user"' in sql:
                locking.set()
            return execute(sql, params, many, context)

        try:
            with connection.execute_wrapper(observe):
                try:
                    operation()
                    return "success"
                except ValidationError:
                    return "ineligible"
        finally:
            if completed is not None:
                completed.set()
            close_old_connections()

    def approve(self):
        AdminApplicationService.approve_application(self.application.pk, self.admin)

    def deactivate(self):
        AccountDeactivationService.deactivate(user=self.user, current_password="StrongPassword123!")

    def test_deactivation_committing_first_prevents_approval(self):
        locking, completed = Event(), Event()
        with ThreadPoolExecutor(max_workers=1) as pool:
            with transaction.atomic():
                User.objects.select_for_update().get(pk=self.user.pk)
                future = pool.submit(self.run_on_connection, self.approve, locking=locking, completed=completed)
                self.assertTrue(locking.wait(timeout=10))
                self.assertFalse(completed.wait(timeout=0.2))
                self.deactivate()
            self.assertEqual(future.result(timeout=10), "ineligible")
        self.assertFalse(Business.objects.filter(USER_ID=self.user).exists())
        self.application.refresh_from_db()
        self.user.refresh_from_db()
        self.assertEqual(self.application.MAPP_STATUS, "submitted")
        self.assertEqual(self.user.USER_STATUS, "disabled")
        self.assertEqual(self.user.USER_ROLE, "explorer")

    def test_approval_holds_account_lock_until_business_and_role_are_committed(self):
        creating, release, locking, completed = Event(), Event(), Event(), Event()
        create_business = Business.objects.create

        def delayed_create(*args, **kwargs):
            creating.set()
            if not release.wait(timeout=10):
                raise AssertionError("Approval was not released")
            return create_business(*args, **kwargs)

        with patch("apps.admin_operations.business_management.services.manage_application_service.Business.objects.create", side_effect=delayed_create):
            with ThreadPoolExecutor(max_workers=2) as pool:
                approval = pool.submit(self.run_on_connection, self.approve)
                try:
                    self.assertTrue(creating.wait(timeout=10))
                    deactivation = pool.submit(self.run_on_connection, self.deactivate, locking=locking, completed=completed)
                    self.assertTrue(locking.wait(timeout=10))
                    self.assertFalse(completed.wait(timeout=0.2))
                finally:
                    release.set()
                self.assertEqual(approval.result(timeout=10), "success")
                self.assertEqual(deactivation.result(timeout=10), "success")
        self.application.refresh_from_db()
        self.user.refresh_from_db()
        self.assertEqual(self.application.MAPP_STATUS, "approved")
        self.assertEqual(Business.objects.filter(USER_ID=self.user).count(), 1)
        self.assertEqual(self.user.USER_ROLE, "merchant")
        self.assertEqual(self.user.USER_STATUS, "disabled")
