from unittest.mock import patch

from google.auth.exceptions import GoogleAuthError

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.authentication.services.oauth.base import OAuthUser
from apps.users.models import User
from apps.core.tests.assertions import APIResponseAssertionsMixin


class GoogleLoginViewTests(APIResponseAssertionsMixin, APITestCase):
    def setUp(self):
        self.url = reverse("google_login")

        self.oauth_user = OAuthUser(
            provider="google",
            provider_id="google-123",
            email="john@example.com",
            first_name="John",
            last_name="Doe",
        )

    @patch(
        "apps.authentication.views.oauth.GoogleOAuthService.verify_id_token"
    )
    def test_existing_user_can_login(
        self,
        mock_verify,
    ):
        mock_verify.return_value = self.oauth_user

        user = User.objects.create_user(
            email="john@example.com",
            password="Password123!",
            USER_FNAME="John",
            USER_LNAME="Doe",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
            EMAIL_VERIFIED=True,
        )

        response = self.client.post(
            self.url,
            {
                "id_token": "fake-google-token",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertSuccessResponse(
            response,
            message="Google login successful.",
            status_code=status.HTTP_200_OK,
        )

        self.assertIn("access", response.data["data"])
        self.assertIn("refresh", response.data["data"])

        self.assertEqual(
            response.data["data"]["user"]["email"],
            user.USER_EMAIL,
        )

    @patch(
        "apps.authentication.views.oauth.GoogleOAuthService.verify_id_token"
    )
    def test_new_user_is_created(
        self,
        mock_verify,
    ):
        mock_verify.return_value = self.oauth_user

        self.assertEqual(User.objects.count(), 0)

        response = self.client.post(
            self.url,
            {
                "id_token": "fake-google-token",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(User.objects.count(), 1)

        user = User.objects.first()

        self.assertTrue(user.EMAIL_VERIFIED)
        self.assertEqual(
            user.USER_STATUS,
            User.UserStatus.ACTIVE,
        )

    @patch(
        "apps.authentication.views.oauth.GoogleOAuthService.verify_id_token"
    )
    def test_invalid_google_token_returns_401(
        self,
        mock_verify,
    ):
        mock_verify.side_effect = GoogleAuthError(
            "Invalid token"
        )

        response = self.client.post(
            self.url,
            {
                "id_token": "invalid-token",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

        self.assertErrorResponse(
            response,
            code="INVALID_GOOGLE_TOKEN",
            message="Invalid Google token.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    @patch(
        "apps.authentication.views.oauth.GoogleOAuthService.verify_id_token"
    )
    def test_pending_user_is_activated(
        self,
        mock_verify,
    ):
        mock_verify.return_value = self.oauth_user

        user = User.objects.create_user(
            email="john@example.com",
            password="Password123!",
            USER_FNAME="John",
            USER_LNAME="Doe",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.PENDING,
            EMAIL_VERIFIED=False,
        )

        self.client.post(
            self.url,
            {
                "id_token": "fake-token",
            },
            format="json",
        )

        user.refresh_from_db()

        self.assertEqual(
            user.USER_STATUS,
            User.UserStatus.ACTIVE,
        )

        self.assertTrue(user.EMAIL_VERIFIED)

        self.assertIsNotNone(
            user.EMAIL_VERIFIED_AT,
        )