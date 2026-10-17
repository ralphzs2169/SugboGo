"""Small Gemini JSON transport shared by evidence-grounded generation features."""

import json
import time

from django.conf import settings


class TransientGenerationError(Exception):
    """Signal a provider failure eligible for bounded background retries."""


class PermanentGenerationError(Exception):
    """Signal controlled provider failure without exposing sensitive response details."""


class GeminiStructuredService:
    """Request structured JSON with existing credentials, timeout, and SDK."""

    @staticmethod
    def generate(*, model, instruction, evidence, schema):
        """Return response text and usage metadata without logging prompts or provider errors."""
        import httpx
        from google import genai
        from google.genai import errors, types

        if not settings.GEMINI_API_KEY:
            raise PermanentGenerationError("provider_not_configured")
        started = time.monotonic()
        try:
            with genai.Client(
                api_key=settings.GEMINI_API_KEY,
                http_options=types.HttpOptions(
                    timeout=settings.GEMINI_TIMEOUT_SECONDS * 1000,
                    retry_options=types.HttpRetryOptions(attempts=1),
                ),
            ) as client:
                response = client.models.generate_content(
                    model=model, contents=json.dumps(evidence, ensure_ascii=False),
                    config=types.GenerateContentConfig(
                        system_instruction=instruction, response_mime_type="application/json",
                        response_json_schema=schema, max_output_tokens=1024,
                    ),
                )
                usage = response.usage_metadata
                return response.text, {
                    "duration_ms": round((time.monotonic() - started) * 1000),
                    "input_tokens": getattr(usage, "prompt_token_count", None),
                    "output_tokens": getattr(usage, "candidates_token_count", None),
                    "total_tokens": getattr(usage, "total_token_count", None),
                }
        except errors.APIError as exc:
            if exc.code in (408, 429, 500, 502, 503, 504):
                raise TransientGenerationError("provider_temporarily_unavailable") from None
            raise PermanentGenerationError("provider_rejected_request") from None
        except (httpx.TransportError, TimeoutError, ConnectionError):
            raise TransientGenerationError("provider_temporarily_unavailable") from None
