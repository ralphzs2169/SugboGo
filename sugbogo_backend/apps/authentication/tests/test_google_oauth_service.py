from unittest.mock import patch

from django.test import TestCase, override_settings

from google.auth.exceptions import GoogleAuthError

from apps.authentication.services.oauth.google import (
    GoogleOAuthService,
)
from apps.authentication.services.oauth.base import OAuthUser


@override_settings(
    GOOGLE_OAUTH_CLIENT_ID="google-client-id",
)
class GoogleOAuthServiceTests(TestCase):
    """Tests for Google OAuth verification service."""

    @patch(
        "apps.authentication.services.oauth.google.id_token.verify_oauth2_token"
    )
    def test_valid_id_token_returns_oauth_user(
        self,
        mock_verify,
    ):
        mock_verify.return_value = {
            "sub": "google-123",
            "email": "john@example.com",
            "given_name": "John",
            "family_name": "Doe",
        }

        user = GoogleOAuthService.verify_id_token(
            "valid-token",
        )

        self.assertIsInstance(
            user,
            OAuthUser,
        )

        self.assertEqual(
            user.provider,
            "google",
        )

        self.assertEqual(
            user.provider_id,
            "google-123",
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

        mock_verify.assert_called_once()


    @patch(
        "apps.authentication.services.oauth.google.id_token.verify_oauth2_token"
    )
    def test_invalid_id_token_raises_error(
        self,
        mock_verify,
    ):
        mock_verify.side_effect = GoogleAuthError(
            "Invalid token"
        )

        with self.assertRaises(
            GoogleAuthError,
        ):
            GoogleOAuthService.verify_id_token(
                "invalid-token",
            )


    @patch(
        "apps.authentication.services.oauth.google.id_token.verify_oauth2_token"
    )
    def test_missing_optional_name_fields_use_defaults(
        self,
        mock_verify,
    ):
        mock_verify.return_value = {
            "sub": "google-123",
            "email": "john@example.com",
        }

        user = GoogleOAuthService.verify_id_token(
            "valid-token",
        )

        self.assertEqual(
            user.first_name,
            "",
        )

        self.assertEqual(
            user.last_name,
            "",
        )


    @patch(
        "apps.authentication.services.oauth.google.id_token.verify_oauth2_token"
    )
    def test_missing_email_raises_error(
        self,
        mock_verify,
    ):
        mock_verify.return_value = {
            "sub": "google-123",
            "given_name": "John",
            "family_name": "Doe",
        }

        with self.assertRaises(
            KeyError,
        ):
            GoogleOAuthService.verify_id_token(
                "valid-token",
            )