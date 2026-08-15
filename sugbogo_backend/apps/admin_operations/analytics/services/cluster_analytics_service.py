from django.utils import timezone

from apps.business.models import Cluster


class ClusterAnalyticsService:
    """Provides analytics and metrics for business clusters."""

    @staticmethod
    def get_cluster_statistics():
        """Retrieve aggregate cluster management statistics."""

        return {
            "total_clusters": Cluster.objects.count(),
            "clusters_created_this_week": (
                ClusterAnalyticsService
                .get_clusters_created_this_week()
            ),
        }

    @staticmethod
    def get_clusters_created_this_week():
        """Return the number of clusters created during the current week."""

        today = timezone.localdate()
        week_start = today - timezone.timedelta(days=today.weekday())

        return Cluster.objects.filter(
            CLUS_CREATED_AT__date__gte=week_start,
            CLUS_CREATED_AT__date__lte=today,
        ).count()