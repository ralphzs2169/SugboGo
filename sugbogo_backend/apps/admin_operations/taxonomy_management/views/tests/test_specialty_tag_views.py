from django.db.models.deletion import ProtectedError
from rest_framework import status
from rest_framework.test import APITestCase

from apps.admin_operations.taxonomy_management.serializers.specialty_tag_serializers import (
    SpecialtyTagSerializer,
)
from apps.admin_operations.taxonomy_management.services.specialty_tag_service import (
    SpecialtyTagService,
)
from apps.business.models import (
    BusinessSpecialtyTag,
    Category,
    Cluster,
    SpecialtyTag,
)
from apps.merchant_application.models import MerchantApplication
from apps.users.models import User

from . import TaxonomyUsageFixtures


class SpecialtyTagViewTests(TaxonomyUsageFixtures, APITestCase):
    """Tests for Specialty Tag CRUD API endpoints."""

    def setUp(self):
        self.admin = User.objects.create_user(
            email="admin@example.com",
            password="testpassword",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
            USER_FNAME="Admin",
            USER_LNAME="User",
        )

        self.client.force_authenticate(user=self.admin)

        self.tag = SpecialtyTag.objects.create(
            TAG_NAME="Eco Friendly",
            TAG_COLOR=SpecialtyTag.TagColor.GREEN,
        )

        self.other_tag = SpecialtyTag.objects.create(
            TAG_NAME="White Sand",
            TAG_COLOR=SpecialtyTag.TagColor.BLUE,
        )

    def test_list_specialty_tags_returns_tags(self):
        response = self.client.get(
            "/api/admin/taxonomy/specialty-tags/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["data"]["pagination"]["total_items"],
            2,
        )

        self.assertEqual(
            len(response.data["data"]["items"]),
            2,
        )

        tag = response.data["data"]["items"][0]

        self.assertIn("id", tag)
        self.assertIn("name", tag)
        self.assertIn("color", tag)
        self.assertIn("created_at", tag)
        self.assertIn("updated_at", tag)
        self.assertEqual(tag["business_count"], 0)

    def test_list_specialty_tags_counts_only_current_assignments_and_all_applications(self):
        """Exclude inactive assignments without filtering business or application statuses."""
        cluster = Cluster.objects.create(CLUS_NAME="Food")
        category = Category.objects.create(
            CTGRY_NAME="Cafes",
            CLUS_ID=cluster,
        )
        for business_status in ("active", "suspended"):
            business = self.create_usage_business(
                category,
                status=business_status,
                owner_status=User.UserStatus.SUSPENDED,
            )
            BusinessSpecialtyTag.objects.create(
                BUSN_ID=business,
                TAG_ID=self.tag,
            )
        inactive_business = self.create_usage_business(category)
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=inactive_business,
            TAG_ID=self.tag,
            BST_IS_ACTIVE=False,
        )
        for application_status in MerchantApplication.ApplicationStatus.values:
            self.create_application_reference(
                category,
                status=application_status,
                tags=[self.tag],
            )

        for field in ("business_count", "application_count"):
            for prefix in ("", "-"):
                with self.subTest(
                    field=field,
                    prefix=prefix,
                ):
                    response = self.client.get(
                        "/api/admin/taxonomy/specialty-tags/",
                        {"ordering": f"{prefix}{field}"},
                    )
                    self.assertEqual(
                        response.status_code,
                        status.HTTP_200_OK,
                    )
                    items = response.data["data"]["items"]
                    expected = [self.other_tag.pk, self.tag.pk]
                    if prefix:
                        expected.reverse()
                    self.assertEqual(
                        [item["id"] for item in items],
                        expected,
                    )
                    tag = next(
                        item
                        for item in items
                        if item["id"] == self.tag.pk
                    )
                    self.assertEqual(
                        tag["business_count"],
                        2,
                    )
                    self.assertEqual(
                        tag["application_count"],
                        4,
                    )
                    self.assertNotIn("vouch_count", tag)

        with self.assertNumQueries(1):
            tags = SpecialtyTagSerializer(
                SpecialtyTagService.list_specialty_tags(),
                many=True,
            ).data
        self.assertEqual(len(tags), 2)

        response = self.client.get(
            "/api/admin/taxonomy/specialty-tags/",
            {"search": "Eco", "page_size": 1},
        )
        self.assertEqual(
            response.data["data"]["pagination"]["total_items"],
            1,
        )
        self.assertEqual(
            response.data["data"]["items"][0]["business_count"],
            2,
        )

    def test_zero_current_business_count_does_not_allow_deleting_inactive_assignment(self):
        """Preserve protected retained assignments even when current usage is zero."""
        cluster = Cluster.objects.create(CLUS_NAME="Food")
        category = Category.objects.create(
            CTGRY_NAME="Cafes",
            CLUS_ID=cluster,
        )
        business = self.create_usage_business(category)
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=business,
            TAG_ID=self.tag,
            BST_IS_ACTIVE=False,
        )
        tag = SpecialtyTagService.list_specialty_tags().get(pk=self.tag.pk)
        self.assertEqual(tag.business_count, 0)
        self.assertEqual(tag.application_count, 0)
        with self.assertRaises(ProtectedError):
            SpecialtyTagService.delete_specialty_tag(tag)
        self.assertTrue(SpecialtyTag.objects.filter(pk=self.tag.pk).exists())

    def test_list_specialty_tags_filters_by_search(self):
        response = self.client.get(
            "/api/admin/taxonomy/specialty-tags/?search=eco",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["data"]["pagination"]["total_items"],
            1,
        )

        self.assertEqual(
            response.data["data"]["items"][0]["name"],
            "Eco Friendly",
        )

        self.assertEqual(
            response.data["data"]["items"][0]["color"],
            SpecialtyTag.TagColor.GREEN,
        )

    def test_list_specialty_tags_orders_by_name_descending(self):
        response = self.client.get(
            "/api/admin/taxonomy/specialty-tags/?ordering=-name",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        names = [
            item["name"]
            for item in response.data["data"]["items"]
        ]

        self.assertEqual(
            names,
            [
                "White Sand",
                "Eco Friendly",
            ],
        )

    def test_create_specialty_tag(self):
        response = self.client.post(
            "/api/admin/taxonomy/specialty-tags/",
            {
                "name": "Heritage Site",
                "color": SpecialtyTag.TagColor.BLUE,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        self.assertEqual(
            response.data["data"]["name"],
            "Heritage Site",
        )

        self.assertEqual(
            response.data["data"]["color"],
            SpecialtyTag.TagColor.BLUE,
        )

        self.assertTrue(
            SpecialtyTag.objects.filter(
                TAG_NAME="Heritage Site",
                TAG_COLOR=SpecialtyTag.TagColor.BLUE,
            ).exists()
        )

    def test_create_specialty_tag_defaults_to_blue(self):
        response = self.client.post(
            "/api/admin/taxonomy/specialty-tags/",
            {
                "name": "Heritage Site",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        self.assertEqual(
            response.data["data"]["name"],
            "Heritage Site",
        )

        self.assertEqual(
            response.data["data"]["color"],
            SpecialtyTag.TagColor.BLUE,
        )

        self.assertTrue(
            SpecialtyTag.objects.filter(
                TAG_NAME="Heritage Site",
                TAG_COLOR=SpecialtyTag.TagColor.BLUE,
            ).exists()
        )

    def test_create_specialty_tag_strips_name(self):
        response = self.client.post(
            "/api/admin/taxonomy/specialty-tags/",
            {
                "name": "  Nature Retreat  ",
                "color": SpecialtyTag.TagColor.GREEN,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        self.assertEqual(
            response.data["data"]["name"],
            "Nature Retreat",
        )

        self.assertEqual(
            response.data["data"]["color"],
            SpecialtyTag.TagColor.GREEN,
        )

    def test_get_specialty_tag(self):
        response = self.client.get(
            f"/api/admin/taxonomy/specialty-tags/{self.tag.TAG_ID}/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["data"]["id"],
            self.tag.TAG_ID,
        )

        self.assertEqual(
            response.data["data"]["name"],
            "Eco Friendly",
        )

        self.assertEqual(
            response.data["data"]["color"],
            SpecialtyTag.TagColor.GREEN,
        )

    def test_put_specialty_tag(self):
        response = self.client.put(
            f"/api/admin/taxonomy/specialty-tags/{self.tag.TAG_ID}/",
            {
                "name": "Sustainable Tourism",
                "color": SpecialtyTag.TagColor.BLUE,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.tag.refresh_from_db()

        self.assertEqual(
            self.tag.TAG_NAME,
            "Sustainable Tourism",
        )

        self.assertEqual(
            self.tag.TAG_COLOR,
            SpecialtyTag.TagColor.BLUE,
        )

        self.assertEqual(
            response.data["data"]["name"],
            "Sustainable Tourism",
        )

        self.assertEqual(
            response.data["data"]["color"],
            SpecialtyTag.TagColor.BLUE,
        )

    def test_patch_specialty_tag(self):
        response = self.client.patch(
            f"/api/admin/taxonomy/specialty-tags/{self.tag.TAG_ID}/",
            {
                "name": "Eco Tourism",
                "color": SpecialtyTag.TagColor.PURPLE,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.tag.refresh_from_db()

        self.assertEqual(
            self.tag.TAG_NAME,
            "Eco Tourism",
        )

        self.assertEqual(
            self.tag.TAG_COLOR,
            SpecialtyTag.TagColor.PURPLE,
        )

        self.assertEqual(
            response.data["data"]["name"],
            "Eco Tourism",
        )

        self.assertEqual(
            response.data["data"]["color"],
            SpecialtyTag.TagColor.PURPLE,
        )

    def test_delete_specialty_tag(self):
        tag_id = self.tag.TAG_ID

        response = self.client.delete(
            f"/api/admin/taxonomy/specialty-tags/{tag_id}/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertFalse(
            SpecialtyTag.objects.filter(
                TAG_ID=tag_id,
            ).exists()
        )

    def test_get_specialty_tag_returns_404_for_missing_tag(self):
        response = self.client.get(
            "/api/admin/taxonomy/specialty-tags/9999/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_update_specialty_tag_returns_404_for_missing_tag(self):
        response = self.client.patch(
            "/api/admin/taxonomy/specialty-tags/9999/",
            {
                "name": "Beachfront",
                "color": SpecialtyTag.TagColor.BLUE,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_delete_specialty_tag_returns_404_for_missing_tag(self):
        response = self.client.delete(
            "/api/admin/taxonomy/specialty-tags/9999/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )


    def test_create_specialty_tag_fails_with_name_shorter_than_minimum(self):
        payload = {
            "name": "AI",
            "color": "blue",
        }

        response = self.client.post(
            "/api/admin/taxonomy/specialty-tags/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            response.data["errors"]["name"][0],
            "Specialty tag name must be at least 3 characters.",
        )
