from unittest.mock import patch

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin


class ResetPasswordViewTests(APIResponseAssertionsMixin, APITestCase):
    """Tests for the password reset endpoint."""

    def setUp(self):
        self.url = reverse("reset_password")

        self.old_password = "StrongPassword123!"
        self.new_password = "NewStrongPassword123!"

        self.user = User.objects.create_user(
            email="john@example.com",
            password=self.old_password,
            USER_FNAME="John",
            USER_LNAME="Doe",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
            EMAIL_VERIFIED=True,
        )

    @patch(
        "apps.authentication.views.password_reset.PasswordResetService.reset_password"
    )
    def test_reset_password_successfully(
        self,
        mock_reset_password,
    ):
        mock_reset_password.return_value = self.user

        response = self.client.post(
            self.url,
            {
                "uid": "valid-uid",
                "token": "valid-token",
                "password": self.new_password,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["message"],
            "Password reset successfully.",
        )

        mock_reset_password.assert_called_once_with(
            uid="valid-uid",
            token="valid-token",
            password=self.new_password,
        )

    @patch(
        "apps.authentication.views.password_reset.PasswordResetService.reset_password"
    )
    def test_rejects_invalid_token(
        self,
        mock_reset_password,
    ):
        mock_reset_password.return_value = None

        response = self.client.post(
            self.url,
            {
                "uid": "invalid",
                "token": "invalid",
                "password": self.new_password,
            },
            format="json",
        )

        self.assertErrorResponse(
            response,
            message="This password reset link is invalid or has expired.",
            code="INVALID_RESET_LINK",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

        mock_reset_password.assert_called_once_with(
            uid="invalid",
            token="invalid",
            password=self.new_password,
        )

    def test_requires_uid(self):
        response = self.client.post(
            self.url,
            {
                "token": "token",
                "password": self.new_password,
            },
            format="json",
        )

        self.assertValidationError(response, "uid")

    def test_requires_token(self):
        response = self.client.post(
            self.url,
            {
                "uid": "uid",
                "password": self.new_password,
            },
            format="json",
        )

        self.assertValidationError(response, "token")

    def test_requires_password(self):
        response = self.client.post(
            self.url,
            {
                "uid": "uid",
                "token": "token",
            },
            format="json",
        )

        self.assertValidationError(response, "password")

    def test_rejects_weak_password(self):
        response = self.client.post(
            self.url,
            {
                "uid": "uid",
                "token": "token",
                "password": "12345",
            },
            format="json",
        )

        self.assertValidationError(response, "password")