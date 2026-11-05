from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.admin_operations.taxonomy_management.serializers.category_serializers import (
    CategorySerializer,
)
from apps.admin_operations.taxonomy_management.services.category_service import (
    CategoryService,
)
from apps.business.models import Category, Cluster
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationSubmission,
)
from apps.users.models import User

from . import TaxonomyUsageFixtures


class CategoryViewTests(TaxonomyUsageFixtures, APITestCase):
    """Tests for Category CRUD API endpoints."""

    def setUp(self):
        self.admin = User.objects.create_user(
            email="admin-category@example.com",
            password="StrongPassword123!",
            USER_FNAME="Category",
            USER_LNAME="Admin",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.client.force_authenticate(self.admin)
    
        self.cluster = Cluster.objects.create(
            CLUS_NAME="Food & Beverage",
            CLUS_DESCRIPTION="Food and beverage businesses.",
        )

        self.other_cluster = Cluster.objects.create(
            CLUS_NAME="Tourism",
            CLUS_DESCRIPTION="Tourism-related businesses.",
        )

        self.category = Category.objects.create(
            CTGRY_NAME="Restaurants",
            CTGRY_DESCRIPTION="Restaurants and dining establishments.",
            CLUS_ID=self.cluster,
        )

        self.other_category = Category.objects.create(
            CTGRY_NAME="Hotels",
            CTGRY_DESCRIPTION="Hotels and accommodations.",
            CLUS_ID=self.other_cluster,
        )

    def test_list_categories_returns_categories(self):
        response = self.client.get(
            "/api/admin/taxonomy/categories/",
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
        self.assertEqual(
            response.data["data"]["items"][0]["business_count"],
            0,
        )
        self.assertEqual(
            response.data["data"]["items"][0]["msme_count"],
            0,
        )

    def test_list_categories_counts_distinct_current_businesses_and_applications(self):
        """Preserve all application statuses while counting independent current businesses."""
        self.create_usage_business(self.category)
        self.create_usage_business(
            self.category,
            status="suspended",
            owner_status=User.UserStatus.DISABLED,
        )
        moved_business = self.create_usage_business(self.category)
        moved_business.CTGRY_ID = self.other_category
        moved_business.save(update_fields=["CTGRY_ID"])

        for application_status in MerchantApplication.ApplicationStatus.values:
            identity = self.create_application_reference(
                self.category,
                status=application_status,
            )
        for submission_number in (1, 2):
            MerchantApplicationSubmission.objects.create(
                MAPP_ID=identity.MAPP_ID,
                MASUB_SUBMISSION_NUMBER=submission_number,
                MASUB_SUBMITTED_AT=timezone.now(),
            )

        response = self.client.get(
            "/api/admin/taxonomy/categories/",
            {
                "search": "Restaurants",
                "cluster_id": self.cluster.pk,
                "page_size": 1,
            },
        )
        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            response.data["data"]["pagination"]["total_items"],
            1,
        )
        category = response.data["data"]["items"][0]
        self.assertEqual(
            category["business_count"],
            2,
        )
        self.assertEqual(
            category["msme_count"],
            2,
        )
        self.assertEqual(
            category["application_count"],
            4,
        )
        self.assertEqual(
            category["cluster_id"],
            self.cluster.pk,
        )
        self.assertEqual(
            category["cluster_name"],
            self.cluster.CLUS_NAME,
        )

        with self.assertNumQueries(1):
            categories = CategorySerializer(
                CategoryService.list_categories(),
                many=True,
            ).data
        self.assertEqual(len(categories), 2)

    def test_list_categories_orders_by_usage_counts_and_parent_name(self):
        """Support ascending and descending usage and parent-name ordering."""
        self.create_usage_business(self.category)
        self.create_application_reference(self.category)

        for field in (
            "business_count",
            "msme_count",
            "application_count",
            "cluster_name",
        ):
            for prefix in ("", "-"):
                with self.subTest(
                    field=field,
                    prefix=prefix,
                ):
                    response = self.client.get(
                        "/api/admin/taxonomy/categories/",
                        {"ordering": f"{prefix}{field}"},
                    )
                    self.assertEqual(
                        response.status_code,
                        status.HTTP_200_OK,
                    )
                    expected = [self.other_category.pk, self.category.pk]
                    if field == "cluster_name":
                        expected.reverse()
                    if prefix:
                        expected.reverse()
                    self.assertEqual(
                        [
                            item["id"]
                            for item in response.data["data"]["items"]
                        ],
                        expected,
                    )

    def test_list_categories_filters_by_search(self):
        response = self.client.get(
            "/api/admin/taxonomy/categories/?search=restaurant",
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
            "Restaurants",
        )

    def test_list_categories_filters_by_cluster(self):
        response = self.client.get(
            f"/api/admin/taxonomy/categories/?cluster_id={self.cluster.CLUS_ID}",
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
            "Restaurants",
        )

    def test_list_categories_orders_by_name(self):
        response = self.client.get(
            "/api/admin/taxonomy/categories/?ordering=name",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        names = [
            category["name"]
            for category in response.data["data"]["items"]
        ]

        self.assertEqual(
            names,
            ["Hotels", "Restaurants"],
        )

    def test_retrieve_category_returns_category(self):
        response = self.client.get(
            f"/api/admin/taxonomy/categories/{self.category.CTGRY_ID}/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["data"]["name"],
            "Restaurants",
        )

        self.assertEqual(
            response.data["data"]["description"],
            "Restaurants and dining establishments.",
        )

        self.assertEqual(
            response.data["data"]["cluster_id"],
            self.cluster.CLUS_ID,
        )

        self.assertEqual(
            response.data["data"]["cluster_name"],
            "Food & Beverage",
        )

    def test_retrieve_category_returns_404_when_not_found(self):
        response = self.client.get(
            "/api/admin/taxonomy/categories/9999/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_create_category_successfully(self):
        payload = {
            "name": "Cafes",
            "description": "Coffee shops and cafes.",
            "cluster_id": self.cluster.CLUS_ID,
        }

        response = self.client.post(
            "/api/admin/taxonomy/categories/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        self.assertTrue(
            Category.objects.filter(
                CTGRY_NAME="Cafes",
            ).exists()
        )

        category = Category.objects.get(
            CTGRY_NAME="Cafes",
        )

        self.assertEqual(
            category.CLUS_ID,
            self.cluster,
        )

        self.assertEqual(
            response.data["message"],
            "Category created successfully.",
        )

        self.assertEqual(
            response.data["data"]["name"],
            "Cafes",
        )

    def test_create_category_strips_name(self):
        payload = {
            "name": "  Cafes  ",
            "description": "Coffee shops and cafes.",
            "cluster_id": self.cluster.CLUS_ID,
        }

        response = self.client.post(
            "/api/admin/taxonomy/categories/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        self.assertTrue(
            Category.objects.filter(
                CTGRY_NAME="Cafes",
            ).exists()
        )

    def test_create_category_fails_with_invalid_data(self):
        payload = {
            "name": "",
            "description": "Invalid category.",
            "cluster_id": self.cluster.CLUS_ID,
        }

        response = self.client.post(
            "/api/admin/taxonomy/categories/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertFalse(
            Category.objects.filter(
                CTGRY_DESCRIPTION="Invalid category.",
            ).exists()
        )

    def test_create_category_fails_with_duplicate_name(self):
        payload = {
            "name": "restaurants",
            "description": "Duplicate category.",
            "cluster_id": self.cluster.CLUS_ID,
        }

        response = self.client.post(
            "/api/admin/taxonomy/categories/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertFalse(
            Category.objects.filter(
                CTGRY_DESCRIPTION="Duplicate category.",
            ).exists()
        )

    def test_create_category_fails_when_cluster_does_not_exist(self):
        payload = {
            "name": "Cafes",
            "description": "Coffee shops and cafes.",
            "cluster_id": 9999,
        }

        response = self.client.post(
            "/api/admin/taxonomy/categories/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertFalse(
            Category.objects.filter(
                CTGRY_NAME="Cafes",
            ).exists()
        )

    def test_update_category_successfully(self):
        payload = {
            "name": "Updated Restaurants",
        }

        response = self.client.patch(
            f"/api/admin/taxonomy/categories/{self.category.CTGRY_ID}/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.category.refresh_from_db()

        self.assertEqual(
            self.category.CTGRY_NAME,
            "Updated Restaurants",
        )

        self.assertEqual(
            response.data["message"],
            "Category updated successfully.",
        )

        self.assertEqual(
            response.data["data"]["name"],
            "Updated Restaurants",
        )

    def test_update_category_strips_name(self):
        payload = {
            "name": "  Updated Restaurants  ",
        }

        response = self.client.patch(
            f"/api/admin/taxonomy/categories/{self.category.CTGRY_ID}/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.category.refresh_from_db()

        self.assertEqual(
            self.category.CTGRY_NAME,
            "Updated Restaurants",
        )

    def test_update_category_updates_cluster(self):
        payload = {
            "cluster_id": self.other_cluster.CLUS_ID,
        }

        response = self.client.patch(
            f"/api/admin/taxonomy/categories/{self.category.CTGRY_ID}/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.category.refresh_from_db()

        self.assertEqual(
            self.category.CLUS_ID,
            self.other_cluster,
        )

        self.assertEqual(
            response.data["data"]["cluster_id"],
            self.other_cluster.CLUS_ID,
        )

    def test_update_category_returns_404_when_not_found(self):
        response = self.client.patch(
            "/api/admin/taxonomy/categories/9999/",
            {
                "name": "Updated",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_update_category_fails_with_duplicate_name(self):
        payload = {
            "name": "Hotels",
        }

        response = self.client.patch(
            f"/api/admin/taxonomy/categories/{self.category.CTGRY_ID}/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.category.refresh_from_db()

        self.assertEqual(
            self.category.CTGRY_NAME,
            "Restaurants",
        )

    def test_delete_category_successfully(self):
        category_id = self.category.CTGRY_ID

        response = self.client.delete(
            f"/api/admin/taxonomy/categories/{category_id}/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertFalse(
            Category.objects.filter(
                CTGRY_ID=category_id,
            ).exists()
        )

        self.assertEqual(
            response.data["message"],
            "Category deleted successfully.",
        )

    def test_delete_category_returns_404_when_not_found(self):
        response = self.client.delete(
            "/api/admin/taxonomy/categories/9999/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )


    def test_get_category_statistics_successfully(self):
        Category.objects.all().delete()

        Category.objects.create(
            CTGRY_NAME="Restaurants",
            CLUS_ID=self.cluster,
        )

        Category.objects.create(
            CTGRY_NAME="Hotels",
            CLUS_ID=self.cluster,
        )

        response = self.client.get(
            "/api/admin/taxonomy/categories/statistics/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["data"]["total_categories"],
            2,
        )

        self.assertEqual(
            response.data["data"]["categories_created_this_week"],
            2,
        )

        self.assertEqual(
            response.data["message"],
            "Category statistics retrieved successfully.",
        )


    def test_get_category_statistics_returns_zero_when_no_categories_exist(self):
        Category.objects.all().delete()

        response = self.client.get(
            "/api/admin/taxonomy/categories/statistics/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["data"]["total_categories"],
            0,
        )

        self.assertEqual(
            response.data["data"]["categories_created_this_week"],
            0,
        )

    def test_create_category_fails_with_name_shorter_than_minimum(self):
        payload = {
            "name": "IT",
            "cluster_id": self.cluster.CLUS_ID,
        }

        response = self.client.post(
            "/api/admin/taxonomy/categories/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            response.data["errors"]["name"][0],
            "Category name must be at least 3 characters.",
        )


class CategoryDetailPermissionTests(APITestCase):
    """Exercise every detail method with each supported role."""

    @classmethod
    def setUpTestData(cls):
        cls.users = {
            role: User.objects.create_user(
                email=f"{role}-category-permissions@example.com",
                password=None,
                USER_FNAME="Permission",
                USER_LNAME="Test",
                USER_ROLE=role,
                USER_STATUS=User.UserStatus.ACTIVE,
            )
            for role in (
                User.UserRole.EXPLORER,
                User.UserRole.MERCHANT,
                User.UserRole.ADMIN,
                User.UserRole.SUPER_ADMIN,
            )
        }

    def _assert_detail_permissions(self, role, expected_status):
        self.client.force_authenticate(self.users.get(role))
        for method in ("get", "put", "patch", "delete"):
            with self.subTest(role=role, method=method):
                cluster = Cluster.objects.create(CLUS_NAME=f"Cluster {method}")
                instance = Category.objects.create(
                    CTGRY_NAME=f"Category {method}", CLUS_ID=cluster,
                )
                url = f"/api/admin/taxonomy/categories/{instance.pk}/"
                payload = {"name": f"Updated {method}", "description": "Updated"}
                payload["cluster_id"] = cluster.pk
                response = getattr(self.client, method)(url, payload, format="json")
                self.assertEqual(response.status_code, expected_status)
                if expected_status != status.HTTP_200_OK:
                    instance.refresh_from_db()
                    self.assertEqual(instance.CTGRY_NAME, f"Category {method}")

    def test_anonymous_is_unauthorized(self):
        self._assert_detail_permissions(None, status.HTTP_401_UNAUTHORIZED)

    def test_explorer_is_forbidden(self):
        self._assert_detail_permissions(User.UserRole.EXPLORER, status.HTTP_403_FORBIDDEN)

    def test_merchant_is_forbidden(self):
        self._assert_detail_permissions(User.UserRole.MERCHANT, status.HTTP_403_FORBIDDEN)

    def test_admin_is_allowed(self):
        self._assert_detail_permissions(User.UserRole.ADMIN, status.HTTP_200_OK)

    def test_super_admin_is_allowed(self):
        self._assert_detail_permissions(User.UserRole.SUPER_ADMIN, status.HTTP_200_OK)
