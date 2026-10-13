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
    def test_english_ai_flag_remains_primary(self, openai_client):
        openai_client.return_value.moderations.create.return_value = (
            provider_response(flagged=True)
        )
        result = ReviewModerationService.moderate(
            "I love the place but I will kill the customers.",
        )
        self.assertEqual(result["outcome"], "flagged")
        self.assertEqual(
            [finding["source"] for finding in result["findings"]],
            ["text"],
        )

    @patch("apps.reviews.services.review_moderation_service.OpenAI")
    def test_safe_ai_result_still_holds_local_cebuano_threat(self, openai_client):
        openai_client.return_value.moderations.create.return_value = (
            provider_response()
        )
        for text in (
            "Patyon nako ang mga customer.",
            "I love this place pero patyon nako ang mga customer.",
            "I love this place pero patyon gyud tika.",
            "Mopatay gyud ko nimo.",
            "Pusilon tika.",
            "Sumbagon nako siya.",
        ):
            with self.subTest(text=text):
                result = ReviewModerationService.moderate(text)
                self.assertEqual(result["outcome"], "flagged")
                self.assertEqual(result["failure_type"], None)
                self.assertEqual(
                    [finding["source"] for finding in result["findings"]],
                    ["local_cebuano_safety", "text"],
                )
                self.assertFalse(result["findings"][1]["flagged"])

    @patch("apps.reviews.services.review_moderation_service.OpenAI")
    def test_ai_and_local_findings_coexist(self, openai_client):
        openai_client.return_value.moderations.create.return_value = (
            provider_response(flagged=True)
        )
        result = ReviewModerationService.moderate(
            "Patyon nako ang mga customer.",
        )
        self.assertEqual(result["outcome"], "flagged")
        self.assertTrue(result["findings"][0]["flagged"])
        self.assertTrue(result["findings"][1]["flagged"])

    @patch("apps.reviews.services.review_moderation_service.OpenAI")
    def test_provider_failure_and_local_finding_stay_distinct(self, openai_client):
        openai_client.return_value.moderations.create.side_effect = TimeoutError()
        result = ReviewModerationService.moderate(
            "Patyon nako ang mga customer.",
        )
        self.assertEqual(result["outcome"], "provider_failure")
        self.assertEqual(result["failure_type"], "TimeoutError")
        self.assertEqual(result["findings"][0]["source"], "local_cebuano_safety")

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
    def test_retry_moderates_every_persisted_image_url(self, openai_client):
        create = openai_client.return_value.moderations.create
        create.side_effect = [
            provider_response(request_id="text"),
            provider_response(request_id="photo-1"),
            provider_response(flagged=True, request_id="photo-2"),
            provider_response(request_id="photo-3"),
        ]
        image_urls = [
            f"https://res.cloudinary.com/test/image/upload/review-{index}.jpg"
            for index in range(1, 4)
        ]
        result = ReviewModerationService.moderate(
            text="A review awaiting a provider retry.",
            image_urls=image_urls,
        )
        self.assertEqual(result["outcome"], "flagged")
        self.assertEqual(create.call_count, 4)
        self.assertEqual(
            [
                call.kwargs["input"][0]["image_url"]["url"]
                for call in create.call_args_list[1:]
            ],
            image_urls,
        )
        self.assertEqual(
            [finding["photo_index"] for finding in result["findings"][1:]],
            [0, 1, 2],
        )

    @patch("apps.reviews.services.review_moderation_service.OpenAI")
    def test_valid_flag_before_later_provider_failure_stays_flagged(
        self,
        openai_client,
    ):
        create = openai_client.return_value.moderations.create
        create.side_effect = [
            provider_response(request_id="text"),
            provider_response(flagged=True, request_id="photo-1"),
            TimeoutError(),
        ]
        result = ReviewModerationService.moderate(
            text="A review with several photos.",
            image_urls=[
                "https://res.cloudinary.com/test/image/upload/first.jpg",
                "https://res.cloudinary.com/test/image/upload/second.jpg",
            ],
        )
        self.assertEqual(result["outcome"], "flagged")
        self.assertTrue(result["incomplete"])
        self.assertEqual(result["failure_type"], "TimeoutError")
        self.assertTrue(result["findings"][1]["flagged"])

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
