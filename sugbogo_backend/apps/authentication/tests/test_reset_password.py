from unittest.mock import patch

from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.test import APITestCase

from apps.authentication.tokens import password_reset_token_generator
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
            USER_FNAME="Alexandrianna",
            USER_LNAME="Montgomeryson",
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
                "confirm_password": self.new_password,
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
                "confirm_password": self.new_password,
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
                "confirm_password": self.new_password,
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
                "confirm_password": self.new_password,
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
                "confirm_password": self.new_password,
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
                "confirm_password": "12345",
            },
            format="json",
        )

        self.assertValidationError(response, "password")

    def test_requires_password_confirmation(self):
        response = self.client.post(
            self.url,
            {
                "uid": "uid",
                "token": "token",
                "password": self.new_password,
            },
            format="json",
        )

        self.assertValidationError(response, "confirm_password")

    def test_rejects_mismatched_password_confirmation(self):
        response = self.client.post(
            self.url,
            {
                "uid": "uid",
                "token": "token",
                "password": self.new_password,
                "confirm_password": "DifferentStrongPassword123!",
            },
            format="json",
        )

        self.assertValidationError(response, "confirm_password")

    @patch(
        "apps.authentication.views.password_reset.PasswordResetService.reset_password"
    )
    @patch("apps.authentication.serializers.validate_password")
    def test_password_validation_receives_target_user(
        self,
        mock_validate_password,
        mock_reset_password,
    ):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = password_reset_token_generator.make_token(self.user)
        mock_reset_password.return_value = self.user

        response = self.client.post(
            self.url,
            {
                "uid": uid,
                "token": token,
                "password": self.new_password,
                "confirm_password": self.new_password,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_validate_password.assert_called_once_with(
            self.new_password,
            user=self.user,
        )

    def test_rejects_password_similar_to_user_email(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = password_reset_token_generator.make_token(self.user)

        response = self.client.post(
            self.url,
            {
                "uid": uid,
                "token": token,
                "password": self.user.USER_EMAIL,
                "confirm_password": self.user.USER_EMAIL,
            },
            format="json",
        )

        self.assertValidationError(response, "password")
        self.assertIn(
            "too similar",
            response.data["errors"]["password"][0].lower(),
        )

    def test_rejects_password_similar_to_user_name(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))

        for password in (
            self.user.USER_FNAME,
            self.user.USER_LNAME,
        ):
            with self.subTest(password=password):
                token = password_reset_token_generator.make_token(self.user)
                response = self.client.post(
                    self.url,
                    {
                        "uid": uid,
                        "token": token,
                        "password": password,
                        "confirm_password": password,
                    },
                    format="json",
                )

                self.assertValidationError(response, "password")
                self.assertIn(
                    "too similar",
                    response.data["errors"]["password"][0].lower(),
                )

    def test_accepts_valid_password_unrelated_to_user_identity(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = password_reset_token_generator.make_token(self.user)

        response = self.client.post(
            self.url,
            {
                "uid": uid,
                "token": token,
                "password": self.new_password,
                "confirm_password": self.new_password,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.new_password))
