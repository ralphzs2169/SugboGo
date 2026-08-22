from unittest.mock import patch

from apps.business.models import Business, Location
from apps.merchant_operations.business_profile.services.business_profile_service import (
    BusinessProfileService,
)
from apps.users.models import User
from django.contrib.gis.geos import Point
from django.test import TestCase
from rest_framework.exceptions import NotFound


class BusinessProfileServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="merchant@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.category = self._create_category()
        self.location = self._create_location()

        self.business = Business.objects.create(
            BUSN_NAME="Sugbo Bistro",
            BUSN_DESCRIPTION="A Cebu-based local restaurant.",
            USER_ID=self.user,
            CTGRY_ID=self.category,
            LOCT_ID=self.location,
        )

    def _create_category(self):
        from apps.business.models import Category, Cluster

        cluster = Cluster.objects.create(
            CLUS_NAME="Food and Dining",
            CLUS_DESCRIPTION="Food businesses",
        )

        return Category.objects.create(
            CTGRY_NAME="Restaurants",
            CTGRY_DESCRIPTION="Places that serve meals",
            CLUS_ID=cluster,
        )

    def _create_location(self):
        return Location.objects.create(
            LOCT_POINT=Point(
                123.8854,
                10.3157,
                srid=4326,
            ),
            LOCT_ADDRESS="Gorordo Avenue, Lahug, Cebu City",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
            LOCT_POSTAL_CODE="6000",
        )

    def test_get_business_for_merchant_returns_owned_business(self):
        business = BusinessProfileService.get_business_for_merchant(
            self.user,
        )

        self.assertEqual(
            business,
            self.business,
        )

    def test_get_business_for_merchant_raises_not_found_when_business_does_not_exist(
        self,
    ):
        self.business.delete()

        with self.assertRaisesMessage(
            NotFound,
            "Your business could not be found.",
        ):
            BusinessProfileService.get_business_for_merchant(
                self.user,
            )

    def test_update_cover_photo_uploads_and_persists_new_photo(self):
        photo = self._cover_photo()

        with patch(
            "apps.merchant_operations.business_profile.services.business_profile_service.CloudinaryService.upload_image"
        ) as mock_upload:
            mock_upload.return_value = {
                "secure_url": "https://cloudinary.com/cover.jpg",
                "public_id": "business_profile_covers/cover",
            }

            business = BusinessProfileService.update_cover_photo(
                business=self.business,
                photo=photo,
            )

        business.refresh_from_db()

        self.assertEqual(
            business.BUSN_COVER_PHOTO_URL,
            "https://cloudinary.com/cover.jpg",
        )

        self.assertEqual(
            business.BUSN_COVER_PHOTO_PUBLIC_ID,
            "business_profile_covers/cover",
        )

        mock_upload.assert_called_once_with(
            file=photo,
            folder="business_profile_covers",
        )

    def test_update_cover_photo_deletes_previous_photo_after_commit(self):
        self.business.BUSN_COVER_PHOTO_URL = (
            "https://cloudinary.com/old-cover.jpg"
        )
        self.business.BUSN_COVER_PHOTO_PUBLIC_ID = (
            "business_profile_covers/old-cover"
        )
        self.business.save(
            update_fields=[
                "BUSN_COVER_PHOTO_URL",
                "BUSN_COVER_PHOTO_PUBLIC_ID",
                "BUSN_UPDATED_AT",
            ],
        )

        photo = self._cover_photo()

        with patch(
            "apps.merchant_operations.business_profile.services.business_profile_service.CloudinaryService.upload_image"
        ) as mock_upload, patch(
            "apps.merchant_operations.business_profile.services.business_profile_service.CloudinaryService.delete_image"
        ) as mock_delete:
            mock_upload.return_value = {
                "secure_url": "https://cloudinary.com/new-cover.jpg",
                "public_id": "business_profile_covers/new-cover",
            }

            with self.captureOnCommitCallbacks(execute=True):
                BusinessProfileService.update_cover_photo(
                    business=self.business,
                    photo=photo,
                )

        mock_upload.assert_called_once_with(
            file=photo,
            folder="business_profile_covers",
        )

        mock_delete.assert_called_once_with(
            "business_profile_covers/old-cover",
        )

        self.business.refresh_from_db()

        self.assertEqual(
            self.business.BUSN_COVER_PHOTO_PUBLIC_ID,
            "business_profile_covers/new-cover",
        )

    def test_update_cover_photo_cleans_up_new_upload_when_database_update_fails(
        self,
    ):
        photo = self._cover_photo()

        with patch(
            "apps.merchant_operations.business_profile.services.business_profile_service.CloudinaryService.upload_image"
        ) as mock_upload, patch(
            "apps.merchant_operations.business_profile.services.business_profile_service.CloudinaryService.delete_image"
        ) as mock_delete, patch.object(
            Business,
            "save",
            side_effect=RuntimeError("Database update failed"),
        ):
            mock_upload.return_value = {
                "secure_url": "https://cloudinary.com/cover.jpg",
                "public_id": "business_profile_covers/cover",
            }

            with self.assertRaises(RuntimeError):
                BusinessProfileService.update_cover_photo(
                    business=self.business,
                    photo=photo,
                )

        mock_delete.assert_called_once_with(
            "business_profile_covers/cover",
        )

    def _cover_photo(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        return SimpleUploadedFile(
            "cover.jpg",
            b"cover-image-bytes",
            content_type="image/jpeg",
        )


    