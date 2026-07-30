from django.http import Http404
from django.test import TestCase

from apps.msme.models import Cluster
from apps.msme.services.cluster_service import ClusterService


class ClusterServiceTests(TestCase):
    """Tests for ClusterService business logic."""

    def setUp(self):
        self.cluster_a = Cluster.objects.create(
            CLUS_NAME="Food & Dining",
            CLUS_DESCRIPTION="Restaurants and food businesses",
        )

        self.cluster_b = Cluster.objects.create(
            CLUS_NAME="Adventure",
            CLUS_DESCRIPTION="Outdoor activities and attractions",
        )

    def test_list_clusters_returns_all_clusters(self):
        clusters = ClusterService.list_clusters()

        self.assertEqual(clusters.count(), 2)

    def test_list_clusters_searches_by_name(self):
        clusters = ClusterService.list_clusters(
            search="Food",
        )

        self.assertEqual(
            clusters.count(),
            1,
        )

        self.assertEqual(
            clusters.first().CLUS_NAME,
            "Food & Dining",
        )

    def test_list_clusters_searches_by_description(self):
        clusters = ClusterService.list_clusters(
            search="Outdoor",
        )

        self.assertEqual(
            clusters.count(),
            1,
        )

        self.assertEqual(
            clusters.first().CLUS_NAME,
            "Adventure",
        )

    def test_list_clusters_orders_by_name_ascending(self):
        clusters = ClusterService.list_clusters(
            ordering="name",
        )

        self.assertEqual(
            clusters.first().CLUS_NAME,
            "Adventure",
        )

    def test_list_clusters_orders_by_name_descending(self):
        clusters = ClusterService.list_clusters(
            ordering="-name",
        )

        clusters = list(clusters)

        self.assertEqual(
            clusters[0].CLUS_NAME,
            "Food & Dining",
        )

    def test_get_cluster_returns_cluster(self):
        cluster = ClusterService.get_cluster(
            self.cluster_a.CLUS_ID,
        )

        self.assertEqual(
            cluster.CLUS_NAME,
            "Food & Dining",
        )

    def test_get_cluster_raises_404_when_not_found(self):
        with self.assertRaises(Http404):
            ClusterService.get_cluster(9999)

    def test_create_cluster_strips_name_whitespace(self):
        cluster = ClusterService.create_cluster(
            {
                "CLUS_NAME": "  Tourism  ",
                "CLUS_DESCRIPTION": "Tourism businesses",
            }
        )

        self.assertEqual(
            cluster.CLUS_NAME,
            "Tourism",
        )

        self.assertTrue(
            Cluster.objects.filter(
                CLUS_NAME="Tourism",
            ).exists()
        )

    def test_update_cluster_updates_fields(self):
        updated_cluster = ClusterService.update_cluster(
            self.cluster_a,
            {
                "CLUS_NAME": "  Updated Name  ",
                "CLUS_DESCRIPTION": "Updated description",
            },
        )

        self.assertEqual(
            updated_cluster.CLUS_NAME,
            "Updated Name",
        )

        self.assertEqual(
            updated_cluster.CLUS_DESCRIPTION,
            "Updated description",
        )

    def test_delete_cluster_removes_cluster(self):
        cluster_id = self.cluster_a.CLUS_ID

        ClusterService.delete_cluster(
            self.cluster_a,
        )

        self.assertFalse(
            Cluster.objects.filter(
                CLUS_ID=cluster_id,
            ).exists()
        )