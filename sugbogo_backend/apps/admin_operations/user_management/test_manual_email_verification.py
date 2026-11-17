from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from unittest.mock import patch

from django.contrib import admin
from django.db import connections
from django.test import skipUnlessDBFeature
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase, APITransactionTestCase
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from rest_framework_simplejwt.tokens import RefreshToken

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.activity_management.services import AdminActivityService
from apps.authentication.models import OAuthAccount
from apps.authentication.tokens import (
    email_verification_token_generator,
    password_reset_token_generator,
)
from apps.merchant_application.models import MerchantApplication
from apps.users.models import User


class ManualVerificationSetup:
    """Prepare a reviewed account and a valid manual verification request."""

    def setUp(self):
        super().setUp()
        self.actor = User.objects.create_user(
            email="super-admin@example.com",
            USER_ROLE=User.UserRole.SUPER_ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
            EMAIL_VERIFIED=True,
        )
        self.target = User.objects.create_user(
            email="target@example.com",
            password="Initial-password-15!",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.client.force_authenticate(self.actor)
        self.detail_url = reverse(
            "admin-user-detail",
            args=[self.target.pk],
        )
        self.url = reverse(
            "admin-user-verify-email",
            args=[self.target.pk],
        )
        self.payload = {
            "reason": "The link would not open. Ownership and account control were confirmed in CASE-123456.",
            "ownership_confirmed": True,
            "verification_snapshot": self.get_snapshot(),
        }

    def get_snapshot(self):
        """Fetch the snapshot shown to the acting administrator."""
        return self.client.get(self.detail_url).data["data"]["verification_snapshot"]

    def audit_events(self):
        """Find manual verification decisions for the selected account."""
        return AdminActivity.objects.filter(
            TARGET_USER_ID=self.target,
            AACT_ACTION=AdminActivity.Action.USER_EMAIL_MANUALLY_VERIFIED,
        )

    def submit(
        self,
        payload=None,
    ):
        """Submit the attestation through the Admin Panel route."""
        return self.client.post(
            self.url,
            self.payload if payload is None else payload,
            format="json",
        )


class ManualEmailVerificationTests(ManualVerificationSetup, APITestCase):
    """Verify the authorization, state transition, and transactional audit."""

    def test_only_super_admin_can_get_snapshot_and_post(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.submit().status_code, 401)

        ordinary_admin = User.objects.create_user(
            email="admin@example.com",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
            EMAIL_VERIFIED=True,
            is_staff=True,
        )
        self.client.force_authenticate(ordinary_admin)
        self.assertNotIn(
            "verification_snapshot",
            self.client.get(self.detail_url).data["data"],
        )
        self.assertEqual(self.submit().status_code, 403)
        self.assertEqual(
            admin.site.get_model_admin(User).readonly_fields,
            ("EMAIL_VERIFIED", "EMAIL_VERIFIED_AT"),
        )
        self.assertFalse(self.audit_events().exists())

    def test_validation_requires_reason_and_explicit_attestation(self):
        invalid_payloads = (
            ("reason", None),
            ("reason", "   "),
            ("reason", "x" * 1001),
            ("reason", "See https://example.test/verify?token=secret"),
            ("reason", "Verification code: 123456"),
            ("ownership_confirmed", None),
            ("ownership_confirmed", False),
            ("ownership_confirmed", "true"),
            ("verification_snapshot", None),
        )
        for field, value in invalid_payloads:
            with self.subTest(field=field, value=value):
                payload = self.payload.copy()
                if value is None:
                    del payload[field]
                else:
                    payload[field] = value
                response = self.submit(payload)
                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.data["errors"])

        self.target.refresh_from_db()
        self.assertFalse(self.target.EMAIL_VERIFIED)
        self.assertFalse(self.audit_events().exists())

    def test_ineligible_targets_cannot_be_verified(self):
        cases = (
            (User.UserRole.EXPLORER, User.UserStatus.PENDING),
            (User.UserRole.EXPLORER, User.UserStatus.SUSPENDED),
            (User.UserRole.MERCHANT, User.UserStatus.DISABLED),
            (User.UserRole.ADMIN, User.UserStatus.ACTIVE),
            (User.UserRole.SUPER_ADMIN, User.UserStatus.ACTIVE),
        )
        for role, state in cases:
            with self.subTest(role=role, state=state):
                User.objects.filter(pk=self.target.pk).update(
                    USER_ROLE=role,
                    USER_STATUS=state,
                )
                self.assertEqual(self.submit().status_code, 400)
                self.assertNotIn(
                    "verification_snapshot",
                    self.client.get(self.detail_url).data["data"],
                )
        self.assertFalse(self.audit_events().exists())

    def test_explorer_verification_is_idempotent(self):
        response = self.submit()
        self.assertEqual(response.status_code, 200, response.data)
        self.target.refresh_from_db()
        self.assertIsNotNone(self.target.EMAIL_VERIFIED_AT)
        self.assertTrue(self.target.EMAIL_VERIFIED)
        self.assertEqual(self.target.USER_ROLE, User.UserRole.EXPLORER)
        self.assertEqual(self.target.USER_STATUS, User.UserStatus.ACTIVE)

        retry = self.submit()
        self.assertEqual(retry.status_code, 200)
        self.assertEqual(
            retry.data["data"]["email_verified_at"],
            response.data["data"]["email_verified_at"],
        )
        event = self.audit_events().get()
        self.assertEqual(event.ACTOR_ID, self.actor)
        self.assertEqual(
            event.AACT_CONTEXT,
            {
                "reason": self.payload["reason"],
                "ownership_confirmed": True,
            },
        )
        self.assertIsNotNone(event.AACT_CREATED_AT)
        self.assertNotIn(
            "verification_snapshot",
            self.client.get(self.detail_url).data["data"],
        )

    def test_merchant_verification_preserves_account_restrictions_and_revokes_credentials(self):
        now = timezone.now()
        locked_until = now + timedelta(minutes=10)
        self.target.USER_ROLE = User.UserRole.MERCHANT
        self.target.USER_LOGIN_FAILURE_COUNT = 5
        self.target.USER_LOGIN_WINDOW_STARTED_AT = now
        self.target.USER_PASSWORD_LOCKED_UNTIL = locked_until
        self.target.save()
        self.payload["verification_snapshot"] = self.get_snapshot()
        password = self.target.password
        application = MerchantApplication.objects.create(
            USER_ID=self.target,
            MAPP_STATUS=MerchantApplication.ApplicationStatus.SUBMITTED,
        )
        verification_token = email_verification_token_generator.make_token(self.target)
        reset_token = password_reset_token_generator.make_token(self.target)
        refresh = RefreshToken.for_user(self.target)
        OAuthAccount.objects.create(
            USER=self.target,
            OAUTH_PROVIDER=OAuthAccount.OAuthProvider.FACEBOOK,
            OAUTH_PROVIDER_ID="old-subject",
        )

        response = self.submit()
        self.assertEqual(response.status_code, 200, response.data)
        self.target.refresh_from_db()
        application.refresh_from_db()
        self.assertEqual(self.target.USER_ROLE, User.UserRole.MERCHANT)
        self.assertEqual(self.target.USER_STATUS, User.UserStatus.ACTIVE)
        self.assertEqual(self.target.password, password)
        self.assertEqual(self.target.USER_LOGIN_FAILURE_COUNT, 5)
        self.assertEqual(self.target.USER_LOGIN_WINDOW_STARTED_AT, now)
        self.assertEqual(self.target.USER_PASSWORD_LOCKED_UNTIL, locked_until)
        self.assertEqual(
            application.MAPP_STATUS,
            MerchantApplication.ApplicationStatus.SUBMITTED,
        )
        self.assertFalse(
            email_verification_token_generator.check_token(self.target, verification_token),
        )
        self.assertFalse(
            password_reset_token_generator.check_token(self.target, reset_token),
        )
        self.assertTrue(
            BlacklistedToken.objects.filter(token__jti=refresh["jti"]).exists(),
        )
        self.assertFalse(OAuthAccount.objects.filter(USER=self.target).exists())

    def test_changed_address_or_password_requires_a_fresh_review(self):
        User.objects.filter(pk=self.target.pk).update(USER_EMAIL="updated@example.com")
        self.assertEqual(self.submit().status_code, 400)

        self.payload["verification_snapshot"] = self.get_snapshot()
        self.target.refresh_from_db()
        self.target.set_password("Replacement-password-37!")
        self.target.save(update_fields=["password"])

        self.assertEqual(self.submit().status_code, 400)
        self.target.refresh_from_db()
        self.assertFalse(self.target.EMAIL_VERIFIED)
        self.assertFalse(self.audit_events().exists())

    def test_audit_failure_rolls_back_verification_and_credential_cleanup(self):
        refresh = RefreshToken.for_user(self.target)
        link = OAuthAccount.objects.create(
            USER=self.target,
            OAUTH_PROVIDER=OAuthAccount.OAuthProvider.GOOGLE,
            OAUTH_PROVIDER_ID="rollback-subject",
        )
        with patch.object(
            AdminActivityService,
            "record_user_action",
            side_effect=RuntimeError("Audit unavailable"),
        ):
            with self.assertRaisesMessage(RuntimeError, "Audit unavailable"):
                self.submit()

        self.target.refresh_from_db()
        self.assertFalse(self.target.EMAIL_VERIFIED)
        self.assertIsNone(self.target.EMAIL_VERIFIED_AT)
        self.assertFalse(BlacklistedToken.objects.filter(token__jti=refresh["jti"]).exists())
        self.assertTrue(OAuthAccount.objects.filter(pk=link.pk).exists())
        self.assertFalse(self.audit_events().exists())


class ManualEmailVerificationConcurrencyTests(ManualVerificationSetup, APITransactionTestCase):
    """Exercise simultaneous confirmations on separate database connections."""

    @skipUnlessDBFeature("has_select_for_update")
    def test_concurrent_confirmations_produce_one_transition_and_event(self):
        start = Barrier(2)

        def confirm():
            """Submit one attestation through a separate connection."""
            client = APIClient()
            client.force_authenticate(self.actor)
            try:
                start.wait(timeout=10)
                return client.post(
                    self.url,
                    self.payload,
                    format="json",
                )
            finally:
                connections["default"].close()

        with ThreadPoolExecutor(max_workers=2) as executor:
            requests = [
                executor.submit(confirm)
                for _ in range(2)
            ]
            results = [
                request.result(timeout=20)
                for request in requests
            ]

        self.assertEqual([result.status_code for result in results], [200, 200])
        self.assertEqual(results[0].data["data"], results[1].data["data"])
        self.assertEqual(self.audit_events().count(), 1)
