from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin


class TokenRefreshViewTests(APIResponseAssertionsMixin, APITestCase):
    def setUp(self):
        self.url = reverse("token_refresh")

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


    def test_refresh_returns_new_access_token(self):
        response = self.client.post(
            self.url,
            {
                "refresh": self.refresh,
            },
            format="json",
        )
     
        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertIn(
            "access",
            response.data,
        )


    def test_refresh_rejects_invalid_token(self):
        response = self.client.post(
            self.url,
            {
                "refresh": "invalid-token",
            },
            format="json",
        )
        print(response.data)
        self.assertAuthenticationError(response)


    def test_refresh_requires_refresh_token(self):
        response = self.client.post(
            self.url,
            {},
            format="json",
        )

        self.assertValidationError(
            response,
            "refresh",
        )


    def test_refresh_rotates_and_blacklists_old_refresh_token(self):
        # First refresh
        response = self.client.post(
            self.url,
            {
                "refresh": self.refresh,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        new_refresh = response.data["refresh"]

        # Old refresh token should no longer work.
        response = self.client.post(
            self.url,
            {
                "refresh": self.refresh,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

        # New refresh token should still work.
        response = self.client.post(
            self.url,
            {
                "refresh": new_refresh,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )