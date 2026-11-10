"""Check deployment-facing provider contracts without SQL or live API requests."""

import os
from pathlib import Path
import subprocess
import sys
from textwrap import dedent
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.conf import settings
from django.core.management.utils import get_random_secret_key
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

    def test_missing_resend_key_allows_django_startup(self):
        """Import URLs, run checks and load migrations without dotenv or credentials."""
        environment = os.environ.copy()
        environment.pop("RESEND_API_KEY", None)
        environment.update(
            {
                "DJANGO_SETTINGS_MODULE": "config.settings",
                "DEBUG": "False",
                "SECRET_KEY": get_random_secret_key(),
                "ALLOWED_HOSTS": "api.example.com",
                "DB_ENGINE": "django.contrib.gis.db.backends.postgis",
                "DB_HOST": "127.0.0.1",
                "DB_NAME": "unused_startup_fixture",
                "DB_USER": "",
                "DB_PASSWORD": "",
            },
        )

        for name in ("GDAL_LIBRARY_PATH", "GEOS_LIBRARY_PATH"):
            value = getattr(settings, name, None)
            if value:
                environment[name] = value

        result = subprocess.run(
            [
                sys.executable,
                "-B",
                "-c",
                dedent(
                    """
                    from unittest.mock import patch

                    with (
                        patch("dotenv.load_dotenv"),
                        patch("resend.Emails.send") as send,
                    ):
                        import django
                        django.setup()

                        from django.conf import settings
                        from django.core.management import call_command
                        from django.db.migrations.loader import MigrationLoader
                        import apps.authentication.urls

                        assert settings.RESEND_API_KEY is None
                        assert apps.authentication.urls.urlpatterns
                        call_command("check")
                        loader = MigrationLoader(None)
                        assert loader.graph.leaf_nodes("authentication")
                        send.assert_not_called()
                    """,
                ),
            ],
            cwd=Path(__file__).resolve().parents[2],
            env=environment,
            capture_output=True,
            text=True,
            timeout=60,
        )
        self.assertEqual(
            result.returncode,
            0,
            result.stdout + result.stderr,
        )

    @override_settings(
        DEFAULT_FROM_EMAIL="sender@example.com",
        RESEND_API_KEY="fixture-only",
    )
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
