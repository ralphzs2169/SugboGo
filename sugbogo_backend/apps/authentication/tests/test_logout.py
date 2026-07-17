from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.users.models import User
from apps.core.tests.assertions import APIResponseAssertionsMixin


class LogoutViewTests(APIResponseAssertionsMixin, APITestCase):
    """Tests for the user logout endpoint."""

    def setUp(self):
        self.url = reverse("logout")

        self.user = User.objects.create_user(
            email="john@example.com",
            password="StrongPassword123!",
            USER_FNAME="John",
            USER_LNAME="Doe",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
            EMAIL_VERIFIED=True,
        )

        self.refresh = str(
            RefreshToken.for_user(self.user)
        )


    def test_logout_successfully(self):
        response = self.client.post(
            self.url,
            {
                "refresh": self.refresh,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_205_RESET_CONTENT,
        )

        self.assertEqual(
            response.data["detail"],
            "Successfully logged out.",
        )


    def test_logout_requires_refresh_token(self):
        response = self.client.post(
            self.url,
            {},
            format="json",
        )

        self.assertValidationError(
            response,
            "refresh",
        )


    def test_logout_rejects_invalid_refresh_token(self):
        response = self.client.post(
            self.url,
            {
                "refresh": "invalid-token",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            response.data["detail"],
            "Invalid or already-blacklisted token.",
        )


    def test_logout_rejects_already_blacklisted_token(self):
        # First logout succeeds.
        response = self.client.post(
            self.url,
            {
                "refresh": self.refresh,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_205_RESET_CONTENT,
        )

        # Second logout with the same token should fail.
        response = self.client.post(
            self.url,
            {
                "refresh": self.refresh,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            response.data["detail"],
            "Invalid or already-blacklisted token.",
        )