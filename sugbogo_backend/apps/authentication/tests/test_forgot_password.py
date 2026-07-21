from unittest.mock import patch

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.core.cache import cache

from apps.users.models import User
from apps.core.tests.assertions import APIResponseAssertionsMixin
from apps.authentication.constants import Platform


class ForgotPasswordViewTests(APIResponseAssertionsMixin, APITestCase):
    """Tests for the forgot password endpoint."""

    def setUp(self):
        cache.clear()

        self.url = reverse("forgot_password")

        self.user = User.objects.create_user(
            email="john@example.com",
            password="StrongPassword123!",
            USER_FNAME="John",
            USER_LNAME="Doe",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
            EMAIL_VERIFIED=True,
        )

    @patch("apps.authentication.views.forgot_password.EmailService.send_password_reset_email")
    def test_existing_email_sends_reset_email(self, mock_send):
        response = self.client.post(
            self.url,
            {
                "email": "john@example.com",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["message"],
            (
                "If an account exists with this email, "
                "a password reset link has been sent."
            ),
        )

        mock_send.assert_called_once_with(self.user, platform=Platform.MOBILE)

    @patch(
        "apps.authentication.views.forgot_password.EmailService.send_password_reset_email"
    )
    def test_nonexistent_email_returns_same_response(
        self,
        mock_send,
    ):
        response = self.client.post(
            self.url,
            {
                "email": "missing@example.com",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["message"],
            (
                "If an account exists with this email, "
                "a password reset link has been sent."
            ),
        )

        mock_send.assert_not_called()

    @patch(
        "apps.authentication.views.forgot_password.EmailService.send_password_reset_email"
    )
    def test_email_service_failure_still_returns_success(
        self,
        mock_send,
    ):
        mock_send.side_effect = Exception("SMTP failure")

        response = self.client.post(
            self.url,
            {
                "email": "john@example.com",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["message"],
            (
                "If an account exists with this email, "
                "a password reset link has been sent."
            ),
        )

    def test_requires_email(self):
        response = self.client.post(
            self.url,
            {},
            format="json",
        )

        self.assertValidationError(
            response,
            "email",
        )

    def test_rejects_invalid_email(self):
        response = self.client.post(
            self.url,
            {
                "email": "not-an-email",
            },
            format="json",
        )

        self.assertValidationError(
            response,
            "email",
        )

    def test_rejects_empty_email(self):
        response = self.client.post(
            self.url,
            {
                "email": "",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertValidationError(
            response,
            "email",
        )

    @patch(  "apps.authentication.views.forgot_password.EmailService.send_password_reset_email")
    def test_email_lookup_is_case_insensitive(
        self,
        mock_send,
    ):
        response = self.client.post(
            self.url,
            {
                "email": "JOHN@EXAMPLE.COM",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        mock_send.assert_called_once_with(self.user, platform=Platform.MOBILE)