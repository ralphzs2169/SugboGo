from django.utils import timezone
from django.db.models import Count, Q

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

    @staticmethod
    def get_coverage_counts(eligible_ids, visited_ids, *, cluster=None, category=None):
        """Count eligible and visited businesses by current cluster, retaining empty groups."""
        queryset = Cluster.objects.all()
        if cluster is not None:
            queryset = queryset.filter(CLUS_ID=cluster)
        if category is not None:
            queryset = queryset.filter(categories__CTGRY_ID=category)
        rows = queryset.annotate(
            eligible=Count("categories__businesses", distinct=True, filter=Q(
                categories__businesses__BUSN_ID__in=eligible_ids,
            )),
            visited=Count("categories__businesses", distinct=True, filter=Q(
                categories__businesses__BUSN_ID__in=visited_ids or [],
            )),
        ).order_by("CLUS_NAME", "CLUS_ID")
        return [
            {"id": row.CLUS_ID, "name": row.CLUS_NAME, "eligible": row.eligible,
             "visited": row.visited if visited_ids is not None else None}
            for row in rows
        ]
