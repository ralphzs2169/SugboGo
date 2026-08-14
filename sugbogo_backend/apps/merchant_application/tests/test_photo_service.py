from django.test import TestCase
from unittest.mock import patch

from apps.merchant_application.models import MerchantApplication, MerchantApplicationPhotos
from apps.merchant_application.services.photo_service import PhotoService
from apps.merchant_application.tests.test_services import (
    MerchantApplicationServiceMixin,
)
from apps.users.models import User


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

    def test_save_photos_deletes_selected_photos(self):
        application = self._build_application_to_step_four()

        photo = MerchantApplicationPhotos.objects.get(
            MAPP_ID=application,
            MPHT_CATEGORY=MerchantApplicationPhotos.PhotoCategory.STOREFRONT,
        )

        with patch(
            "apps.merchant_application.services.photo_service.CloudinaryService.delete_image"
        ) as mock_delete:
            with self.captureOnCommitCallbacks(execute=True):
                PhotoService.save_photos(
                    application,
                    {
                        "deleted_photo_ids": [photo.MPHT_ID],
                    },
                )

        self.assertFalse(
            MerchantApplicationPhotos.objects.filter(
                MPHT_ID=photo.MPHT_ID,
            ).exists()
        )

        mock_delete.assert_called_once_with(
            photo.MPHT_PHOTO_PUBLIC_ID,
        )


    def test_save_photos_rejects_deleting_photo_from_another_application(self):
        application = self._build_application_to_step_four()

        other_user = User.objects.create_user(
            email="other-merchant@example.com",
            password="StrongPassword123!",
            USER_FNAME="Other",
            USER_LNAME="Merchant",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        other_application = MerchantApplication.objects.create(
            USER_ID=other_user,
        )

        other_photo = MerchantApplicationPhotos.objects.create(
            MAPP_ID=other_application,
            MPHT_CATEGORY=MerchantApplicationPhotos.PhotoCategory.STOREFRONT,
            MPHT_PHOTO_URL="https://example.com/other.jpg",
            MPHT_PHOTO_PUBLIC_ID="other-photo",
            MPHT_FILE_NAME="other.jpg",
        )

        with self.assertRaisesMessage(
            ValueError,
            "One or more selected photos do not belong to this application.",
        ):
            PhotoService.save_photos(
                application,
                {
                    "deleted_photo_ids": [other_photo.MPHT_ID],
                },
            )


    def test_save_photos_allows_new_photo_when_deletion_creates_room(self):
        application = self._build_application_to_step_three()

        existing_photos = MerchantApplicationPhotos.objects.bulk_create(
            [
                MerchantApplicationPhotos(
                    MAPP_ID=application,
                    MPHT_CATEGORY=(
                        MerchantApplicationPhotos.PhotoCategory.STOREFRONT
                    ),
                    MPHT_PHOTO_URL=f"https://example.com/storefront-{index}.jpg",
                    MPHT_PHOTO_PUBLIC_ID=f"storefront-{index}",
                    MPHT_FILE_NAME=f"storefront-{index}.jpg",
                )
                for index in range(3)
            ]
        )

        new_file = self._storefront_file("replacement.jpg")

        with patch(
            "apps.merchant_application.services.photo_service.CloudinaryService.upload_image"
        ) as mock_upload:
            mock_upload.return_value = {
                "secure_url": "https://cloudinary.com/replacement.jpg",
                "public_id": "storefront-replacement",
            }

            with self.captureOnCommitCallbacks(execute=True):
                photos = PhotoService.save_photos(
                    application,
                    {
                        "deleted_photo_ids": [existing_photos[0].MPHT_ID],
                        "storefront": [new_file],
                    },
                )

        self.assertEqual(
            photos.filter(
                MPHT_CATEGORY=MerchantApplicationPhotos.PhotoCategory.STOREFRONT,
            ).count(),
            3,
        )

        self.assertTrue(
            photos.filter(
                MPHT_PHOTO_PUBLIC_ID="storefront-replacement",
            ).exists()
        )

        mock_upload.assert_called_once_with(
            file=new_file,
            folder="merchant_application_photos",
        )


    def test_save_photos_cleans_up_uploaded_photos_when_later_upload_fails(self):
        application = self._build_application_to_step_three()

        first_file = self._storefront_file("first.jpg")
        second_file = self._storefront_file("second.jpg")

        with patch(
            "apps.merchant_application.services.photo_service.CloudinaryService.upload_image"
        ) as mock_upload, patch(
            "apps.merchant_application.services.photo_service.CloudinaryService.delete_image"
        ) as mock_delete:
            mock_upload.side_effect = [
                {
                    "secure_url": "https://cloudinary.com/first.jpg",
                    "public_id": "storefront-first",
                },
                RuntimeError("Cloudinary upload failed"),
            ]

            with self.assertRaises(RuntimeError):
                PhotoService.save_photos(
                    application,
                    {
                        "storefront": [
                            first_file,
                            second_file,
                        ],
                    },
                )

        mock_delete.assert_called_once_with(
            "storefront-first",
        )

        self.assertFalse(
            MerchantApplicationPhotos.objects.filter(
                MAPP_ID=application,
            ).exists()
        )