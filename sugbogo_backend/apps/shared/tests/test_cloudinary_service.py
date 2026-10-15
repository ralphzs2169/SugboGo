from unittest.mock import Mock, patch

import cloudinary.exceptions
from django.test import SimpleTestCase

from apps.shared.services.cloudinary_service import CloudinaryService


class CloudinaryServiceTests(SimpleTestCase):
    """Tests for the Cloudinary service."""

    @patch("apps.shared.services.cloudinary_service.cloudinary.uploader.destroy")
    def test_destroy_asset_passes_resource_type_and_accepts_missing(
        self,
        destroy,
    ):
        for resource_type in ("image", "raw"):
            for result in ("ok", "not found"):
                with self.subTest(resource_type=resource_type, result=result):
                    destroy.reset_mock()
                    destroy.return_value = {"result": result}
                    self.assertEqual(
                        CloudinaryService.destroy_asset("asset-id", resource_type),
                        {"result": result},
                    )
                    destroy.assert_called_once_with(
                        "asset-id",
                        resource_type=resource_type,
                        type="upload",
                        timeout=15,
                    )

    @patch("apps.shared.services.cloudinary_service.cloudinary.uploader.destroy")
    def test_destroy_asset_accepts_not_found_exception(
        self,
        destroy,
    ):
        destroy.side_effect = cloudinary.exceptions.NotFound("Missing")
        self.assertEqual(
            CloudinaryService.destroy_asset("asset-id", "image"),
            {"result": "not found"},
        )

    @patch("apps.shared.services.cloudinary_service.cloudinary.uploader.destroy")
    def test_destroy_asset_rejects_unconfirmed_results(
        self,
        destroy,
    ):
        for result in (None, {}, {"result": "error"}):
            with self.subTest(result=result):
                destroy.return_value = result
                with self.assertRaises(RuntimeError):
                    CloudinaryService.destroy_asset("asset-id", "image")

    def test_destroy_asset_validates_without_weakening_legacy_helper(self):
        with self.assertRaises(ValueError):
            CloudinaryService.destroy_asset("", "image")
        with self.assertRaises(ValueError):
            CloudinaryService.destroy_asset("asset-id", "video")

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
            resource_type="image",
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
            resource_type="image",
        )
