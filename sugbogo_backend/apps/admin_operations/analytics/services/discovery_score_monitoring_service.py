"""Discovery score monitoring queries for administrators."""

from django.db.models import Prefetch

from apps.business.models import BusinessSpecialtyTag, DiscoveryScore
from apps.business.services.discovery_score_service import DiscoveryScoreService


class DiscoveryScoreMonitoringService:
    """Provides persisted score records and delegates recomputation."""

    @staticmethod
    def list_scores(
        search=None,
        status=None,
        cluster=None,
        category=None,
        specialty_tag=None,
        ordering=None,
    ):
        """Return scored businesses with identity relations loaded in batches."""

        active_tags = (
            BusinessSpecialtyTag.objects
            .filter(BST_IS_ACTIVE=True)
            .select_related("TAG_ID")
        )
        queryset = (
            DiscoveryScore.objects
            .select_related(
                "BUSN_ID",
                "BUSN_ID__CTGRY_ID",
                "BUSN_ID__CTGRY_ID__CLUS_ID",
            )
            .prefetch_related(
                Prefetch(
                    "BUSN_ID__specialty_tag_links",
                    queryset=active_tags,
                    to_attr="active_specialty_tag_links",
                ),
            )
        )

        if search:
            queryset = queryset.filter(BUSN_ID__BUSN_NAME__icontains=search)
        if status:
            queryset = queryset.filter(BUSN_ID__BUSN_STATUS=status)
        if cluster:
            queryset = queryset.filter(BUSN_ID__CTGRY_ID__CLUS_ID=cluster)
        if category:
            queryset = queryset.filter(BUSN_ID__CTGRY_ID=category)
        if specialty_tag:
            queryset = queryset.filter(
                BUSN_ID__specialty_tag_links__TAG_ID=specialty_tag,
                BUSN_ID__specialty_tag_links__BST_IS_ACTIVE=True,
            )

        ordering_map = {
            "business_name": "BUSN_ID__BUSN_NAME",
            "-business_name": "-BUSN_ID__BUSN_NAME",
            "specialty_score": "DSC_S_SCORE",
            "-specialty_score": "-DSC_S_SCORE",
            "visibility_gap": "DSC_V_SCORE",
            "-visibility_gap": "-DSC_V_SCORE",
            "discovery_score": "DSC_D_SCORE",
            "-discovery_score": "-DSC_D_SCORE",
            "computed_at": "DSC_COMPUTED_AT",
            "-computed_at": "-DSC_COMPUTED_AT",
        }
        return queryset.order_by(
            ordering_map.get(ordering, "-DSC_COMPUTED_AT"),
            "DSC_ID",
        )

    @staticmethod
    def recompute_scores():
        """Run the same batch service used by the scheduled task."""

        result = DiscoveryScoreService.recompute_business_scores()
        return {
            "considered": result.considered_count,
            "updated": result.updated_count,
            "skipped_stale": result.stale_count,
            "failed": result.failed_count,
            "failed_business_ids": [
                failure.business_id
                for failure in result.failures
            ],
        }
