from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.test import TestCase
from django.utils.encoding import force_bytes
from django.utils.http import (
    urlsafe_base64_encode,
    urlsafe_base64_decode,
)
from unittest.mock import patch

from apps.authentication.services.password_reset_service import (
    PasswordResetService,
)
from apps.users.models import User


class PasswordResetServiceTests(TestCase):
    """Tests for PasswordResetService."""

    def setUp(self):
        self.password = "StrongPassword123!"

        self.user = User.objects.create_user(
            email="john@example.com",
            password=self.password,
            USER_FNAME="John",
            USER_LNAME="Doe",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
            EMAIL_VERIFIED=True,
        )

    def test_generate_reset_link_returns_valid_link(self):
        link = PasswordResetService.generate_reset_link(
            self.user,
        )

        self.assertTrue(
            link.startswith(settings.PASSWORD_RESET_URL),
        )

        self.assertIn("uid=", link)

        self.assertIn("token=", link)

    def test_generate_reset_link_contains_correct_uid(self):
        link = PasswordResetService.generate_reset_link(
            self.user,
        )

        uid = link.split("uid=")[1].split("&")[0]

        decoded_uid = urlsafe_base64_decode(uid).decode()

        self.assertEqual(
            int(decoded_uid),
            self.user.pk,
        )

    def test_verify_token_accepts_valid_token(self):
        uid = urlsafe_base64_encode(
            force_bytes(self.user.pk),
        )

        token = default_token_generator.make_token(
            self.user,
        )

        result = PasswordResetService.verify_token(
            uid,
            token,
        )

        self.assertEqual(
            result,
            self.user,
        )

    def test_verify_token_rejects_invalid_token(self):
        uid = urlsafe_base64_encode(
            force_bytes(self.user.pk),
        )

        result = PasswordResetService.verify_token(
            uid,
            "invalid-token",
        )

        self.assertIsNone(result)

    def test_verify_token_rejects_invalid_uid(self):
        result = PasswordResetService.verify_token(
            "invalid-uid",
            "token",
        )

        self.assertIsNone(result)

    def test_verify_token_rejects_nonexistent_user(self):
        uid = urlsafe_base64_encode(
            force_bytes(999999),
        )

        token = "anything"

        result = PasswordResetService.verify_token(
            uid,
            token,
        )

        self.assertIsNone(result)

    def test_verify_token_rejects_malformed_uid(self):
        result = PasswordResetService.verify_token(
            "%%%%%",
            "token",
        )

        self.assertIsNone(result)


    @patch("apps.authentication.services.password_reset_service.SessionService.revoke_all_sessions")
    def test_reset_password_successfully(
        self,
        mock_revoke_sessions,
    ):
        uid = urlsafe_base64_encode(
            force_bytes(self.user.pk),
        )

        token = default_token_generator.make_token(
            self.user,
        )

        result = PasswordResetService.reset_password(
            uid=uid,
            token=token,
            password="NewStrongPassword123!",
        )

        self.assertEqual(result, self.user)

        self.user.refresh_from_db()

        self.assertTrue(
            self.user.check_password(
                "NewStrongPassword123!"
            )
        )

        self.assertFalse(
            self.user.check_password(
                self.password,
            )
        )

        mock_revoke_sessions.assert_called_once_with(
            self.user,
        )


    @patch("apps.authentication.services.password_reset_service.SessionService.revoke_all_sessions")
    def test_reset_password_rejects_invalid_token(
        self,
        mock_revoke_sessions,
    ):
        uid = urlsafe_base64_encode(
            force_bytes(self.user.pk),
        )

        result = PasswordResetService.reset_password(
            uid=uid,
            token="invalid-token",
            password="NewStrongPassword123!",
        )

        self.assertIsNone(result)

        self.user.refresh_from_db()

        self.assertTrue(
            self.user.check_password(
                self.password,
            )
        )

        self.assertFalse(
            self.user.check_password(
                "NewStrongPassword123!"
            )
        )

        mock_revoke_sessions.assert_not_called()