from unittest.mock import patch

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin


class ValidateResetTokenViewTests(APIResponseAssertionsMixin, APITestCase):
    """Tests for the validate reset token endpoint."""

    def setUp(self):
        self.url = reverse("validate_reset_token")

        self.user = User.objects.create_user(
            email="john@example.com",
            password="StrongPassword123!",
            USER_FNAME="John",
            USER_LNAME="Doe",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

    @patch(
        "apps.authentication.views.validate_reset_token.PasswordResetService.verify_token"
    )
    def test_validate_reset_token_successfully(
        self,
        mock_verify_token,
    ):
        mock_verify_token.return_value = self.user

        response = self.client.post(
            self.url,
            {
                "uid": "encoded_uid",
                "token": "valid-token",
            },
            format="json",
        )

        self.assertSuccessResponse(
            response,
            message="Reset link is valid.",
        )

        mock_verify_token.assert_called_once_with(
            "encoded_uid",
            "valid-token",
        )

    @patch(
        "apps.authentication.views.validate_reset_token.PasswordResetService.verify_token"
    )
    def test_validate_reset_token_rejects_invalid_token(
        self,
        mock_verify_token,
    ):
        mock_verify_token.return_value = None

        response = self.client.post(
            self.url,
            {
                "uid": "encoded_uid",
                "token": "invalid-token",
            },
            format="json",
        )

        self.assertErrorResponse(
            response,
            message="This password reset link is invalid or has expired.",
            code="INVALID_RESET_TOKEN",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

        mock_verify_token.assert_called_once_with(
            "encoded_uid",
            "invalid-token",
        )

    def test_validate_reset_token_requires_uid(self):
        response = self.client.post(
            self.url,
            {
                "token": "valid-token",
            },
            format="json",
        )

        self.assertValidationError(
            response,
            "uid",
        )

    def test_validate_reset_token_requires_token(self):
        response = self.client.post(
            self.url,
            {
                "uid": "encoded_uid",
            },
            format="json",
        )

        self.assertValidationError(
            response,
            "token",
        )

    def test_validate_reset_token_requires_uid_and_token(self):
        response = self.client.post(
            self.url,
            {},
            format="json",
        )

        self.assertValidationError(
            response,
            "uid",
        )

        self.assertValidationError(
            response,
            "token",
        )