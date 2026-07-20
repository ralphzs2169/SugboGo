from unittest.mock import patch, Mock

from django.test import TestCase, override_settings
from requests import RequestException

from apps.authentication.services.oauth.facebook import (
    FacebookOAuthService,
    FacebookAuthError,
)


@override_settings(
    FACEBOOK_APP_ID="facebook-app-id",
    FACEBOOK_APP_SECRET="facebook-secret",
)
class FacebookOAuthServiceTests(TestCase):
    """Tests for Facebook OAuth token verification service."""

    @patch(
        "apps.authentication.services.oauth.facebook.requests.get"
    )
    def test_valid_access_token_returns_oauth_user(
        self,
        mock_get,
    ):
        debug_response = Mock()
        debug_response.raise_for_status.return_value = None
        debug_response.json.return_value = {
            "data": {
                "is_valid": True,
                "app_id": "facebook-app-id",
            }
        }

        profile_response = Mock()
        profile_response.raise_for_status.return_value = None
        profile_response.json.return_value = {
            "id": "facebook-123",
            "email": "john@example.com",
            "first_name": "John",
            "last_name": "Doe",
        }

        mock_get.side_effect = [
            debug_response,
            profile_response,
        ]

        user = FacebookOAuthService.verify_access_token(
            "valid-token",
        )

        self.assertEqual(
            user.provider,
            "facebook",
        )

        self.assertEqual(
            user.provider_id,
            "facebook-123",
        )

        self.assertEqual(
            user.email,
            "john@example.com",
        )

        self.assertEqual(
            user.first_name,
            "John",
        )

        self.assertEqual(
            user.last_name,
            "Doe",
        )

        self.assertEqual(
            mock_get.call_count,
            2,
        )


    @patch(
        "apps.authentication.services.oauth.facebook.requests.get"
    )
    def test_invalid_access_token_raises_error(
        self,
        mock_get,
    ):
        debug_response = Mock()
        debug_response.raise_for_status.return_value = None
        debug_response.json.return_value = {
            "data": {
                "is_valid": False,
                "app_id": "facebook-app-id",
            }
        }

        mock_get.return_value = debug_response

        with self.assertRaises(FacebookAuthError):
            FacebookOAuthService.verify_access_token(
                "invalid-token",
            )


    @patch(
        "apps.authentication.services.oauth.facebook.requests.get"
    )
    def test_token_from_wrong_facebook_app_raises_error(
        self,
        mock_get,
    ):
        debug_response = Mock()
        debug_response.raise_for_status.return_value = None
        debug_response.json.return_value = {
            "data": {
                "is_valid": True,
                "app_id": "another-facebook-app",
            }
        }

        mock_get.return_value = debug_response

        with self.assertRaises(FacebookAuthError):
            FacebookOAuthService.verify_access_token(
                "wrong-app-token",
            )


    @patch(
        "apps.authentication.services.oauth.facebook.requests.get"
    )
    def test_profile_without_email_raises_error(
        self,
        mock_get,
    ):
        debug_response = Mock()
        debug_response.raise_for_status.return_value = None
        debug_response.json.return_value = {
            "data": {
                "is_valid": True,
                "app_id": "facebook-app-id",
            }
        }

        profile_response = Mock()
        profile_response.raise_for_status.return_value = None
        profile_response.json.return_value = {
            "id": "facebook-123",
            "first_name": "John",
            "last_name": "Doe",
        }

        mock_get.side_effect = [
            debug_response,
            profile_response,
        ]

        with self.assertRaises(FacebookAuthError):
            FacebookOAuthService.verify_access_token(
                "valid-token",
            )


    @patch(
        "apps.authentication.services.oauth.facebook.requests.get"
    )
    def test_facebook_request_failure_raises_error(
        self,
        mock_get,
    ):
        response = Mock()
        response.raise_for_status.side_effect = RequestException()

        mock_get.return_value = response

        with self.assertRaises(FacebookAuthError):
            FacebookOAuthService.verify_access_token(
                "token",
            )