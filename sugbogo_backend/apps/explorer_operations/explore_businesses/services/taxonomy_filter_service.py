from django.db.models import Exists, OuterRef

from apps.business.models import BusinessSpecialtyTag


def apply_taxonomy_filters(
    queryset,
    category_ids=None,
    cluster_id=None,
    specialty_tag_id=None,
):
    """Narrow a business queryset without defining its ranking."""

    if category_ids:
        queryset = queryset.filter(
            CTGRY_ID_id__in=category_ids,
        )

    if cluster_id is not None:
        queryset = queryset.filter(
            CTGRY_ID__CLUS_ID_id=cluster_id,
        )

    if specialty_tag_id is not None:
        active_specialty = BusinessSpecialtyTag.objects.filter(
            BUSN_ID=OuterRef("BUSN_ID"),
            BST_IS_ACTIVE=True,
            TAG_ID_id=specialty_tag_id,
        )
        queryset = queryset.annotate(
            taxonomy_specialty_match=Exists(
                active_specialty,
            ),
        ).filter(
            taxonomy_specialty_match=True,
        )

    return queryset


def business_matches_taxonomy(
    business,
    category_ids=None,
    cluster_id=None,
    specialty_tag_id=None,
):
    """Apply the same taxonomy semantics to an eagerly loaded business."""

    if category_ids and business.CTGRY_ID_id not in category_ids:
        return False

    if (
        cluster_id is not None
        and business.CTGRY_ID.CLUS_ID_id != cluster_id
    ):
        return False

    if specialty_tag_id is not None:
        active_specialty_ids = {
            link.TAG_ID_id
            for link in business.active_specialty_tag_links
        }

        if specialty_tag_id not in active_specialty_ids:
            return False

    return True
