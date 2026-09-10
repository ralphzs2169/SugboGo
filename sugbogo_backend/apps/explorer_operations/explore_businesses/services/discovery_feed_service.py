from decimal import Decimal

from django.db.models import (
    DecimalField,
    Exists,
    OuterRef,
    Prefetch,
    Value,
)
from django.db.models.functions import Coalesce

from apps.business.models import (
    Business,
    BusinessPocket,
    BusinessSpecialtyTag,
    BusinessVouch,
)


class DiscoveryFeedService:
    """Builds the ranked business feed shown to Explorer users."""

    @staticmethod
    def list_discovery_businesses(
        user,
        category_id=None,
        cluster_id=None,
        specialty_tag_id=None,
    ):
        """Returns active businesses ordered by their current discovery score."""

        user_pocket_exists = BusinessPocket.objects.filter(
            BUSN_ID=OuterRef("BUSN_ID"),
            USER_ID=user,
        )

        user_vouch_exists = BusinessVouch.objects.filter(
            BUSN_ID=OuterRef("BUSN_ID"),
            USER_ID=user,
            TAG_ID=OuterRef("TAG_ID"),
        )

        active_specialties = (
            BusinessSpecialtyTag.objects
            .filter(
                BST_IS_ACTIVE=True,
            )
            .select_related(
                "TAG_ID",
            )
            .annotate(
                is_vouched=Exists(
                    user_vouch_exists,
                ),
            )
        )

        queryset = (
            Business.objects
            .select_related(
                "CTGRY_ID",
                "CTGRY_ID__CLUS_ID",
                "LOCT_ID",
            )
            .annotate(
                is_pocketed=Exists(
                    user_pocket_exists,
                ),
                discovery_rank_score=Coalesce(
                    "discovery_score__DSC_D_SCORE",
                    Value(
                        Decimal("0.00000"),
                    ),
                    output_field=DecimalField(
                        max_digits=6,
                        decimal_places=5,
                    ),
                ),
            )
            .prefetch_related(
                Prefetch(
                    "specialty_tag_links",
                    queryset=active_specialties,
                    to_attr="active_specialty_tag_links",
                ),
            )
            .filter(
                BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            )
        )

        if category_id is not None:
            queryset = queryset.filter(
                CTGRY_ID_id=category_id,
            )

        if cluster_id is not None:
            queryset = queryset.filter(
                CTGRY_ID__CLUS_ID_id=cluster_id,
            )

        if specialty_tag_id is not None:
            queryset = queryset.filter(
                specialty_tag_links__TAG_ID_id=specialty_tag_id,
                specialty_tag_links__BST_IS_ACTIVE=True,
            )

        return queryset.order_by(
            "-discovery_rank_score",
            "-BUSN_CREATED_AT",
            "BUSN_ID",
        )
