from apps.business.models import Business, ClusterDiscoveryShortcut
from django.db.models import Count, Q


class ClusterDiscoveryShortcutService:
    @staticmethod
    def list_active_shortcuts():
        return (
            ClusterDiscoveryShortcut.objects.select_related("CLUS_ID")
            .annotate(
                business_count=Count(
                    "CLUS_ID__categories__businesses",
                    filter=Q(
                        CLUS_ID__categories__businesses__BUSN_STATUS=(
                            Business.BusinessStatus.ACTIVE
                        ),
                    ),
                    distinct=True,
                ),
            )
            .filter(
                CDS_IS_ACTIVE=True,
                business_count__gt=0,
            )
            .order_by("-business_count", "CLUS_ID_id")
        )
