from django.test import TestCase
from unittest.mock import patch

from apps.merchant_application.models import MerchantApplicationPhotos
from apps.merchant_application.services.photo_service import PhotoService
from apps.merchant_application.tests.test_services import (
    MerchantApplicationServiceMixin,
)


class PhotoServiceTests(MerchantApplicationServiceMixin, TestCase):
    def test_save_photos_creates_storefront_photos_and_marks_step_complete(self):
        application, _ = self._create_identity()
        self._create_location(application)
        self._create_hours(application)

        storefront_file = self._storefront_file()

        with patch(
            "apps.merchant_application.services.photo_service.CloudinaryService.upload_image"
        ) as mock_upload:
            mock_upload.return_value = {
                "secure_url": "https://cloudinary.com/storefront.jpg",
                "public_id": "merchant_application_photos/storefront",
            }

            photos = PhotoService.save_photos(
                application,
                {
                    "storefront": [storefront_file],
                },
            )

        application.refresh_from_db()

        self.assertEqual(
            photos.count(),
            1,
        )

        self.assertEqual(
            photos.first().MPHT_CATEGORY,
            MerchantApplicationPhotos.PhotoCategory.STOREFRONT,
        )

        self.assertEqual(
            application.MAPP_HIGHEST_COMPLETED_STEP,
            4,
        )

        mock_upload.assert_called_once_with(
            file=storefront_file,
            folder="merchant_application_photos",
        )

    def test_save_photos_rejects_storefront_counts_over_the_limit(self):
        application, _ = self._create_identity()
        self._create_location(application)
        self._create_hours(application)

        MerchantApplicationPhotos.objects.bulk_create(
            [
                MerchantApplicationPhotos(
                    MAPP_ID=application,
                    MPHT_CATEGORY=MerchantApplicationPhotos.PhotoCategory.STOREFRONT,
                    MPHT_PHOTO_URL=f"https://example.com/storefront-{index}.jpg",
                    MPHT_PHOTO_PUBLIC_ID=f"storefront-{index}",
                    MPHT_FILE_NAME=f"storefront-{index}.jpg",
                )
                for index in range(3)
            ]
        )

        with patch(
            "apps.merchant_application.services.photo_service.CloudinaryService.upload_image"
        ) as mock_upload, self.assertRaises(ValueError):
            PhotoService.save_photos(
                application,
                {
                    "storefront": [self._storefront_file("extra.jpg")],
                },
            )

        mock_upload.assert_not_called()