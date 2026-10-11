from types import SimpleNamespace
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, override_settings

from apps.reviews.services.review_moderation_service import (
    ReviewModerationService,
)


def provider_response(flagged=False, request_id="modr-test"):
    """Build a minimal SDK-shaped moderation response."""
    result = SimpleNamespace(
        flagged=flagged,
        categories={"violence": flagged},
        category_scores={"violence": 0.9 if flagged else 0.01},
        category_applied_input_types={"violence": ["text", "image"]},
    )
    return SimpleNamespace(
        id=request_id,
        model="omni-moderation-latest",
        results=[result],
    )


def uploaded_image(name: str, contents: bytes) -> SimpleUploadedFile:
    """Provide a small image-shaped upload for data URL assertions."""
    return SimpleUploadedFile(
        name,
        contents,
        content_type="image/jpeg",
    )


@override_settings(
    OPENAI_API_KEY="test-key",
    OPENAI_MODERATION_MODEL="omni-moderation-latest",
)
class ReviewModerationServiceTests(SimpleTestCase):
    @patch("apps.reviews.services.review_moderation_service.OpenAI")
    def test_safe_text(self, openai_client):
        openai_client.return_value.moderations.create.return_value = (
            provider_response()
        )
        result = ReviewModerationService.moderate("Friendly service.")
        self.assertEqual(result["outcome"], "safe")
        self.assertEqual(result["findings"][0]["source"], "text")
        self.assertEqual(result["findings"][0]["request_id"], "modr-test")

    @patch("apps.reviews.services.review_moderation_service.OpenAI")
    def test_flagged_text(self, openai_client):
        openai_client.return_value.moderations.create.return_value = (
            provider_response(flagged=True)
        )
        result = ReviewModerationService.moderate("Unsafe test content.")
        self.assertEqual(result["outcome"], "flagged")
        self.assertTrue(result["findings"][0]["categories"]["violence"])

    @patch("apps.reviews.services.review_moderation_service.OpenAI")
    def test_safe_text_and_all_safe_images(self, openai_client):
        create = openai_client.return_value.moderations.create
        create.side_effect = [
            provider_response(request_id="text"),
            provider_response(request_id="photo-1"),
            provider_response(request_id="photo-2"),
        ]
        first = uploaded_image("first.jpg", b"first-image")
        second = uploaded_image("second.jpg", b"second-image")
        result = ReviewModerationService.moderate(
            "Friendly service.",
            [first, second],
        )
        self.assertEqual(result["outcome"], "safe")
        self.assertEqual(create.call_count, 3)
        self.assertEqual(
            [finding["source"] for finding in result["findings"]],
            ["text", "image", "image"],
        )
        self.assertEqual(first.tell(), 0)
        self.assertEqual(second.tell(), 0)

    @patch("apps.reviews.services.review_moderation_service.OpenAI")
    def test_one_flagged_image_does_not_skip_remaining_images(self, openai_client):
        create = openai_client.return_value.moderations.create
        create.side_effect = [
            provider_response(request_id="text"),
            provider_response(request_id="photo-1"),
            provider_response(flagged=True, request_id="photo-2"),
            provider_response(request_id="photo-3"),
        ]
        photos = [
            uploaded_image(f"photo-{index}.jpg", bytes([index]))
            for index in range(1, 4)
        ]
        result = ReviewModerationService.moderate("Friendly service.", photos)
        self.assertEqual(result["outcome"], "flagged")
        self.assertEqual(create.call_count, 4)
        self.assertEqual(
            [finding["photo_index"] for finding in result["findings"][1:]],
            [0, 1, 2],
        )
        self.assertTrue(result["findings"][2]["flagged"])
        image_urls = [
            call.kwargs["input"][0]["image_url"]["url"]
            for call in create.call_args_list[1:]
        ]
        self.assertEqual(len(set(image_urls)), 3)
        self.assertTrue(all(url.startswith("data:image/jpeg;base64,") for url in image_urls))

    @patch("apps.reviews.services.review_moderation_service.OpenAI")
    def test_provider_failure_is_a_hold(self, openai_client):
        openai_client.return_value.moderations.create.side_effect = TimeoutError()
        result = ReviewModerationService.moderate("Friendly service.")
        self.assertEqual(result["outcome"], "provider_failure")
        self.assertEqual(result["failure_type"], "TimeoutError")

    @patch("apps.reviews.services.review_moderation_service.OpenAI")
    def test_malformed_provider_result_is_a_hold(self, openai_client):
        response = provider_response()
        response.results = []
        openai_client.return_value.moderations.create.return_value = response
        result = ReviewModerationService.moderate("Friendly service.")
        self.assertEqual(result["outcome"], "provider_failure")
        self.assertEqual(result["failure_type"], "ValueError")

    @override_settings(OPENAI_API_KEY="")
    @patch("apps.reviews.services.review_moderation_service.OpenAI")
    def test_missing_key_is_a_hold_without_a_provider_call(self, openai_client):
        result = ReviewModerationService.moderate("Friendly service.")
        self.assertEqual(result["outcome"], "provider_failure")
        self.assertEqual(result["failure_type"], "MissingAPIKey")
        openai_client.assert_not_called()
