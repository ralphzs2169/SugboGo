from unittest.mock import patch

from google.auth.exceptions import GoogleAuthError

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.authentication.services.oauth.base import OAuthUser
from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin
from apps.authentication.models import OAuthAccount


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
        "apps.authentication.views.google_login.GoogleOAuthService.verify_id_token"
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
        "apps.authentication.views.google_login.GoogleOAuthService.verify_id_token"
    )
    def test_new_user_is_created(
        self,
        mock_verify,
    ):
        mock_verify.return_value = self.oauth_user

        self.assertFalse(
            User.objects.filter(
                USER_EMAIL="john@example.com",
            ).exists()
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

        self.assertEqual(
            User.objects.filter(
                USER_EMAIL="john@example.com",
            ).count(),
            1,
        )

        user = User.objects.get(
            USER_EMAIL="john@example.com",
        )

        self.assertTrue(user.EMAIL_VERIFIED)
        self.assertEqual(
            user.USER_STATUS,
            User.UserStatus.ACTIVE,
        )

    @patch(
        "apps.authentication.views.google_login.GoogleOAuthService.verify_id_token"
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
        "apps.authentication.views.google_login.GoogleOAuthService.verify_id_token"
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

    @patch(
    "apps.authentication.views.google_login.GoogleOAuthService.verify_id_token"
    )
    def test_existing_user_is_linked_to_google_account(
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

        self.assertEqual(OAuthAccount.objects.count(), 0)

        self.client.post(
            self.url,
            {
                "id_token": "fake-token",
            },
            format="json",
        )

        self.assertEqual(OAuthAccount.objects.count(), 1)

        oauth = OAuthAccount.objects.get(USER=user)

        self.assertEqual(oauth.USER, user)
        self.assertEqual(oauth.OAUTH_PROVIDER, "google")
        self.assertEqual(
            oauth.OAUTH_PROVIDER_ID,
            self.oauth_user.provider_id,
        )


    @patch(
        "apps.authentication.views.google_login.GoogleOAuthService.verify_id_token"
    )
    def test_new_google_user_creates_oauth_account(
        self,
        mock_verify,
    ):
        mock_verify.return_value = self.oauth_user

        self.client.post(
            self.url,
            {
                "id_token": "fake-token",
            },
            format="json",
        )

        self.assertEqual(
            User.objects.filter(
                USER_EMAIL="john@example.com",
            ).count(),
            1,
        )
        self.assertEqual(OAuthAccount.objects.count(), 1)

        user = User.objects.get(
            USER_EMAIL="john@example.com",
        )
        oauth = OAuthAccount.objects.get(USER=user)

        self.assertEqual(oauth.USER, user)
        self.assertEqual(oauth.OAUTH_PROVIDER, "google")
        self.assertEqual(
            oauth.OAUTH_PROVIDER_ID,
            self.oauth_user.provider_id,
        )

    
    @patch(
        "apps.authentication.views.google_login.GoogleOAuthService.verify_id_token"
    )
    def test_google_user_has_unusable_password(
        self,
        mock_verify,
    ):
        mock_verify.return_value = self.oauth_user

        self.client.post(
            self.url,
            {
                "id_token": "fake-token",
            },
            format="json",
        )

        user = User.objects.get(
            USER_EMAIL="john@example.com",
        )

        self.assertFalse(user.has_usable_password())


    @patch(
        "apps.authentication.views.google_login.GoogleOAuthService.verify_id_token"
    )
    def test_google_login_twice_does_not_create_duplicates(
        self,
        mock_verify,
    ):
        mock_verify.return_value = self.oauth_user

        self.client.post(
            self.url,
            {
                "id_token": "fake-token",
            },
            format="json",
        )

        self.client.post(
            self.url,
            {
                "id_token": "fake-token",
            },
            format="json",
        )

        self.assertEqual(
            User.objects.filter(
                USER_EMAIL="john@example.com",
            ).count(),
            1,
        )
        self.assertEqual(OAuthAccount.objects.count(), 1)


    @patch(
        "apps.authentication.views.google_login.GoogleOAuthService.verify_id_token"
    )
    def test_existing_oauth_account_is_reused(
        self,
        mock_verify,
    ):
        mock_verify.return_value = self.oauth_user

        user = User.objects.create_user(
            email="john@example.com",
            password=None,
            USER_FNAME="John",
            USER_LNAME="Doe",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
            EMAIL_VERIFIED=True,
        )

        user.set_unusable_password()
        user.save(update_fields=["password"])

        OAuthAccount.objects.create(
            USER=user,
            OAUTH_PROVIDER="google",
            OAUTH_PROVIDER_ID=self.oauth_user.provider_id,
        )

        self.client.post(
            self.url,
            {
                "id_token": "fake-token",
            },
            format="json",
        )

        self.assertEqual(
            User.objects.filter(
                USER_EMAIL="john@example.com",
            ).count(),
            1,
        )
        self.assertEqual(OAuthAccount.objects.count(), 1)