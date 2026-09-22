from unittest.mock import Mock, patch

from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from google.auth.exceptions import TransportError
from requests import HTTPError, Timeout
from rest_framework.test import APITestCase
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken

from apps.authentication.models import OAuthAccount
from apps.authentication.services.oauth.base import OAuthUser
from apps.authentication.services.oauth.facebook import FacebookOAuthService
from apps.authentication.services.oauth.google import GoogleOAuthService
from apps.users.models import User


@override_settings(
    FACEBOOK_APP_ID="test-facebook-app",
    FACEBOOK_APP_SECRET="test-facebook-secret",
    GOOGLE_OAUTH_CLIENT_ID="test-google-client",
)
class OAuthErrorHandlingTests(APITestCase):
    """Check endpoint errors with real provider adapters and account resolution."""

    def setUp(self):
        cache.clear()

    def _facebook_response(self, payload, status_code=200):
        """Build a provider response without making a network request."""
        response = Mock(status_code=status_code)
        response.json.return_value = payload
        if status_code >= 400:
            response.raise_for_status.side_effect = HTTPError()
        return response

    def _facebook_login(self):
        """Call the Facebook endpoint through its real verification service."""
        return self.client.post(
            reverse("facebook_login"),
            {"access_token": "test-token"},
            format="json",
        )

    def test_facebook_rejected_token_returns_401_from_real_service(self):
        provider_response = self._facebook_response({"data": {"is_valid": False}})
        with patch(
            "apps.authentication.services.oauth.facebook.requests.get",
            return_value=provider_response,
        ):
            response = self._facebook_login()
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data["code"], "INVALID_FACEBOOK_TOKEN")

    def test_facebook_http_errors_distinguish_rejection_from_outage(self):
        for status_code, expected_status, expected_code in (
            (400, 401, "INVALID_FACEBOOK_TOKEN"),
            (503, 503, "FACEBOOK_SERVICE_UNAVAILABLE"),
        ):
            with self.subTest(status_code=status_code):
                provider_response = self._facebook_response({}, status_code)
                with patch(
                    "apps.authentication.services.oauth.facebook.requests.get",
                    return_value=provider_response,
                ):
                    response = self._facebook_login()
                self.assertEqual(response.status_code, expected_status)
                self.assertEqual(response.data["code"], expected_code)

    def test_facebook_timeout_returns_503(self):
        with patch(
            "apps.authentication.services.oauth.facebook.requests.get",
            side_effect=Timeout(),
        ):
            response = self._facebook_login()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["code"], "FACEBOOK_SERVICE_UNAVAILABLE")

    def test_facebook_malformed_debug_payload_returns_401(self):
        for payload in ({}, {"data": None}, {"data": []}, []):
            with self.subTest(payload=payload):
                with patch(
                    "apps.authentication.services.oauth.facebook.requests.get",
                    return_value=self._facebook_response(payload),
                ):
                    response = self._facebook_login()
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.data["code"], "INVALID_FACEBOOK_TOKEN")

    def test_facebook_missing_profile_identity_returns_401(self):
        debug_payload = {"data": {"is_valid": True, "app_id": "test-facebook-app"}}
        for profile in ({"id": "provider-id"}, {"email": "user@example.com"}):
            with self.subTest(profile=profile):
                with patch(
                    "apps.authentication.services.oauth.facebook.requests.get",
                    side_effect=[
                        self._facebook_response(debug_payload),
                        self._facebook_response(profile),
                    ],
                ):
                    response = self._facebook_login()
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.data["code"], "INVALID_FACEBOOK_TOKEN")

    def test_google_invalid_token_and_provider_outage_have_controlled_errors(self):
        for error, expected_status, expected_code in (
            (ValueError("Invalid audience"), 401, "INVALID_GOOGLE_TOKEN"),
            (TransportError("Unavailable"), 503, "GOOGLE_SERVICE_UNAVAILABLE"),
        ):
            with self.subTest(error=type(error).__name__):
                with patch(
                    "apps.authentication.services.oauth.google.id_token.verify_oauth2_token",
                    side_effect=error,
                ):
                    response = self.client.post(
                        reverse("google_login"),
                        {"id_token": "test-token"},
                        format="json",
                    )
                self.assertEqual(response.status_code, expected_status)
                self.assertEqual(response.data["code"], expected_code)

    def test_google_missing_identity_returns_401(self):
        for payload in ({"sub": "provider-id"}, {"email": "user@example.com"}):
            with self.subTest(payload=payload):
                with patch(
                    "apps.authentication.services.oauth.google.id_token.verify_oauth2_token",
                    return_value=payload,
                ):
                    response = self.client.post(
                        reverse("google_login"),
                        {"id_token": "test-token"},
                        format="json",
                    )
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.data["code"], "INVALID_GOOGLE_TOKEN")

    def _login_as(self, provider, user, linked):
        """Exercise account resolution after a provider verifies an identity."""
        cache.clear()
        oauth_user = OAuthUser(
            provider=provider,
            provider_id=f"{provider}-{user.pk}",
            email=f"changed-{user.pk}@example.com" if linked else user.USER_EMAIL,
            first_name="OAuth",
            last_name="User",
        )
        if linked:
            OAuthAccount.objects.create(
                USER=user,
                OAUTH_PROVIDER=provider,
                OAUTH_PROVIDER_ID=oauth_user.provider_id,
            )
        service, method, field = (
            (GoogleOAuthService, "verify_id_token", "id_token")
            if provider == "google"
            else (FacebookOAuthService, "verify_access_token", "access_token")
        )
        with patch.object(service, method, return_value=oauth_user):
            return self.client.post(
                reverse(f"{provider}_login"),
                {field: "test-token"},
                format="json",
            )

    def test_inactive_accounts_are_rejected_by_email_and_provider_link(self):
        for provider in ("google", "facebook"):
            for account_status in (User.UserStatus.SUSPENDED, User.UserStatus.DISABLED):
                for linked in (False, True):
                    with self.subTest(provider=provider, status=account_status, linked=linked):
                        user = User.objects.create_user(
                            email=f"{provider}-{account_status}-{linked}@example.com",
                            password=None,
                            USER_ROLE=User.UserRole.EXPLORER,
                            USER_STATUS=account_status,
                        )
                        response = self._login_as(provider, user, linked)
                        self.assertEqual(response.status_code, 403)
                        self.assertEqual(response.data["code"], "ACCOUNT_INACTIVE")
                        self.assertNotIn("data", response.data)
                        self.assertFalse(OutstandingToken.objects.filter(user=user).exists())
                        self.assertEqual(OAuthAccount.objects.filter(USER=user).count(), int(linked))
                        user.refresh_from_db()
                        self.assertEqual(user.USER_STATUS, account_status)
                        self.assertFalse(user.EMAIL_VERIFIED)

    def test_admin_accounts_are_rejected_even_when_provider_email_changes(self):
        for provider in ("google", "facebook"):
            for role in (User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN):
                for linked in (False, True):
                    with self.subTest(provider=provider, role=role, linked=linked):
                        user = User.objects.create_user(
                            email=f"{provider}-{role}-{linked}@example.com",
                            password=None,
                            USER_ROLE=role,
                            USER_STATUS=User.UserStatus.ACTIVE,
                        )
                        response = self._login_as(provider, user, linked)
                        self.assertEqual(response.status_code, 403)
                        self.assertEqual(response.data["code"], "OAUTH_LOGIN_DENIED")
                        self.assertFalse(OutstandingToken.objects.filter(user=user).exists())
                        self.assertEqual(OAuthAccount.objects.filter(USER=user).count(), int(linked))

    def test_linked_pending_users_are_activated_and_can_login(self):
        for provider in ("google", "facebook"):
            with self.subTest(provider=provider):
                user = User.objects.create_user(
                    email=f"pending-{provider}@example.com",
                    password=None,
                    USER_ROLE=User.UserRole.MERCHANT,
                    USER_STATUS=User.UserStatus.PENDING,
                )
                response = self._login_as(provider, user, linked=True)
                self.assertEqual(response.status_code, 200, response.data)
                self.assertIn("access", response.data["data"])
                self.assertIn("refresh", response.data["data"])
                self.assertEqual(response.data["data"]["user"]["id"], user.pk)
                user.refresh_from_db()
                self.assertEqual(user.USER_STATUS, User.UserStatus.ACTIVE)
                self.assertTrue(user.EMAIL_VERIFIED)
