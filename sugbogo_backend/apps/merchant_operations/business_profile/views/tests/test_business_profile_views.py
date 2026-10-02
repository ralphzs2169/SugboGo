from io import BytesIO
from unittest.mock import patch

from apps.business.models import Business, Category, Cluster, Location
from apps.users.models import User
from django.contrib.gis.geos import Point
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from PIL import Image
from rest_framework.test import APIClient

from apps.merchant_operations.business_profile.throttles import (
    BusinessCoverPhotoThrottle,
)


class BusinessCoverPhotoViewTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

        self.merchant = User.objects.create_user(
            email="merchant@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.explorer = User.objects.create_user(
            email="explorer@example.com",
            password="StrongPassword123!",
            USER_FNAME="Explorer",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        cluster = Cluster.objects.create(
            CLUS_NAME="Food and Dining",
            CLUS_DESCRIPTION="Food businesses",
        )

        category = Category.objects.create(
            CTGRY_NAME="Restaurants",
            CTGRY_DESCRIPTION="Places that serve meals",
            CLUS_ID=cluster,
        )

        location = Location.objects.create(
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

        self.business = Business.objects.create(
            BUSN_NAME="Sugbo Bistro",
            BUSN_DESCRIPTION="A Cebu-based local restaurant.",
            USER_ID=self.merchant,
            CTGRY_ID=category,
            LOCT_ID=location,
        )

        self.url = "/api/merchant/business-profile/cover-photo/"

    def _cover_photo(self):
        image = Image.new(
            "RGB",
            (100, 100),
        )

        image_bytes = BytesIO()

        image.save(
            image_bytes,
            format="JPEG",
        )

        image_bytes.seek(0)

        return SimpleUploadedFile(
            "cover.jpg",
            image_bytes.read(),
            content_type="image/jpeg",
        )

    def test_unauthenticated_user_cannot_update_cover_photo(self):
        response = self.client.patch(
            self.url,
            {
                "cover_photo": self._cover_photo(),
            },
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            401,
        )

    def test_explorer_cannot_update_cover_photo(self):
        self.client.force_authenticate(
            user=self.explorer,
        )

        response = self.client.patch(
            self.url,
            {
                "cover_photo": self._cover_photo(),
            },
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            403,
        )

    @patch(
        "apps.merchant_operations.business_profile.views.business_profile_views.BusinessProfileService.update_cover_photo"
    )
    @patch(
        "apps.merchant_operations.business_profile.views.business_profile_views.BusinessProfileService.get_business_for_merchant"
    )
    def test_merchant_can_update_cover_photo(
        self,
        mock_get_business,
        mock_update_cover_photo,
    ):
        self.client.force_authenticate(
            user=self.merchant,
        )

        mock_get_business.return_value = self.business
        mock_update_cover_photo.return_value = self.business

        response = self.client.patch(
            self.url,
            {
                "cover_photo": self._cover_photo(),
            },
            format="multipart",
        )


        self.assertEqual(
            response.status_code,
            200,
        )

        self.assertEqual(
            response.data["message"],
            "Business cover photo updated successfully.",
        )

        mock_get_business.assert_called_once_with(
            self.merchant,
        )

        mock_update_cover_photo.assert_called_once()

    def test_cover_photo_is_required(self):
        self.client.force_authenticate(
            user=self.merchant,
        )

        response = self.client.patch(
            self.url,
            {},
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            400,
        )

    def test_invalid_cover_photo_is_rejected(self):
        self.client.force_authenticate(
            user=self.merchant,
        )

        response = self.client.patch(
            self.url,
            {
                "cover_photo": SimpleUploadedFile(
                    "document.txt",
                    b"not-an-image",
                    content_type="text/plain",
                ),
            },
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            400,
        )


    def test_merchant_is_throttled_after_exceeding_cover_photo_limit(self):
        self.client.force_authenticate(
            user=self.merchant,
        )

        fixed_time = 1_700_000_000.0

        with patch.object(
            BusinessCoverPhotoThrottle,
            "timer",
            return_value=fixed_time,
        ) as mock_timer, patch(
            "apps.merchant_operations.business_profile.views.business_profile_views.BusinessProfileService.get_business_for_merchant",
        ) as mock_get_business, patch(
            "apps.merchant_operations.business_profile.views.business_profile_views.BusinessProfileService.update_cover_photo",
        ) as mock_update_cover_photo:
            mock_get_business.return_value = self.business
            mock_update_cover_photo.return_value = self.business

            profile_url = "/api/merchant/business-profile/"
            initial = self.client.get(profile_url)
            initial_allowance = initial.data["data"]["cover_photo_update"]
            self.assertEqual(initial_allowance["limit"], 3)
            self.assertEqual(initial_allowance["remaining"], 3)
            self.assertIsNone(initial_allowance["resets_at"])

            for index, expected_remaining in enumerate((2, 1, 0)):
                mock_timer.return_value = fixed_time + index * 60
                response = self.client.patch(
                    self.url,
                    {"cover_photo": self._cover_photo()},
                    format="multipart",
                )

                self.assertEqual(response.status_code, 200)
                allowance = response.data["data"]["cover_photo_update"]
                self.assertEqual(allowance["limit"], 3)
                self.assertEqual(allowance["remaining"], expected_remaining)
                self.assertEqual(
                    allowance["resets_at"].timestamp(),
                    fixed_time + 86400,
                )

                profile = self.client.get(profile_url)
                self.assertEqual(
                    profile.data["data"]["cover_photo_update"],
                    allowance,
                )

            rejected = self.client.patch(
                self.url,
                {"cover_photo": self._cover_photo()},
                format="multipart",
            )

            self.assertEqual(rejected.status_code, 429)
            self.assertEqual(rejected.data["code"], "RATE_LIMIT_EXCEEDED")
            self.assertEqual(rejected.data["errors"]["retry_after"], 86280)

            mock_timer.return_value = fixed_time + 86401
            renewed = self.client.get(profile_url)
            self.assertEqual(
                renewed.data["data"]["cover_photo_update"]["remaining"],
                1,
            )
            next_update = self.client.patch(
                self.url,
                {"cover_photo": self._cover_photo()},
                format="multipart",
            )

        self.assertEqual(next_update.status_code, 200)
        next_reset = next_update.data["data"]["cover_photo_update"][
            "resets_at"
        ]
        self.assertEqual(
            next_reset.timestamp(),
            fixed_time + 60 + 86400,
        )
        self.assertEqual(mock_update_cover_photo.call_count, 4)

    def test_other_merchant_cannot_update_owned_business(self):
        other_merchant = User.objects.create_user(
            email="other-merchant@example.com",
            password="StrongPassword123!",
            USER_FNAME="Other",
            USER_LNAME="Merchant",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.client.force_authenticate(user=other_merchant)

        response = self.client.patch(
            self.url,
            {"cover_photo": self._cover_photo()},
            format="multipart",
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(
            response.data["message"],
            "Your business could not be found.",
        )
        self.business.refresh_from_db()
        self.assertIsNone(self.business.BUSN_COVER_PHOTO_URL)
