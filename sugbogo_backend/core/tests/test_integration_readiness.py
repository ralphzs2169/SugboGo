"""Check deployment-facing provider contracts without SQL or live API requests."""

from pathlib import Path
import runpy
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.test import SimpleTestCase, override_settings

from apps.authentication.services.email_service import EmailService
from apps.authentication.services.oauth.facebook import FacebookOAuthService
from apps.authentication.services.oauth.google import GoogleOAuthService
from apps.reviews.services.review_moderation_service import ReviewModerationService
from apps.shared.services.gemini_structured_service import (
    GeminiStructuredService,
    PermanentGenerationError,
)
from core.tests import test_production_settings


class IntegrationReadinessTests(SimpleTestCase):
    """Preserve the implemented provider configuration and disabled feature gates."""

    def test_configuration_accepts_missing_providers_without_enabling_unfinished_features(self):
        """Settings load without keys while payment and experimental flags remain off."""
        configuration = test_production_settings.ProductionSettingsTests.load_settings(self)
        self.assertIsNone(configuration["RESEND_API_KEY"])
        self.assertEqual(configuration["OPENAI_API_KEY"], "")
        self.assertEqual(configuration["GEMINI_API_KEY"], "")
        self.assertFalse(configuration["PAYMONGO_CHECKOUT_ENABLED"])
        self.assertFalse(configuration["GEMINI_SENTIMENT_SHADOW_ENABLED"])
        self.assertFalse(configuration["GEMINI_SENTIMENT_CUTOVER_ENABLED"])

    @override_settings(RESEND_API_KEY=None)
    def test_missing_resend_key_rejects_email_module_import(self):
        """Document the existing import-time requirement without changing startup."""
        path = (
            Path(__file__).resolve().parents[2]
            / "apps/authentication/services/email_service.py"
        )
        with self.assertRaisesRegex(ValueError, "RESEND_API_KEY"):
            runpy.run_path(str(path))

    @override_settings(DEFAULT_FROM_EMAIL="sender@example.com")
    def test_email_uses_configured_sender_and_mocked_provider(self):
        """Keep sender configuration and existing transactional email transport."""
        with (
            patch(
                "apps.authentication.services.email_service.render_to_string",
                return_value="fixture",
            ),
            patch("apps.authentication.services.email_service.resend.Emails.send") as send,
        ):
            EmailService.send_email(
                subject="Fixture",
                recipient="recipient@example.com",
                html_template_name="unused-fixture.html",
            )
        self.assertEqual(send.call_args.args[0]["from"], "sender@example.com")

    @override_settings(GOOGLE_OAUTH_CLIENT_ID="fixture-audience")
    def test_google_oauth_verifies_the_configured_audience(self):
        """Require provider validation to receive the intended application's audience."""
        with patch(
            "apps.authentication.services.oauth.google.id_token.verify_oauth2_token",
            return_value={"sub": "fixture-id", "email": "fixture@example.com"},
        ) as verify:
            user = GoogleOAuthService.verify_id_token("fixture-token")
        self.assertEqual(verify.call_args.args[2], "fixture-audience")
        self.assertEqual(user.provider, "google")

    @override_settings(
        FACEBOOK_APP_ID="fixture-app",
        FACEBOOK_APP_SECRET="fixture-only",
    )
    def test_facebook_oauth_keeps_app_ownership_validation(self):
        """Use mocked provider responses while checking the configured Facebook app."""
        debug = Mock()
        debug.json.return_value = {"data": {"is_valid": True, "app_id": "fixture-app"}}
        profile = Mock()
        profile.json.return_value = {"id": "fixture-id", "email": "fixture@example.com"}
        with patch(
            "apps.authentication.services.oauth.facebook.requests.get",
            side_effect=[debug, profile],
        ) as request:
            user = FacebookOAuthService.verify_access_token("fixture-token")
        self.assertEqual(request.call_count, 2)
        self.assertEqual(user.provider, "facebook")

    @override_settings(OPENAI_API_KEY="")
    def test_missing_openai_key_preserves_provider_failure(self):
        """Missing credentials must not silently publish unmoderated reviews."""
        with patch("apps.reviews.services.review_moderation_service.OpenAI") as client:
            result = ReviewModerationService.moderate("A fixture review.")
        self.assertEqual(result["outcome"], "provider_failure")
        client.assert_not_called()

    @override_settings(GEMINI_API_KEY="")
    def test_missing_gemini_key_is_rejected_before_provider_creation(self):
        """Keep missing-provider handling separate from model inference."""
        with patch("google.genai.Client") as client:
            with self.assertRaises(PermanentGenerationError):
                GeminiStructuredService.generate(
                    model="fixture-model",
                    instruction="fixture",
                    evidence={},
                    schema={},
                )
        client.assert_not_called()

    @override_settings(GEMINI_API_KEY="fixture-only")
    def test_gemini_transport_preserves_model_and_response_contract(self):
        """Exercise the SDK boundary through a mock rather than a paid request."""
        response = SimpleNamespace(text='{"fixture": true}', usage_metadata=None)
        with patch("google.genai.Client") as client:
            provider = client.return_value.__enter__.return_value
            provider.models.generate_content.return_value = response
            result, usage = GeminiStructuredService.generate(
                model="fixture-model",
                instruction="fixture",
                evidence={},
                schema={},
            )
        self.assertEqual(result, response.text)
        self.assertEqual(
            provider.models.generate_content.call_args.kwargs["model"],
            "fixture-model",
        )
        self.assertIn("duration_ms", usage)
