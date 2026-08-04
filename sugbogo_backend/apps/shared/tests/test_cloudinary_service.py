from unittest.mock import Mock, patch

import cloudinary.exceptions
from django.test import SimpleTestCase

from apps.shared.services.cloudinary_service import CloudinaryService


class CloudinaryServiceTests(SimpleTestCase):
    """Tests for the Cloudinary service."""

    @patch("apps.shared.services.cloudinary_service.cloudinary.uploader.upload")
    def test_upload_image_returns_cloudinary_response(
        self,
        mock_upload,
    ):
        file = Mock()
        expected_response = {
            "public_id": "merchant/image",
            "secure_url": "https://example.com/image.jpg",
        }

        mock_upload.return_value = expected_response

        result = CloudinaryService.upload_image(
            file,
            "merchant/images",
        )

        self.assertEqual(
            result,
            expected_response,
        )

        mock_upload.assert_called_once_with(
            file,
            folder="merchant/images",
        )

    def test_delete_image_returns_none_when_public_id_is_empty(self):
        with patch(
            "apps.shared.services.cloudinary_service.cloudinary.uploader.destroy"
        ) as mock_destroy:
            result = CloudinaryService.delete_image("")

        self.assertIsNone(result)
        mock_destroy.assert_not_called()

    @patch("apps.shared.services.cloudinary_service.cloudinary.uploader.destroy")
    def test_delete_image_returns_cloudinary_response(
        self,
        mock_destroy,
    ):
        expected_response = {
            "result": "ok",
        }

        mock_destroy.return_value = expected_response

        result = CloudinaryService.delete_image(
            "merchant/image",
        )

        self.assertEqual(
            result,
            expected_response,
        )

        mock_destroy.assert_called_once_with(
            "merchant/image",
        )

    @patch("apps.shared.services.cloudinary_service.cloudinary.uploader.destroy")
    def test_delete_image_returns_none_and_logs_when_deletion_fails(
        self,
        mock_destroy,
    ):
        mock_destroy.side_effect = cloudinary.exceptions.Error(
            "Cloudinary unavailable"
        )

        with self.assertLogs(
            "apps.shared.services.cloudinary_service",
            level="ERROR",
        ) as logs:
            result = CloudinaryService.delete_image(
                "merchant/image",
            )

        self.assertIsNone(result)

        mock_destroy.assert_called_once_with(
            "merchant/image",
        )

        self.assertTrue(
            any(
                "Failed to delete Cloudinary image." in message
                for message in logs.output
            )
        )

    @patch("apps.shared.services.cloudinary_service.cloudinary.uploader.upload")
    def test_upload_image_propagates_cloudinary_error(
        self,
        mock_upload,
    ):
        mock_upload.side_effect = cloudinary.exceptions.Error(
            "Cloudinary unavailable"
        )

        file = Mock()

        with self.assertRaises(cloudinary.exceptions.Error):
            CloudinaryService.upload_image(
                file,
                "merchant/images",
            )

        mock_upload.assert_called_once_with(
            file,
            folder="merchant/images",
        )