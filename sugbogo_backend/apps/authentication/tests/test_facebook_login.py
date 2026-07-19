from unittest.mock import patch

from requests.exceptions import RequestException

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.authentication.services.oauth.base import OAuthUser
from apps.authentication.models import OAuthAccount
from apps.users.models import User
from apps.core.tests.assertions import APIResponseAssertionsMixin


class FacebookLoginViewTests(
    APIResponseAssertionsMixin,
    APITestCase,
):
    def setUp(self):
        self.url = reverse("facebook_login")

        self.oauth_user = OAuthUser(
            provider="facebook",
            provider_id="facebook-123",
            email="john@example.com",
            first_name="John",
            last_name="Doe",
        )

    @patch(
        "apps.authentication.views.facebook_login.FacebookOAuthService.verify_access_token"
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
                "access_token": "fake-facebook-token",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertSuccessResponse(
            response,
            message="Facebook login successful.",
            status_code=status.HTTP_200_OK,
        )

        self.assertIn("access", response.data["data"])
        self.assertIn("refresh", response.data["data"])

        self.assertEqual(
            response.data["data"]["user"]["email"],
            user.USER_EMAIL,
        )

    @patch(
        "apps.authentication.views.facebook_login.FacebookOAuthService.verify_access_token"
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
                "access_token": "fake-facebook-token",
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
        "apps.authentication.views.facebook_login.FacebookOAuthService.verify_access_token"
    )
    def test_invalid_facebook_token_returns_401(
        self,
        mock_verify,
    ):
        mock_verify.side_effect = ValueError()

        response = self.client.post(
            self.url,
            {
                "access_token": "invalid-token",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

        self.assertErrorResponse(
            response,
            code="INVALID_FACEBOOK_TOKEN",
            message="Invalid Facebook token.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    @patch(
        "apps.authentication.views.facebook_login.FacebookOAuthService.verify_access_token"
    )
    def test_facebook_service_unavailable_returns_503(
        self,
        mock_verify,
    ):
        mock_verify.side_effect = RequestException()

        response = self.client.post(
            self.url,
            {
                "access_token": "fake-token",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_503_SERVICE_UNAVAILABLE,
        )

        self.assertErrorResponse(
            response,
            code="FACEBOOK_SERVICE_UNAVAILABLE",
            message="Unable to verify Facebook token.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    @patch(
        "apps.authentication.views.facebook_login.FacebookOAuthService.verify_access_token"
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
                "access_token": "fake-token",
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
        "apps.authentication.views.facebook_login.FacebookOAuthService.verify_access_token"
    )
    def test_existing_user_is_linked_to_facebook_account(
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
                "access_token": "fake-token",
            },
            format="json",
        )

        self.assertEqual(OAuthAccount.objects.count(), 1)

        oauth = OAuthAccount.objects.get(USER=user)

        self.assertEqual(oauth.USER, user)

        self.assertEqual(
            oauth.OAUTH_PROVIDER,
            "facebook",
        )

        self.assertEqual(
            oauth.OAUTH_PROVIDER_ID,
            self.oauth_user.provider_id,
        )

    @patch(
        "apps.authentication.views.facebook_login.FacebookOAuthService.verify_access_token"
    )
    def test_new_facebook_user_creates_oauth_account(
        self,
        mock_verify,
    ):
        mock_verify.return_value = self.oauth_user

        self.client.post(
            self.url,
            {
                "access_token": "fake-token",
            },
            format="json",
        )

        self.assertEqual(User.objects.count(), 1)

        self.assertEqual(OAuthAccount.objects.count(), 1)

        user = User.objects.first()

        oauth = OAuthAccount.objects.get(USER=user)

        self.assertEqual(oauth.USER, user)

        self.assertEqual(
            oauth.OAUTH_PROVIDER,
            "facebook",
        )

        self.assertEqual(
            oauth.OAUTH_PROVIDER_ID,
            self.oauth_user.provider_id,
        )

    @patch(
        "apps.authentication.views.facebook_login.FacebookOAuthService.verify_access_token"
    )
    def test_facebook_user_has_unusable_password(
        self,
        mock_verify,
    ):
        mock_verify.return_value = self.oauth_user

        self.client.post(
            self.url,
            {
                "access_token": "fake-token",
            },
            format="json",
        )

        user = User.objects.first()

        self.assertFalse(user.has_usable_password())

    @patch(
        "apps.authentication.views.facebook_login.FacebookOAuthService.verify_access_token"
    )
    def test_facebook_login_twice_does_not_create_duplicates(
        self,
        mock_verify,
    ):
        mock_verify.return_value = self.oauth_user

        self.client.post(
            self.url,
            {
                "access_token": "fake-token",
            },
            format="json",
        )

        self.client.post(
            self.url,
            {
                "access_token": "fake-token",
            },
            format="json",
        )

        self.assertEqual(User.objects.count(), 1)

        self.assertEqual(OAuthAccount.objects.count(), 1)

    @patch(
        "apps.authentication.views.facebook_login.FacebookOAuthService.verify_access_token"
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
            OAUTH_PROVIDER="facebook",
            OAUTH_PROVIDER_ID=self.oauth_user.provider_id,
        )

        self.client.post(
            self.url,
            {
                "access_token": "fake-token",
            },
            format="json",
        )

        self.assertEqual(User.objects.count(), 1)

        self.assertEqual(OAuthAccount.objects.count(), 1)