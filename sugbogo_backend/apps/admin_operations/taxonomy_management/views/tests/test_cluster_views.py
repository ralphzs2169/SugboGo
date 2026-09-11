from rest_framework import status
from rest_framework.test import APITestCase

from apps.business.models import Category, Cluster
from apps.users.models import User


class ClusterViewTests(APITestCase):
    """Tests for Cluster CRUD API endpoints."""

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

    def test_list_clusters_returns_clusters(self):
        response = self.client.get(
            "/api/admin/taxonomy/clusters/",
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

    def test_list_clusters_filters_by_search(self):
        response = self.client.get(
            "/api/admin/taxonomy/clusters/?search=food",
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
            "Food & Beverage",
        )

    def test_list_clusters_orders_by_name(self):
        response = self.client.get(
            "/api/admin/taxonomy/clusters/?ordering=name",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        names = [
            cluster["name"]
            for cluster in response.data["data"]["items"]
        ]

        self.assertEqual(
            names,
            ["Food & Beverage", "Tourism"],
        )

    def test_list_clusters_orders_by_name_descending(self):
        response = self.client.get(
            "/api/admin/taxonomy/clusters/?ordering=-name",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        names = [
            cluster["name"]
            for cluster in response.data["data"]["items"]
        ]

        self.assertEqual(
            names,
            ["Tourism", "Food & Beverage"],
        )

    def test_create_cluster_fails_with_name_shorter_than_minimum(self):
        payload = {
            "name": "IT",
        }

        response = self.client.post(
            "/api/admin/taxonomy/clusters/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            response.data["errors"]["name"][0],
            "Cluster name must be at least 3 characters.",
        )

        self.assertFalse(
            Cluster.objects.filter(CLUS_NAME="IT").exists()
        )

    def test_retrieve_cluster_returns_cluster(self):
        response = self.client.get(
            f"/api/admin/taxonomy/clusters/{self.cluster.CLUS_ID}/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["data"]["name"],
            "Food & Beverage",
        )

        self.assertEqual(
            response.data["data"]["description"],
            "Food and beverage businesses.",
        )

        self.assertEqual(
            response.data["data"]["category_count"],
            0,
        )

    def test_retrieve_cluster_returns_404_when_not_found(self):
        response = self.client.get(
            "/api/admin/taxonomy/clusters/9999/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_create_cluster_successfully(self):
        payload = {
            "name": "Food & Dining",
            "description": "Food and dining businesses.",
            "icon": "palette",
        }

        response = self.client.post(
            "/api/admin/taxonomy/clusters/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        self.assertTrue(
            Cluster.objects.filter(
                CLUS_NAME="Food & Dining",
            ).exists()
        )

        cluster = Cluster.objects.get(
            CLUS_NAME="Food & Dining",
        )

        self.assertEqual(
            cluster.CLUS_DESCRIPTION,
            "Food and dining businesses.",
        )

        self.assertEqual(
            cluster.CLUS_ICON,
            "palette",
        )

        self.assertEqual(
            response.data["message"],
            "Cluster created successfully.",
        )

        self.assertEqual(
            response.data["data"]["name"],
            "Food & Dining",
        )

        self.assertEqual(
            response.data["data"]["icon"],
            "palette",
        )
        
       

    def test_create_cluster_strips_name(self):
        payload = {
            "name": "  Arts & Culture  ",
            "description": "Arts and culture businesses.",
            "icon": "palette",
        }

        response = self.client.post(
            "/api/admin/taxonomy/clusters/",
            payload,
            format="json",
        )
     

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        self.assertTrue(
            Cluster.objects.filter(
                CLUS_NAME="Arts & Culture",
            ).exists()
        )

    def test_create_cluster_fails_with_invalid_data(self):
        payload = {
            "name": "",
            "description": "Invalid cluster.",
        }

        response = self.client.post(
            "/api/admin/taxonomy/clusters/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertFalse(
            Cluster.objects.filter(
                CLUS_DESCRIPTION="Invalid cluster.",
            ).exists()
        )

    def test_create_cluster_fails_with_duplicate_name(self):
        payload = {
            "name": "food & beverage",
            "description": "Duplicate cluster.",
        }

        response = self.client.post(
            "/api/admin/taxonomy/clusters/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertFalse(
            Cluster.objects.filter(
                CLUS_DESCRIPTION="Duplicate cluster.",
            ).exists()
        )

    def test_update_cluster_successfully(self):
        payload = {
            "name": "Updated Food & Beverage",
        }

        response = self.client.patch(
            f"/api/admin/taxonomy/clusters/{self.cluster.CLUS_ID}/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.cluster.refresh_from_db()

        self.assertEqual(
            self.cluster.CLUS_NAME,
            "Updated Food & Beverage",
        )

        self.assertEqual(
            response.data["message"],
            "Cluster updated successfully.",
        )

        self.assertEqual(
            response.data["data"]["name"],
            "Updated Food & Beverage",
        )

    def test_update_cluster_strips_name(self):
        payload = {
            "name": "  Updated Food & Beverage  ",
        }

        response = self.client.patch(
            f"/api/admin/taxonomy/clusters/{self.cluster.CLUS_ID}/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.cluster.refresh_from_db()

        self.assertEqual(
            self.cluster.CLUS_NAME,
            "Updated Food & Beverage",
        )

    def test_update_cluster_updates_description(self):
        payload = {
            "description": "Updated description.",
        }

        response = self.client.patch(
            f"/api/admin/taxonomy/clusters/{self.cluster.CLUS_ID}/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.cluster.refresh_from_db()

        self.assertEqual(
            self.cluster.CLUS_DESCRIPTION,
            "Updated description.",
        )

    def test_update_cluster_returns_404_when_not_found(self):
        response = self.client.patch(
            "/api/admin/taxonomy/clusters/9999/",
            {
                "name": "Updated Cluster",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_update_cluster_fails_with_duplicate_name(self):
        payload = {
            "name": "tourism",
        }

        response = self.client.patch(
            f"/api/admin/taxonomy/clusters/{self.cluster.CLUS_ID}/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.cluster.refresh_from_db()

        self.assertEqual(
            self.cluster.CLUS_NAME,
            "Food & Beverage",
        )

    def test_delete_cluster_successfully(self):
        cluster_id = self.cluster.CLUS_ID

        response = self.client.delete(
            f"/api/admin/taxonomy/clusters/{cluster_id}/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertFalse(
            Cluster.objects.filter(
                CLUS_ID=cluster_id,
            ).exists()
        )

        self.assertEqual(
            response.data["message"],
            "Cluster deleted successfully.",
        )

    def test_delete_cluster_fails_when_cluster_has_categories(self):
        Category.objects.create(
            CTGRY_NAME="Restaurants",
            CTGRY_DESCRIPTION="Restaurants and dining establishments.",
            CLUS_ID=self.cluster,
        )

        response = self.client.delete(
            f"/api/admin/taxonomy/clusters/{self.cluster.CLUS_ID}/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            response.data["code"],
            "CLUSTER_HAS_CATEGORIES",
        )

        self.assertTrue(
            Cluster.objects.filter(
                CLUS_ID=self.cluster.CLUS_ID,
            ).exists()
        )

    def test_delete_cluster_returns_404_when_not_found(self):
        response = self.client.delete(
            "/api/admin/taxonomy/clusters/9999/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )


    def test_get_cluster_statistics_successfully(self):
        Cluster.objects.all().delete()

        Cluster.objects.create(
            CLUS_NAME="Food and Dining",
        )

        Cluster.objects.create(
            CLUS_NAME="Arts and Culture",
        )

        response = self.client.get(
            "/api/admin/taxonomy/clusters/statistics/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["data"]["total_clusters"],
            2,
        )

        self.assertEqual(
            response.data["data"]["clusters_created_this_week"],
            2,
        )

        self.assertEqual(
            response.data["message"],
            "Cluster statistics retrieved successfully.",
        )


    def test_get_cluster_statistics_returns_zero_when_no_clusters_exist(self):
        Cluster.objects.all().delete()

        response = self.client.get(
            "/api/admin/taxonomy/clusters/statistics/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["data"]["total_clusters"],
            0,
        )

        self.assertEqual(
            response.data["data"]["clusters_created_this_week"],
            0,
        )