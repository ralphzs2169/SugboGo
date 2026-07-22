from unittest.mock import patch
from django.core.cache import cache

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin


class ResendVerificationViewTests(APIResponseAssertionsMixin, APITestCase):
    """Tests for the resend verification email endpoint."""


    def setUp(self):
        cache.clear()
        self.url = reverse("resend_verification")

        self.user = User.objects.create_user(
            email="john@example.com",
            password="StrongPassword123!",
            USER_FNAME="John",
            USER_LNAME="Doe",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )


    @patch("apps.authentication.services.email_service.EmailService.send_verification_email")
    def test_resend_verification_successfully(self, mock_send):
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

        mock_send.assert_called_once_with(self.user)

        self.assertEqual(
            response.data["message"],
            "Verification email sent successfully.",
        )


    def test_resend_verification_for_nonexistent_email(self):
        response = self.client.post(
            self.url,
            {
                "email": "missing@example.com",
            },
            format="json",
        )

        self.assertErrorResponse(
            response,
            message="No account found with this email.",
            code="USER_NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    
    def test_resend_verification_for_verified_user(self):
        self.user.EMAIL_VERIFIED = True
        self.user.save()

        response = self.client.post(
            self.url,
            {
                "email": "john@example.com",
            },
            format="json",
        )

        self.assertErrorResponse(
            response,
            message="Email is already verified.",
            code="EMAIL_ALREADY_VERIFIED",
            status_code=status.HTTP_409_CONFLICT,
        )


    def test_resend_verification_rejects_invalid_email(self):
        response = self.client.post(
            self.url,
            {
                "email": "not-an-email",
            },
            format="json",
        )

        self.assertValidationError(response, "email")


    def test_resend_verification_requires_email(self):
        response = self.client.post(
            self.url,
            {},
            format="json",
        )

        self.assertValidationError(response, "email")


    @patch("apps.authentication.services.email_service.EmailService.send_verification_email")
    def test_resend_verification_handles_email_failure(self, mock_send):
        mock_send.side_effect = Exception("Email failed")

        response = self.client.post(
            self.url,
            {
                "email": "john@example.com",
            },
            format="json",
        )

        self.assertErrorResponse(
            response,
            message="Unable to send verification email. Please try again later.",
            code="EMAIL_SEND_FAILED",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


    @patch("apps.authentication.services.email_service.EmailService.send_verification_email")
    def test_resend_verification_is_rate_limited(self, mock_send):
        # First 5 requests should succeed.
        for _ in range(5):
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

        # 6th request should be blocked.
        response = self.client.post(
            self.url,
            {
                "email": "john@example.com",
            },
            format="json",
        )

        self.assertRateLimitError(response)

        self.assertEqual(
            mock_send.call_count,
            5,
        )