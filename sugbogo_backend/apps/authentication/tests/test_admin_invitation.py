from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from decimal import Decimal
from threading import Barrier
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

from django.db import close_old_connections
from django.test import TransactionTestCase
from django.test import override_settings
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from rest_framework_simplejwt.tokens import RefreshToken

from apps.authentication.services.admin_invitation_service import (
    AdminInvitationService,
)
from apps.authentication.services.email_service import EmailService
from apps.authentication.services.password_reset_service import (
    PasswordResetService,
)
from apps.authentication.services.verification_service import (
    EmailVerificationService,
)
from apps.authentication.tokens import (
    admin_invitation_token_generator,
    email_verification_token_generator,
    password_reset_token_generator,
)
from apps.users.models import User


class AdminInvitationLifecycleTests(APITestCase):
    """Covers token isolation and the public Admin setup lifecycle."""

    password = "Unrelated-Strong-Setup-482!"

    def create_invited_admin(
        self,
        *,
        email="invited-admin@example.com",
        first_name="Alexandrianna",
        last_name="Montgomeryson",
    ):
        """Creates an incomplete Admin account for invitation tests."""
        return User.objects.create_user(
            email=email,
            password=None,
            USER_FNAME=first_name,
            USER_LNAME=last_name,
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.PENDING,
            EMAIL_VERIFIED=False,
            EMAIL_VERIFIED_AT=None,
            is_staff=False,
            is_superuser=False,
            USER_REPUTATION=Decimal("0.20000"),
        )

    def invitation_credentials(self, user):
        """Returns the encoded UID and dedicated token for a user."""
        return (
            urlsafe_base64_encode(force_bytes(user.pk)),
            admin_invitation_token_generator.make_token(user),
        )

    def completion_payload(self, user, password=None):
        """Returns a valid public invitation-completion payload."""
        uid, token = self.invitation_credentials(user)
        selected_password = password or self.password
        return {
            "uid": uid,
            "token": token,
            "password": selected_password,
            "confirm_password": selected_password,
        }

    def test_invitation_token_is_purpose_isolated(self):
        user = self.create_invited_admin()
        uid, invitation_token = self.invitation_credentials(user)

        self.assertEqual(
            AdminInvitationService.verify_token(uid, invitation_token),
            user,
        )
        self.assertIsNone(
            EmailVerificationService.verify_token(uid, invitation_token)
        )
        self.assertIsNone(
            PasswordResetService.verify_token(uid, invitation_token)
        )

        verification_token = email_verification_token_generator.make_token(user)
        reset_token = password_reset_token_generator.make_token(user)

        self.assertIsNone(
            AdminInvitationService.verify_token(uid, verification_token)
        )
        self.assertIsNone(
            AdminInvitationService.verify_token(uid, reset_token)
        )

    def test_invitation_token_is_invalidated_by_bound_account_state(self):
        mutations = (
            ("email", {"USER_EMAIL": "changed@example.com"}),
            ("role", {"USER_ROLE": User.UserRole.EXPLORER}),
            ("status", {"USER_STATUS": User.UserStatus.ACTIVE}),
            ("verified", {"EMAIL_VERIFIED": True}),
            ("password", {"password": "changed"}),
        )

        for index, (label, changes) in enumerate(mutations):
            with self.subTest(state=label):
                user = self.create_invited_admin(
                    email=f"state-{index}@example.com",
                )
                uid, token = self.invitation_credentials(user)

                if "password" in changes:
                    user.set_password(self.password)
                    user.save(update_fields=["password"])
                else:
                    for field_name, value in changes.items():
                        setattr(user, field_name, value)
                    user.save(update_fields=list(changes))

                self.assertIsNone(
                    AdminInvitationService.verify_token(uid, token)
                )

    @override_settings(PASSWORD_RESET_TIMEOUT=1)
    def test_invitation_token_expires_with_django_timeout(self):
        user = self.create_invited_admin()
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        issued_at = datetime(2026, 1, 1, 12, 0, 0)

        with patch.object(
            admin_invitation_token_generator,
            "_now",
            return_value=issued_at,
        ):
            token = admin_invitation_token_generator.make_token(user)

        with patch.object(
            admin_invitation_token_generator,
            "_now",
            return_value=issued_at + timedelta(seconds=2),
        ):
            self.assertIsNone(
                AdminInvitationService.verify_token(uid, token)
            )

    def test_public_validation_accepts_only_valid_incomplete_invitation(self):
        user = self.create_invited_admin()
        uid, token = self.invitation_credentials(user)

        valid_response = self.client.post(
            reverse("validate_admin_invitation"),
            {
                "uid": uid,
                "token": token,
            },
            format="json",
        )
        invalid_response = self.client.post(
            reverse("validate_admin_invitation"),
            {
                "uid": uid,
                "token": "invalid-token",
            },
            format="json",
        )

        self.assertEqual(valid_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            invalid_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        user.refresh_from_db()
        self.assertEqual(user.USER_STATUS, User.UserStatus.PENDING)
        self.assertFalse(user.EMAIL_VERIFIED)
        self.assertFalse(user.has_usable_password())

    def test_valid_completion_activates_admin_revokes_sessions_and_returns_no_jwt(self):
        user = self.create_invited_admin()
        user.USER_STATUS = User.UserStatus.ACTIVE
        user.save(update_fields=["USER_STATUS"])
        refresh = RefreshToken.for_user(user)
        user.USER_STATUS = User.UserStatus.PENDING
        user.save(update_fields=["USER_STATUS"])
        payload = self.completion_payload(user)

        response = self.client.post(
            reverse("complete_admin_invitation"),
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn("access", response.data.get("data") or {})
        self.assertNotIn("refresh", response.data.get("data") or {})
        user.refresh_from_db()
        self.assertEqual(user.USER_ROLE, User.UserRole.ADMIN)
        self.assertEqual(user.USER_STATUS, User.UserStatus.ACTIVE)
        self.assertTrue(user.EMAIL_VERIFIED)
        self.assertIsNotNone(user.EMAIL_VERIFIED_AT)
        self.assertTrue(user.has_usable_password())
        self.assertTrue(user.check_password(self.password))
        self.assertNotEqual(user.password, self.password)
        self.assertTrue(
            BlacklistedToken.objects.filter(
                token__jti=refresh["jti"],
            ).exists()
        )
        self.assertIsNone(
            AdminInvitationService.verify_token(
                payload["uid"],
                payload["token"],
            )
        )

    def test_completion_rejects_mismatched_passwords(self):
        user = self.create_invited_admin()
        payload = self.completion_payload(user)
        payload["confirm_password"] = "Different-Strong-Password-731!"

        response = self.client.post(
            reverse("complete_admin_invitation"),
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("confirm_password", response.data["errors"])
        user.refresh_from_db()
        self.assertEqual(user.USER_STATUS, User.UserStatus.PENDING)
        self.assertFalse(user.has_usable_password())

    def test_completion_rejects_weak_and_user_similar_passwords(self):
        cases = (
            ("weak", "password"),
            ("similar", "Alexandrianna"),
        )

        for index, (label, proposed_password) in enumerate(cases):
            with self.subTest(password_type=label):
                user = self.create_invited_admin(
                    email=f"password-{index}@example.com",
                )
                response = self.client.post(
                    reverse("complete_admin_invitation"),
                    self.completion_payload(user, proposed_password),
                    format="json",
                )
                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST,
                )
                self.assertIn("password", response.data["errors"])
                user.refresh_from_db()
                self.assertFalse(user.has_usable_password())

    def test_completed_invitation_cannot_be_replayed(self):
        user = self.create_invited_admin()
        payload = self.completion_payload(user)

        first_response = self.client.post(
            reverse("complete_admin_invitation"),
            payload,
            format="json",
        )
        second_response = self.client.post(
            reverse("complete_admin_invitation"),
            payload,
            format="json",
        )

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            second_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            second_response.data["code"],
            "INVALID_ADMIN_INVITATION",
        )

    def test_admin_login_lifecycle_uses_existing_login_endpoint(self):
        user = self.create_invited_admin()
        payload = self.completion_payload(user)

        before_response = self.client.post(
            reverse("admin_login"),
            {
                "email": user.USER_EMAIL,
                "password": self.password,
            },
            format="json",
        )
        completion_response = self.client.post(
            reverse("complete_admin_invitation"),
            payload,
            format="json",
        )
        after_response = self.client.post(
            reverse("admin_login"),
            {
                "email": user.USER_EMAIL,
                "password": self.password,
            },
            format="json",
        )

        self.assertEqual(
            before_response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        self.assertEqual(completion_response.status_code, status.HTTP_200_OK)
        self.assertEqual(after_response.status_code, status.HTTP_200_OK)
        self.assertIn("access", after_response.data["data"])
        self.assertIn("refresh", after_response.data["data"])

    @override_settings(WEB_APP_URL="https://admin.sugbogo.test")
    def test_invitation_link_targets_web_admin_setup_route(self):
        user = self.create_invited_admin()

        invitation_link = AdminInvitationService.generate_invitation_link(user)
        parsed = urlparse(invitation_link)
        query = parse_qs(parsed.query)

        self.assertEqual(parsed.scheme, "https")
        self.assertEqual(parsed.netloc, "admin.sugbogo.test")
        self.assertEqual(parsed.path, "/admin/setup-account")
        self.assertIn("uid", query)
        self.assertIn("token", query)

    @patch(
        "apps.authentication.services.email_service.EmailService.send_email"
    )
    @patch(
        "apps.authentication.services.email_service.AdminInvitationService.generate_invitation_link"
    )
    def test_invitation_email_uses_dedicated_templates(
        self,
        mock_generate_link,
        mock_send_email,
    ):
        user = self.create_invited_admin()
        mock_generate_link.return_value = "https://example.test/admin/setup-account"

        EmailService.send_admin_invitation_email(user)

        mock_send_email.assert_called_once()
        kwargs = mock_send_email.call_args.kwargs
        self.assertEqual(
            kwargs["html_template_name"],
            "emails/admin_invitation.html",
        )
        self.assertEqual(
            kwargs["text_template_name"],
            "emails/admin_invitation.txt",
        )
        self.assertNotIn("password", kwargs["context"])


class AdminInvitationConcurrencyTests(TransactionTestCase):
    """Proves row locking permits only one concurrent invitation completion."""

    reset_sequences = True

    def setUp(self):
        self.user = User.objects.create_user(
            email="concurrent-admin@example.com",
            password=None,
            USER_FNAME="Concurrent",
            USER_LNAME="Admin",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.PENDING,
            EMAIL_VERIFIED=False,
            USER_REPUTATION=Decimal("0.20000"),
        )
        self.uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        self.token = admin_invitation_token_generator.make_token(self.user)
        self.barrier = Barrier(2)

    def complete_once(self):
        """Runs one completion attempt on an independent database connection."""
        close_old_connections()
        self.barrier.wait()

        try:
            completed = AdminInvitationService.complete_invitation(
                uid=self.uid,
                token=self.token,
                password="ThreadSafe-Strong-Setup-482!",
                confirm_password="ThreadSafe-Strong-Setup-482!",
            )
            return completed is not None
        finally:
            close_old_connections()

    def test_simultaneous_completion_succeeds_exactly_once(self):
        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(
                executor.map(
                    lambda _: self.complete_once(),
                    range(2),
                )
            )

        self.assertEqual(results.count(True), 1)
        self.assertEqual(results.count(False), 1)
        self.user.refresh_from_db()
        self.assertEqual(self.user.USER_STATUS, User.UserStatus.ACTIVE)
        self.assertTrue(self.user.EMAIL_VERIFIED)
        self.assertTrue(self.user.check_password("ThreadSafe-Strong-Setup-482!"))
