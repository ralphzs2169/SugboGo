from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.core.cache import cache
from core.tests.assertions import APIResponseAssertionsMixin
from apps.users.models import User
from apps.authentication.constants import Platform


class AdminForgotPasswordViewTests(
    APIResponseAssertionsMixin,
    APITestCase,
):
    """Tests for the admin forgot password endpoint."""

    def setUp(self):
        cache.clear()
        self.url = reverse("admin_forgot_password")

        self.admin = User.objects.create_user(
            email="admin@example.com",
            password="StrongPassword123!",
            USER_FNAME="Admin",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
            EMAIL_VERIFIED=True,
        )

        self.super_admin = User.objects.create_user(
            email="super@example.com",
            password="StrongPassword123!",
            USER_FNAME="Super",
            USER_LNAME="Admin",
            USER_ROLE=User.UserRole.SUPER_ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
            EMAIL_VERIFIED=True,
        )

        self.explorer = User.objects.create_user(
            email="explorer@example.com",
            password="StrongPassword123!",
            USER_FNAME="Explorer",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.merchant = User.objects.create_user(
            email="merchant@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

    @patch(
        "apps.authentication.services.email_service.EmailService.send_password_reset_email"
    )
    def test_does_not_send_email_for_explorer(
        self,
        mock_send_email,
    ):
        response = self.client.post(
            self.url,
            {
                "email": "explorer@example.com",
            },
            format="json",
        )

        self.assertSuccessResponse(
            response,
            message=(
                "If an admin account exists with this email, "
                "a password reset link has been sent."
            ),
        )

        mock_send_email.assert_not_called()

    @patch(
        "apps.authentication.services.email_service.EmailService.send_password_reset_email"
    )
    def test_does_not_send_email_for_merchant(
        self,
        mock_send_email,
    ):
        response = self.client.post(
            self.url,
            {
                "email": "merchant@example.com",
            },
            format="json",
        )

        self.assertSuccessResponse(
            response,
            message=(
                "If an admin account exists with this email, "
                "a password reset link has been sent."
            ),
        )

        mock_send_email.assert_not_called()

    @patch(
        "apps.authentication.services.email_service.EmailService.send_password_reset_email"
    )
    def test_returns_success_for_nonexistent_email(
        self,
        mock_send_email,
    ):
        response = self.client.post(
            self.url,
            {
                "email": "missing@example.com",
            },
            format="json",
        )

        self.assertSuccessResponse(
            response,
            message=(
                "If an admin account exists with this email, "
                "a password reset link has been sent."
            ),
        )

        mock_send_email.assert_not_called()

    def test_requires_email(self):
        response = self.client.post(
            self.url,
            {},
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


    @patch(
    "apps.authentication.services.email_service.EmailService.send_password_reset_email"
    )
    def test_sends_email_for_admin(
        self,
        mock_send_email,
    ):
        response = self.client.post(
            self.url,
            {
                "email": "admin@example.com",
            },
            format="json",
        )

        self.assertSuccessResponse(
            response,
            message=(
                "If an admin account exists with this email, "
                "a password reset link has been sent."
            ),
        )

        mock_send_email.assert_called_once_with(
            self.admin,
            platform=Platform.WEB,
        )


    @patch(
        "apps.authentication.services.email_service.EmailService.send_password_reset_email"
    )
    def test_sends_email_for_super_admin(
        self,
        mock_send_email,
    ):
        response = self.client.post(
            self.url,
            {
                "email": "super@example.com",
            },
            format="json",
        )

        self.assertSuccessResponse(
            response,
            message=(
                "If an admin account exists with this email, "
                "a password reset link has been sent."
            ),
        )

        mock_send_email.assert_called_once_with(
            self.super_admin,
            platform=Platform.WEB,
        )

    @patch("apps.authentication.services.email_service.EmailService.send_email")
    def test_admin_reset_email_can_be_validated_and_redeemed(
        self,
        mock_send_email,
    ):
        """Complete the Admin recovery path using proof from the existing web email."""
        request = self.client.post(
            self.url,
            {"email": self.admin.USER_EMAIL},
            format="json",
        )
        self.assertEqual(request.status_code, 200, request.data)
        mock_send_email.assert_called_once()
        link = mock_send_email.call_args.kwargs["context"]["reset_link"]
        query = parse_qs(urlparse(link).query)
        proof = {
            "uid": query["uid"][0],
            "token": query["token"][0],
        }

        validation = self.client.post(
            reverse("validate_reset_token"),
            proof,
            format="json",
        )
        self.assertEqual(validation.status_code, 200, validation.data)

        new_password = "Recovered-Admin-Password-419!"
        reset = self.client.post(
            reverse("reset_password"),
            {
                **proof,
                "password": new_password,
                "confirm_password": new_password,
            },
            format="json",
        )
        self.assertEqual(reset.status_code, 200, reset.data)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.check_password(new_password))
