from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from apps.admin_operations.analytics.services.cluster_analytics_service import (
    ClusterAnalyticsService,
)
from apps.business.models import Cluster


class ClusterAnalyticsServiceTests(TestCase):
    def test_cluster_statistics_returns_total_and_weekly_count(self):
        Cluster.objects.create(
            CLUS_NAME="Food and Dining",
            CLUS_DESCRIPTION="Food-related businesses.",
        )

        Cluster.objects.create(
            CLUS_NAME="Arts and Culture",
            CLUS_DESCRIPTION="Arts and culture businesses.",
        )

        result = ClusterAnalyticsService.get_cluster_statistics()

        self.assertEqual(result["total_clusters"], 2)
        self.assertEqual(result["clusters_created_this_week"], 2)

    def test_cluster_statistics_returns_zero_when_no_clusters_exist(self):
        result = ClusterAnalyticsService.get_cluster_statistics()

        self.assertEqual(result["total_clusters"], 0)
        self.assertEqual(result["clusters_created_this_week"], 0)

    def test_clusters_created_this_week_counts_only_current_week(self):
        current_week_cluster = Cluster.objects.create(
            CLUS_NAME="Food and Dining",
            CLUS_DESCRIPTION="Food-related businesses.",
        )

        previous_week_cluster = Cluster.objects.create(
            CLUS_NAME="Arts and Culture",
            CLUS_DESCRIPTION="Arts and culture businesses.",
        )

        today = timezone.localdate()
        current_week_start = today - timedelta(days=today.weekday())
        previous_week_date = current_week_start - timedelta(days=1)

        Cluster.objects.filter(
            CLUS_ID=previous_week_cluster.CLUS_ID,
        ).update(
            CLUS_CREATED_AT=timezone.make_aware(
                timezone.datetime.combine(
                    previous_week_date,
                    timezone.datetime.min.time(),
                ),
            ),
        )

        result = ClusterAnalyticsService.get_clusters_created_this_week()

        self.assertEqual(result, 1)
        self.assertTrue(
            Cluster.objects.filter(
                CLUS_ID=current_week_cluster.CLUS_ID,
            ).exists()
        )

    def test_clusters_created_this_week_returns_zero_for_previous_week_clusters(
        self,
    ):
        cluster = Cluster.objects.create(
            CLUS_NAME="Food and Dining",
            CLUS_DESCRIPTION="Food-related businesses.",
        )

        today = timezone.localdate()
        current_week_start = today - timedelta(days=today.weekday())
        previous_week_date = current_week_start - timedelta(days=1)

        Cluster.objects.filter(
            CLUS_ID=cluster.CLUS_ID,
        ).update(
            CLUS_CREATED_AT=timezone.make_aware(
                timezone.datetime.combine(
                    previous_week_date,
                    timezone.datetime.min.time(),
                ),
            ),
        )

        result = ClusterAnalyticsService.get_clusters_created_this_week()

        self.assertEqual(result, 0)