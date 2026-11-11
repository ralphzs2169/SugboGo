import time
from unittest.mock import ANY, patch

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from django.test import SimpleTestCase, override_settings

from google.auth import crypt, jwt
from google.auth.exceptions import GoogleAuthError

from apps.authentication.services.oauth.google import (
    GoogleOAuthConfigurationError,
    GoogleOAuthService,
)
from apps.authentication.services.oauth.base import OAuthUser


@override_settings(
    GOOGLE_OAUTH_CLIENT_ID="google-client-id",
)
class GoogleOAuthServiceTests(SimpleTestCase):
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
            "email_verified": True,
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

        mock_verify.assert_called_once_with(
            "valid-token",
            ANY,
            audience="google-client-id",
        )
        self.assertFalse(user.email_authoritative)


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
            "email_verified": True,
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
            ValueError,
        ):
            GoogleOAuthService.verify_id_token(
                "valid-token",
            )

    @patch(
        "apps.authentication.services.oauth.google.id_token.verify_oauth2_token"
    )
    def test_missing_or_blank_audience_never_calls_google(
        self,
        mock_verify,
    ):
        for audience in (None, "", " \t\n", [], ["client-id"]):
            with self.subTest(audience=audience):
                with override_settings(GOOGLE_OAUTH_CLIENT_ID=audience):
                    with self.assertRaises(GoogleOAuthConfigurationError):
                        GoogleOAuthService.verify_id_token("test-token")
        mock_verify.assert_not_called()

    @patch(
        "apps.authentication.services.oauth.google.id_token.verify_oauth2_token"
    )
    def test_only_explicit_verified_email_claims_are_accepted(
        self,
        mock_verify,
    ):
        for claim in (None, False, "false", "True", "yes", 1, [], {}):
            with self.subTest(claim=claim):
                mock_verify.return_value = {
                    "sub": "google-123",
                    "email": "john@gmail.com",
                    "email_verified": claim,
                }
                with self.assertRaises(ValueError):
                    GoogleOAuthService.verify_id_token("test-token")

    @patch(
        "apps.authentication.services.oauth.google.id_token.verify_oauth2_token"
    )
    def test_email_authority_follows_google_hosted_identity_claims(
        self,
        mock_verify,
    ):
        for email, hosted_domain, expected_authority in (
            ("john@gmail.com", None, True),
            ("john@GMAIL.COM", None, True),
            ("john@workspace.example", "workspace.example", True),
            ("john@example.com", None, False),
            ("john@gmail.com.attacker.example", None, False),
            ("john@example.com", "", False),
            ("john@example.com", "   ", False),
            ("john@example.com", True, False),
        ):
            for verified_claim in (True, "true"):
                with self.subTest(
                    email=email,
                    hd=hosted_domain,
                    verified=verified_claim,
                ):
                    mock_verify.return_value = {
                        "sub": "google-123",
                        "email": email,
                        "email_verified": verified_claim,
                        "hd": hosted_domain,
                    }
                    user = GoogleOAuthService.verify_id_token("test-token")
                    self.assertEqual(user.email_authoritative, expected_authority)

    @patch(
        "apps.authentication.services.oauth.google.id_token.verify_oauth2_token"
    )
    def test_malformed_subject_email_and_payload_are_rejected(
        self,
        mock_verify,
    ):
        valid_payload = {
            "sub": "google-123",
            "email": "john@gmail.com",
            "email_verified": True,
        }
        invalid_claims = (
            ("sub", None),
            ("sub", ""),
            ("sub", "  "),
            ("sub", " google-123"),
            ("sub", 123),
            ("sub", ["google-123"]),
            ("sub", "x" * 256),
            ("sub", "non-ascii-\u00e9"),
            ("email", None),
            ("email", ""),
            ("email", "john"),
            ("email", " john@gmail.com"),
            ("email", {"email": "john@gmail.com"}),
            ("email", "x" * 90 + "@example.com"),
        )
        for claim, value in invalid_claims:
            with self.subTest(claim=claim, value=value):
                mock_verify.return_value = {
                    **valid_payload,
                    claim: value,
                }
                with self.assertRaises(ValueError):
                    GoogleOAuthService.verify_id_token("test-token")
        for payload in (None, [], "invalid", {}):
            with self.subTest(payload=payload):
                mock_verify.return_value = payload
                with self.assertRaises(ValueError):
                    GoogleOAuthService.verify_id_token("test-token")

    def test_real_google_verifier_enforces_the_configured_audience(self):
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
        )
        private_pem = private_key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
        public_pem = private_key.public_key().public_bytes(
            serialization.Encoding.PEM,
            serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        signer = crypt.RSASigner.from_string(
            private_pem,
            key_id="test-key",
        )
        for audience in ("google-client-id", "another-app-client-id", None):
            with self.subTest(audience=audience):
                payload = {
                    "sub": "google-123",
                    "email": "john@gmail.com",
                    "email_verified": True,
                    "iss": "https://accounts.google.com",
                    "iat": int(time.time()),
                    "exp": int(time.time()) + 300,
                }
                if audience is not None:
                    payload["aud"] = audience
                token = jwt.encode(signer, payload)
                with patch(
                    "google.oauth2.id_token._fetch_certs",
                    return_value={"test-key": public_pem},
                ):
                    if audience == "google-client-id":
                        user = GoogleOAuthService.verify_id_token(token)
                        self.assertEqual(user.provider_id, "google-123")
                    else:
                        with self.assertRaises(ValueError):
                            GoogleOAuthService.verify_id_token(token)
