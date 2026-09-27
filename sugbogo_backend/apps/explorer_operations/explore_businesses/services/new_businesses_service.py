from apps.business.models import (
    Business,
    BusinessPocket,
    BusinessSpecialtyTag,
    BusinessVouch,
)
from apps.explorer_operations.explore_businesses.services.taxonomy_filter_service import (
    apply_taxonomy_filters,
)
from django.db.models import Exists, OuterRef, Prefetch


class NewBusinessesService:
    """Service class for retrieving newly added businesses for Explorer."""

    @staticmethod
    def list_new_businesses(
        user,
        category_ids=None,
        cluster_id=None,
        specialty_tag_id=None,
    ):
        """Retrieve active businesses with the current user's interaction state."""

        user_pocket_exists = BusinessPocket.objects.filter(
            BUSN_ID=OuterRef("BUSN_ID"),
            USER_ID=user,
        )

        user_vouch_exists = BusinessVouch.objects.filter(
            BUSN_ID=OuterRef("BUSN_ID"),
            USER_ID=user,
            TAG_ID=OuterRef("TAG_ID"),
        )

        specialty_tags = (
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
                "review_summary",
            )
            .annotate(
                is_pocketed=Exists(
                    user_pocket_exists,
                ),
            )
            .prefetch_related(
                Prefetch(
                    "specialty_tag_links",
                    queryset=specialty_tags,
                    to_attr="active_specialty_tag_links",
                ),
            )
            .filter(
                BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            )
        )

        queryset = apply_taxonomy_filters(
            queryset,
            category_ids=category_ids,
            cluster_id=cluster_id,
            specialty_tag_id=specialty_tag_id,
        )

        return queryset.order_by(
            "-BUSN_CREATED_AT",
            "BUSN_ID",
        )
