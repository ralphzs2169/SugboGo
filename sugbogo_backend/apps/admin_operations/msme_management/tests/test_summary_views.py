from rest_framework import status
from rest_framework.test import APITestCase

from apps.msme.models import Category, Cluster


class ClusterCategorySummaryViewTests(APITestCase):
    """Tests for the cluster and category management summary endpoint."""

    def setUp(self):
        self.url = "/api/admin/msmes/cluster-category/summary/"

        self.cluster = Cluster.objects.create(
            CLUS_NAME="Food & Beverage",
            CLUS_DESCRIPTION="Food and beverage businesses.",
        )

        self.other_cluster = Cluster.objects.create(
            CLUS_NAME="Tourism",
            CLUS_DESCRIPTION="Tourism-related businesses.",
        )

        Category.objects.create(
            CTGRY_NAME="Restaurants",
            CTGRY_DESCRIPTION="Restaurants and dining establishments.",
            CLUS_ID=self.cluster,
        )

        Category.objects.create(
            CTGRY_NAME="Hotels",
            CTGRY_DESCRIPTION="Hotels and accommodations.",
            CLUS_ID=self.other_cluster,
        )

    def test_get_cluster_category_summary_returns_counts(self):
        response = self.client.get(
            self.url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertTrue(
            response.data["success"],
        )

        self.assertEqual(
            response.data["data"]["cluster_count"],
            2,
        )

        self.assertEqual(
            response.data["data"]["category_count"],
            2,
        )

    def test_get_cluster_category_summary_returns_zero_counts_when_empty(self):
        Category.objects.all().delete()
        Cluster.objects.all().delete()

        response = self.client.get(
            self.url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["data"]["cluster_count"],
            0,
        )

        self.assertEqual(
            response.data["data"]["category_count"],
            0,
        )

    def test_get_cluster_category_summary_uses_current_database_counts(self):
        response = self.client.get(
            self.url,
        )

        self.assertEqual(
            response.data["data"]["cluster_count"],
            Cluster.objects.count(),
        )

        self.assertEqual(
            response.data["data"]["category_count"],
            Category.objects.count(),
        )