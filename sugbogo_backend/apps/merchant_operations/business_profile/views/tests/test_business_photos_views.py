from io import BytesIO
from unittest.mock import patch

from apps.business.models import Business, BusinessPhoto, Category, Cluster, Location
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationPhotos,
)
from apps.users.models import User
from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from PIL import Image
from rest_framework.test import APIClient


class BusinessPhotosViewTests(TestCase):
    url = "/api/merchant/business-profile/photos/"

    def setUp(self):
        self.client = APIClient()
        self.merchant = self._user("merchant@example.com", User.UserRole.MERCHANT)
        self.other_merchant = self._user(
            "other-merchant@example.com",
            User.UserRole.MERCHANT,
        )
        self.explorer = self._user("explorer@example.com", User.UserRole.EXPLORER)

        cluster = Cluster.objects.create(
            CLUS_NAME="Food",
            CLUS_DESCRIPTION="Food businesses",
        )
        category = Category.objects.create(
            CTGRY_NAME="Restaurants",
            CTGRY_DESCRIPTION="Places that serve meals",
            CLUS_ID=cluster,
        )
        location = Location.objects.create(
            LOCT_POINT=Point(123.8854, 10.3157, srid=4326),
            LOCT_ADDRESS="Lahug, Cebu City",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        self.business = Business.objects.create(
            BUSN_NAME="Sugbo Bistro",
            BUSN_DESCRIPTION="A local restaurant.",
            USER_ID=self.merchant,
            CTGRY_ID=category,
            LOCT_ID=location,
        )
        self.other_business = Business.objects.create(
            BUSN_NAME="Other Bistro",
            BUSN_DESCRIPTION="Another local restaurant.",
            USER_ID=self.other_merchant,
            CTGRY_ID=category,
            LOCT_ID=location,
        )
        self.storefront = self._photo(
            self.business,
            BusinessPhoto.PhotoCategory.STOREFRONT,
            "original-storefront",
        )
        self.client.force_authenticate(user=self.merchant)

    def _user(self, email, role):
        return User.objects.create_user(
            email=email,
            password="StrongPassword123!",
            USER_FNAME="Photo",
            USER_LNAME="Tester",
            USER_ROLE=role,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

    def _photo(self, business, category, public_id):
        return BusinessPhoto.objects.create(
            BUSN_ID=business,
            BPHO_CATEGORY=category,
            BPHO_PHOTO_URL=f"https://example.com/{public_id}.jpg",
            BPHO_PHOTO_PUBLIC_ID=public_id,
            BPHO_FILE_NAME=f"{public_id}.jpg",
        )

    def _image(self, name="new.jpg", image_format="JPEG", padding=0):
        image = Image.new("RGB", (24, 24))
        stream = BytesIO()
        image.save(stream, format=image_format)
        content = stream.getvalue() + (b" " * padding)

        return SimpleUploadedFile(
            name,
            content,
            content_type="image/png" if image_format == "PNG" else "image/jpeg",
        )

    def _upload_result(self, public_id):
        return {
            "public_id": public_id,
            "secure_url": f"https://example.com/{public_id}.jpg",
        }

    @patch(
        "apps.merchant_operations.business_profile.services.business_photo_service."
        "CloudinaryService.upload_image"
    )
    def test_adds_storefront_below_maximum_to_business_only(self, upload):
        upload.return_value = self._upload_result("new-storefront")
        application = MerchantApplication.objects.create(
            USER_ID=self.merchant,
            MAPP_STATUS=MerchantApplication.ApplicationStatus.APPROVED,
            BUSN_ID=self.business,
        )

        response = self.client.patch(
            self.url,
            {"storefront": [self._image()]},
            format="multipart",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["data"]), 2)
        self.assertEqual(response.data["data"][1]["category"], "storefront")
        self.assertNotIn("public_id", response.data["data"][1])
        self.assertEqual(BusinessPhoto.objects.filter(BUSN_ID=self.business).count(), 2)
        self.assertFalse(
            MerchantApplicationPhotos.objects.filter(MAPP_ID=application).exists()
        )
        upload.assert_called_once()

    @patch(
        "apps.merchant_operations.business_profile.services.business_photo_service."
        "CloudinaryService.upload_image"
    )
    def test_adds_optional_categories(self, upload):
        upload.side_effect = [
            self._upload_result("interior"),
            self._upload_result("products"),
            self._upload_result("additional"),
        ]

        response = self.client.patch(
            self.url,
            {
                "interior": [self._image("interior.jpg")],
                "products": [self._image("products.jpg")],
                "additional": [self._image("additional.jpg")],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            set(BusinessPhoto.objects.values_list("BPHO_CATEGORY", flat=True)),
            {"storefront", "interior", "products", "additional"},
        )

    @patch(
        "apps.merchant_operations.business_profile.services.business_photo_service."
        "CloudinaryService.upload_image"
    )
    def test_final_category_maximum_rejects_without_upload(self, upload):
        self._photo(self.business, "storefront", "second")
        self._photo(self.business, "storefront", "third")

        response = self.client.patch(
            self.url,
            {"storefront": [self._image()]},
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(BusinessPhoto.objects.filter(BUSN_ID=self.business).count(), 3)
        upload.assert_not_called()

    def test_rejects_unsupported_image_format(self):
        response = self.client.patch(
            self.url,
            {"interior": [self._image("photo.gif", "GIF")]},
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(BusinessPhoto.objects.filter(BUSN_ID=self.business).count(), 1)

    def test_rejects_file_over_ten_megabytes(self):
        response = self.client.patch(
            self.url,
            {"interior": [self._image(padding=10 * 1024 * 1024)]},
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(BusinessPhoto.objects.filter(BUSN_ID=self.business).count(), 1)

    @patch(
        "apps.merchant_operations.business_profile.services.business_photo_service."
        "CloudinaryService.delete_image"
    )
    def test_removing_shared_photo_preserves_application_asset(self, delete_image):
        replacement = self._photo(self.business, "storefront", "replacement")
        application = MerchantApplication.objects.create(
            USER_ID=self.merchant,
            MAPP_STATUS=MerchantApplication.ApplicationStatus.APPROVED,
            BUSN_ID=self.business,
        )
        evidence = MerchantApplicationPhotos.objects.create(
            MAPP_ID=application,
            MPHT_CATEGORY="storefront",
            MPHT_PHOTO_URL=self.storefront.BPHO_PHOTO_URL,
            MPHT_PHOTO_PUBLIC_ID=self.storefront.BPHO_PHOTO_PUBLIC_ID,
        )

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                self.url,
                {"deleted_photo_ids": [self.storefront.BPHO_ID]},
                format="multipart",
            )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(BusinessPhoto.objects.filter(pk=self.storefront.pk).exists())
        self.assertTrue(BusinessPhoto.objects.filter(pk=replacement.pk).exists())
        self.assertTrue(
            MerchantApplicationPhotos.objects.filter(pk=evidence.pk).exists()
        )
        delete_image.assert_not_called()

    @patch(
        "apps.merchant_operations.business_profile.services.business_photo_service."
        "CloudinaryService.delete_image"
    )
    def test_business_only_photo_deletes_asset_after_commit(self, delete_image):
        optional = self._photo(self.business, "interior", "business-only")

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                self.url,
                {"deleted_photo_ids": [optional.BPHO_ID]},
                format="multipart",
            )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(BusinessPhoto.objects.filter(pk=optional.pk).exists())
        delete_image.assert_called_once_with("business-only")

    def test_final_storefront_cannot_be_removed(self):
        response = self.client.patch(
            self.url,
            {"deleted_photo_ids": [self.storefront.BPHO_ID]},
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertTrue(BusinessPhoto.objects.filter(pk=self.storefront.pk).exists())

    def test_foreign_and_missing_photo_ids_are_rejected(self):
        foreign = self._photo(self.other_business, "interior", "foreign")

        for photo_id in (foreign.BPHO_ID, 999999):
            with self.subTest(photo_id=photo_id):
                response = self.client.patch(
                    self.url,
                    {"deleted_photo_ids": [photo_id]},
                    format="multipart",
                )
                self.assertEqual(response.status_code, 400)

        self.assertTrue(BusinessPhoto.objects.filter(pk=foreign.pk).exists())

    def test_duplicate_deletion_ids_are_rejected(self):
        response = self.client.patch(
            self.url,
            {"deleted_photo_ids": [self.storefront.pk, self.storefront.pk]},
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)

    def test_optional_category_can_be_cleared(self):
        optional = self._photo(self.business, "products", "old-products")

        response = self.client.patch(
            self.url,
            {"deleted_photo_ids": [optional.BPHO_ID]},
            format="multipart",
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(BusinessPhoto.objects.filter(pk=optional.pk).exists())

    @patch(
        "apps.merchant_operations.business_profile.services.business_photo_service."
        "BusinessPhoto.objects.create"
    )
    @patch(
        "apps.merchant_operations.business_profile.services.business_photo_service."
        "CloudinaryService.delete_image"
    )
    @patch(
        "apps.merchant_operations.business_profile.services.business_photo_service."
        "CloudinaryService.upload_image"
    )
    def test_failed_persistence_cleans_new_asset_and_keeps_old_photo(
        self,
        upload,
        delete_image,
        create_photo,
    ):
        upload.return_value = self._upload_result("new-asset")
        create_photo.side_effect = RuntimeError("Database write failed")

        with self.assertRaises(RuntimeError):
            self.client.patch(
                self.url,
                {
                    "storefront": [self._image()],
                    "deleted_photo_ids": [self.storefront.BPHO_ID],
                },
                format="multipart",
            )

        self.assertTrue(BusinessPhoto.objects.filter(pk=self.storefront.pk).exists())
        delete_image.assert_called_once_with("new-asset")

    @patch(
        "apps.merchant_operations.business_profile.services.business_photo_service."
        "CloudinaryService.upload_image"
    )
    def test_invalid_final_count_changes_nothing(self, upload):
        response = self.client.patch(
            self.url,
            {"deleted_photo_ids": [self.storefront.BPHO_ID]},
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertTrue(BusinessPhoto.objects.filter(pk=self.storefront.pk).exists())
        upload.assert_not_called()

    @patch(
        "apps.merchant_operations.business_profile.services.business_photo_service."
        "CloudinaryService.upload_image"
    )
    def test_replacement_is_one_final_state(self, upload):
        upload.return_value = self._upload_result("replacement")

        response = self.client.patch(
            self.url,
            {
                "storefront": [self._image("replacement.jpg")],
                "deleted_photo_ids": [self.storefront.BPHO_ID],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(BusinessPhoto.objects.filter(BUSN_ID=self.business).count(), 1)
        self.assertEqual(
            response.data["data"][0]["url"],
            "https://example.com/replacement.jpg",
        )

    def test_suspended_business_cannot_mutate(self):
        self.business.BUSN_STATUS = Business.BusinessStatus.SUSPENDED
        self.business.save(update_fields=["BUSN_STATUS"])

        response = self.client.patch(self.url, {}, format="multipart")

        self.assertEqual(response.status_code, 403)
        self.assertTrue(BusinessPhoto.objects.filter(pk=self.storefront.pk).exists())

    def test_authentication_role_and_owned_business_are_enforced(self):
        self.client.force_authenticate(user=None)
        self.assertIn(
            self.client.patch(self.url, {}, format="multipart").status_code,
            (401, 403),
        )

        self.client.force_authenticate(user=self.explorer)
        self.assertEqual(
            self.client.patch(self.url, {}, format="multipart").status_code,
            403,
        )

        self.client.force_authenticate(user=self.other_merchant)
        response = self.client.patch(
            self.url,
            {"deleted_photo_ids": [self.storefront.BPHO_ID]},
            format="multipart",
        )
        self.assertEqual(response.status_code, 400)

        self.other_business.delete()
        response = self.client.patch(self.url, {}, format="multipart")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data["message"], "Your business could not be found.")
