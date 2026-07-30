from rest_framework import status
from rest_framework.test import APITestCase

from apps.msme.models import Category, Cluster


class CategoryViewTests(APITestCase):
    """Tests for Category CRUD API endpoints."""

    def setUp(self):
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
            "/api/admin/msmes/categories/",
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

    def test_list_categories_filters_by_search(self):
        response = self.client.get(
            "/api/admin/msmes/categories/?search=restaurant",
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
            f"/api/admin/msmes/categories/?cluster_id={self.cluster.CLUS_ID}",
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
            "/api/admin/msmes/categories/?ordering=name",
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
            f"/api/admin/msmes/categories/{self.category.CTGRY_ID}/",
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
            "/api/admin/msmes/categories/9999/",
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
            "/api/admin/msmes/categories/",
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
            "/api/admin/msmes/categories/",
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
            "/api/admin/msmes/categories/",
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
            "/api/admin/msmes/categories/",
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
            "/api/admin/msmes/categories/",
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
            f"/api/admin/msmes/categories/{self.category.CTGRY_ID}/",
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
            f"/api/admin/msmes/categories/{self.category.CTGRY_ID}/",
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
            f"/api/admin/msmes/categories/{self.category.CTGRY_ID}/",
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
            "/api/admin/msmes/categories/9999/",
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
            f"/api/admin/msmes/categories/{self.category.CTGRY_ID}/",
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
            f"/api/admin/msmes/categories/{category_id}/",
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
            "/api/admin/msmes/categories/9999/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )
