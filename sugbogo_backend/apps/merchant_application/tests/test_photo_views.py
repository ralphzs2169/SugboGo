from pathlib import Path
from unittest.mock import patch

from apps.merchant_application.models import MerchantApplicationPhotos
from apps.merchant_application.tests.test_services import (
    MerchantApplicationServiceMixin,
)
from core.tests.assertions import APIResponseAssertionsMixin
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework.test import APITestCase


class PhotoViewTests(
    MerchantApplicationServiceMixin,
    APIResponseAssertionsMixin,
    APITestCase,
):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.user)
        self.url = reverse("application-photos")
        logo_path = (
            Path(__file__).resolve().parents[4]
            / "sugbogo_frontend"
            / "web_app"
            / "public"
            / "sugbogo-logo.png"
        )
        self.photo_file = SimpleUploadedFile(
            "storefront.png",
            logo_path.read_bytes(),
            content_type="image/png",
        )

    def test_photo_save_returns_not_found_when_step_one_is_missing(self):
        response = self.client.patch(
            self.url,
            {"storefront": [self.photo_file]},
            format="multipart",
        )

        self.assertErrorResponse(
            response,
            message="Complete Step 1 (Business Identity) before saving photos.",
            code="APPLICATION_NOT_FOUND",
            status_code=404,
        )

    def test_photo_save_creates_storefront_photo(self):
        application, _ = self._create_identity()
        self._create_location(application)
        self._create_hours(application)

        with patch(
            "apps.merchant_application.services.photo_service.CloudinaryService.upload_image"
        ) as mock_upload:
            mock_upload.return_value = {
                "secure_url": "https://cloudinary.com/storefront.jpg",
                "public_id": "merchant_application_photos/storefront",
            }

            response = self.client.patch(
                self.url,
                {"storefront": [self.photo_file]},
                format="multipart",
            )

        self.assertSuccessResponse(
            response,
            message="Business photos saved successfully.",
        )

        self.assertEqual(
            response.data["data"][0]["category"],
            MerchantApplicationPhotos.PhotoCategory.STOREFRONT,
        )

        self.assertEqual(
            MerchantApplicationPhotos.objects.count(),
            1,
        )

        mock_upload.assert_called_once()


    def test_photo_save_returns_bad_request_for_invalid_photo_operation(self):
        application, _ = self._create_identity()
        self._create_location(application)
        self._create_hours(application)

        with patch(
            "apps.merchant_application.services.photo_service.PhotoService.save_photos"
        ) as mock_save:
            mock_save.side_effect = ValueError(
                "You can only have up to 3 storefront photos."
            )

            response = self.client.patch(
                self.url,
                {"storefront": [self.photo_file]},
                format="multipart",
            )

        self.assertErrorResponse(
            response,
            message="You can only have up to 3 storefront photos.",
            code="INVALID_PHOTO_OPERATION",
            status_code=400,
        )