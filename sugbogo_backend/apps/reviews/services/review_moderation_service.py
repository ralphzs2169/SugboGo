"""OpenAI moderation with a narrow local Cebuano threat fallback."""

import base64
import logging
import math
from urllib.parse import urlsplit

from django.conf import settings
from django.utils import timezone
from openai import OpenAI

from apps.reviews.services.review_cebuano_safety_fallback import (
    ReviewCebuanoSafetyFallback,
)


logger = logging.getLogger(__name__)


class ReviewModerationService:
    """Returns a publication decision with findings for each submitted input."""

    @staticmethod
    def _as_mapping(value):
        """Read SDK result objects while retaining provider category names."""
        if isinstance(value, dict):
            return value
        if hasattr(value, "model_dump"):
            return value.model_dump(by_alias=True)
        raise ValueError("Invalid moderation result mapping.")

    @staticmethod
    def _normalize_finding(
        response,
        source: str,
        photo_index=None,
    ) -> dict:
        """Validate and normalize a single-input moderation response."""
        results = getattr(response, "results", None)
        if not isinstance(results, list) or len(results) != 1:
            raise ValueError("Moderation returned an unexpected result count.")

        result = results[0]
        if type(getattr(result, "flagged", None)) is not bool:
            raise ValueError("Moderation omitted its flagged decision.")

        categories = ReviewModerationService._as_mapping(
            getattr(result, "categories", None),
        )
        scores = ReviewModerationService._as_mapping(
            getattr(result, "category_scores", None),
        )
        raw_input_types = getattr(result, "category_applied_input_types", None)
        if raw_input_types is None:
            input_types = {}
        else:
            input_types = ReviewModerationService._as_mapping(raw_input_types)
        if (
            not categories
            or any(type(value) is not bool for value in categories.values())
            or set(categories) != set(scores)
            or any(
                type(value) not in (int, float)
                or not math.isfinite(value)
                or value < 0
                or value > 1
                for value in scores.values()
            )
            or any(
                not isinstance(value, list)
                or any(not isinstance(item, str) for item in value)
                for value in input_types.values()
            )
        ):
            raise ValueError("Moderation returned invalid category data.")

        request_id = getattr(response, "id", None)
        result_model = getattr(response, "model", None)
        if request_id is not None and not isinstance(request_id, str):
            raise ValueError("Moderation returned an invalid request ID.")
        if not isinstance(result_model, str) or not result_model:
            raise ValueError("Moderation returned an invalid model.")

        return {
            "source": source,
            "photo_index": photo_index,
            "flagged": result.flagged,
            "model": result_model,
            "request_id": request_id,
            "categories": categories,
            "category_scores": scores,
            "category_applied_input_types": input_types,
        }

    @staticmethod
    def _image_input(photo) -> dict:
        """Encode an uploaded image without consuming it for Cloudinary."""
        try:
            photo.seek(0)
            contents = photo.read()
        finally:
            photo.seek(0)

        if not contents:
            raise ValueError("The review image is empty.")

        content_type = getattr(photo, "content_type", "image/jpeg")
        if (
            not isinstance(content_type, str)
            or not content_type.startswith("image/")
        ):
            raise ValueError("The review image content type is invalid.")

        encoded = base64.b64encode(contents).decode("ascii")
        return {
            "type": "image_url",
            "image_url": {
                "url": f"data:{content_type};base64,{encoded}",
            },
        }

    @staticmethod
    def _stored_image_input(image_url: str) -> dict:
        """Supply a persisted public Cloudinary image for retry moderation."""
        parsed_url = urlsplit(image_url)
        if (
            parsed_url.scheme != "https"
            or not parsed_url.hostname
            or parsed_url.username
            or parsed_url.password
        ):
            raise ValueError("The stored review image URL is invalid.")

        return {
            "type": "image_url",
            "image_url": {
                "url": image_url,
            },
        }

    @staticmethod
    def moderate(
        text: str,
        photos: list | None = None,
        image_urls: list[str] | None = None,
    ) -> dict:
        """Moderate text and every image independently for photo attribution."""
        model = settings.OPENAI_MODERATION_MODEL
        checked_at = timezone.now().isoformat()
        findings = []
        local_finding = ReviewCebuanoSafetyFallback.finding(text)
        if local_finding is not None:
            findings.append(local_finding)
        image_count = len(photos or []) + len(image_urls or [])

        if not settings.OPENAI_API_KEY:
            logger.warning("Review moderation configuration is missing.")
            return {
                "outcome": "provider_failure",
                "model": model,
                "checked_at": checked_at,
                "failure_type": "MissingAPIKey",
                "image_count": image_count,
                "findings": findings,
            }

        try:
            client = OpenAI(
                api_key=settings.OPENAI_API_KEY,
                timeout=10.0,
                max_retries=0,
            )
            inputs = [
                (
                    "text",
                    None,
                    {"type": "text", "text": text},
                ),
            ]
            for index, photo in enumerate(photos or []):
                inputs.append(
                    (
                        "image",
                        index,
                        ReviewModerationService._image_input(photo),
                    ),
                )
            for index, image_url in enumerate(image_urls or []):
                inputs.append(
                    (
                        "image",
                        len(photos or []) + index,
                        ReviewModerationService._stored_image_input(image_url),
                    ),
                )

            for source, photo_index, provider_input in inputs:
                logger.info(
                    "Review moderation requested.",
                    extra={
                        "source": source,
                        "photo_index": photo_index,
                    },
                )
                response = client.moderations.create(
                    model=model,
                    input=[provider_input],
                )
                findings.append(
                    ReviewModerationService._normalize_finding(
                        response,
                        source=source,
                        photo_index=photo_index,
                    ),
                )
        except Exception as exc:
            if any(
                finding["flagged"]
                for finding in findings
                if finding["source"] in ("text", "image")
            ):
                outcome = "flagged"
            else:
                outcome = "provider_failure"
            logger.warning(
                "Review moderation could not be completed.",
                extra={
                    "error_type": type(exc).__name__,
                    "outcome": outcome,
                },
            )
            return {
                "outcome": outcome,
                "model": model,
                "checked_at": checked_at,
                "failure_type": type(exc).__name__,
                "image_count": image_count,
                "findings": findings,
                "incomplete": True,
            }

        if any(item["flagged"] for item in findings):
            outcome = "flagged"
        else:
            outcome = "safe"
        logger.info(
            "Review moderation completed.",
            extra={"outcome": outcome, "image_count": image_count},
        )
        return {
            "outcome": outcome,
            "model": model,
            "checked_at": checked_at,
            "failure_type": None,
            "image_count": image_count,
            "findings": findings,
        }
