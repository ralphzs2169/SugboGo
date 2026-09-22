from rest_framework.test import APITestCase
from django.urls import reverse

from apps.business.models import Category, Cluster
from apps.merchant_application.models import MerchantApplication
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

    def test_identity_save_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.patch(
            self.url,
            self.valid_payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            401,
        )

    def test_identity_save_partial_update_preserves_specialty_tags(self):
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

        self.assertTrue(
            response.data["data"]["specialty_tags"],
        )

    def test_first_save_rejects_category_outside_selected_cluster(self):
        other_cluster = Cluster.objects.create(CLUS_NAME="Other Cluster")
        payload = {**self.valid_payload, "business_cluster_id": other_cluster.pk}

        response = self.client.patch(self.url, payload, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("business_category_id", response.data["errors"])
        self.assertFalse(MerchantApplication.objects.filter(USER_ID=self.user).exists())

    def test_partial_taxonomy_updates_validate_against_saved_identity(self):
        self.client.patch(self.url, self.valid_payload, format="json")
        other_cluster = Cluster.objects.create(CLUS_NAME="Other Cluster")
        other_category = Category.objects.create(
            CTGRY_NAME="Other Category",
            CLUS_ID=other_cluster,
        )

        for payload in (
            {"business_cluster_id": other_cluster.pk},
            {"business_category_id": other_category.pk},
        ):
            with self.subTest(payload=payload):
                response = self.client.patch(self.url, payload, format="json")
                self.assertEqual(response.status_code, 400)
                self.assertIn("business_category_id", response.data["errors"])

        identity = MerchantApplication.objects.get(USER_ID=self.user).identity
        self.assertEqual(identity.CLUS_ID_id, self.cluster.pk)
        self.assertEqual(identity.CTGRY_ID_id, self.category.pk)

        response = self.client.patch(
            self.url,
            {
                "business_cluster_id": other_cluster.pk,
                "business_category_id": other_category.pk,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        identity.refresh_from_db()
        self.assertEqual(identity.CLUS_ID_id, other_cluster.pk)
        self.assertEqual(identity.CTGRY_ID_id, other_category.pk)

    def test_identity_rejects_duplicate_specialty_tags(self):
        for tag_ids in (
            [self.tags[0].pk, self.tags[0].pk, self.tags[1].pk],
            [tag.pk for tag in self.tags] + [self.tags[0].pk],
        ):
            with self.subTest(tag_ids=tag_ids):
                response = self.client.patch(
                    self.url,
                    {**self.valid_payload, "specialty_tags": tag_ids},
                    format="json",
                )
                self.assertEqual(response.status_code, 400)
                self.assertIn("specialty_tags", response.data["errors"])
        self.assertFalse(MerchantApplication.objects.filter(USER_ID=self.user).exists())
