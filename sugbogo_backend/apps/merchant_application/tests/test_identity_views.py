from rest_framework.test import APITestCase
from django.urls import reverse

from apps.merchant_application.tests.test_services import (
    MerchantApplicationServiceMixin,
)
from core.tests.assertions import APIResponseAssertionsMixin


class IdentityViewTests(
    MerchantApplicationServiceMixin,
    APIResponseAssertionsMixin,
    APITestCase,
):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.user)
        self.url = reverse("application-identity")
        self.valid_payload = {
            "business_name": "Sugbo Bistro",
            "business_description": "A Cebu-based local restaurant.",
            "contact_number": "09123456789",
            "business_email": "hello@sugbobistro.com",
            "website": "https://sugbobistro.example.com",
            "representative_name": "Jane Owner",
            "representative_role": "owner",
            "business_cluster_id": self.cluster.CLUS_ID,
            "business_category_id": self.category.CTGRY_ID,
            "specialty_tags": [tag.TAG_ID for tag in self.tags],
        }

    def test_identity_save_creates_application_and_identity(self):
        response = self.client.patch(
            self.url,
            self.valid_payload,
            format="json",
        )

        self.assertSuccessResponse(
            response,
            message="Business identity saved successfully.",
        )

        self.assertEqual(
            response.data["data"]["business_name"],
            "Sugbo Bistro",
        )

        self.assertTrue(
            response.data["data"]["specialty_tags"],
        )

    def test_identity_save_updates_existing_identity(self):
        self.client.patch(
            self.url,
            self.valid_payload,
            format="json",
        )

        response = self.client.patch(
            self.url,
            {"business_name": "Sugbo Bistro Prime"},
            format="json",
        )

        self.assertSuccessResponse(
            response,
            message="Business identity saved successfully.",
        )

        self.assertEqual(
            response.data["data"]["business_name"],
            "Sugbo Bistro Prime",
        )

    def test_identity_save_rejects_missing_required_fields_on_first_save(self):
        response = self.client.patch(
            self.url,
            {},
            format="json",
        )

        self.assertFalse(response.data["success"])

        self.assertEqual(
            response.data["message"],
            "Business name is required.",
        )

        self.assertIn(
            "business_name",
            response.data["errors"],
        )