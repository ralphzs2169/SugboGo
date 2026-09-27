from decimal import Decimal

from apps.business.models import (
    Business,
    BusinessPocket,
    BusinessSpecialtyTag,
    BusinessVouch,
)
from apps.explorer_operations.explore_businesses.services.taxonomy_filter_service import (
    apply_taxonomy_filters,
)
from django.db.models import (
    Case,
    DecimalField,
    Exists,
    IntegerField,
    OuterRef,
    Prefetch,
    Q,
    Subquery,
    Value,
    When,
)
from django.db.models.functions import Coalesce


class DiscoveryFeedService:
    """Builds the ranked business feed shown to Explorer users."""

    @staticmethod
    def list_discovery_businesses(
        user,
        search="",
        category_ids=None,
        cluster_id=None,
        specialty_tag_id=None,
        rank_specialty_by_tag_score=True,
    ):
        """Returns active businesses ordered by their current discovery score."""

        normalized_search = search.strip()

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

        active_specialty_search = BusinessSpecialtyTag.objects.filter(
            BUSN_ID=OuterRef("BUSN_ID"),
            BST_IS_ACTIVE=True,
            TAG_ID__TAG_NAME__icontains=normalized_search,
        )

        selected_specialty = BusinessSpecialtyTag.objects.filter(
            BUSN_ID=OuterRef("BUSN_ID"),
            BST_IS_ACTIVE=True,
            TAG_ID_id=specialty_tag_id,
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

        queryset = apply_taxonomy_filters(
            queryset,
            category_ids=category_ids,
            cluster_id=cluster_id,
            specialty_tag_id=specialty_tag_id,
        )

        if specialty_tag_id is not None and rank_specialty_by_tag_score:
            queryset = queryset.annotate(
                selected_tag_score=Coalesce(
                    Subquery(
                        selected_specialty.values(
                            "BST_TAG_SCORE",
                        )[:1],
                    ),
                    Value(
                        Decimal("0.00000"),
                    ),
                    output_field=DecimalField(
                        max_digits=6,
                        decimal_places=5,
                    ),
                ),
            )

        ordering = []

        if normalized_search:
            queryset = queryset.annotate(
                active_specialty_search_match=Exists(
                    active_specialty_search,
                ),
            ).annotate(
                search_relevance=Case(
                    When(
                        BUSN_NAME__iexact=normalized_search,
                        then=Value(4),
                    ),
                    When(
                        BUSN_NAME__istartswith=normalized_search,
                        then=Value(3),
                    ),
                    When(
                        BUSN_NAME__icontains=normalized_search,
                        then=Value(2),
                    ),
                    When(
                        Q(
                            CTGRY_ID__CTGRY_NAME__icontains=normalized_search,
                        )
                        | Q(
                            CTGRY_ID__CLUS_ID__CLUS_NAME__icontains=(
                                normalized_search
                            ),
                        )
                        | Q(
                            active_specialty_search_match=True,
                        ),
                        then=Value(1),
                    ),
                    default=Value(0),
                    output_field=IntegerField(),
                ),
            ).filter(
                search_relevance__gt=0,
            )
            ordering.append(
                "-search_relevance",
            )

        if specialty_tag_id is not None and rank_specialty_by_tag_score:
            ordering.append(
                "-selected_tag_score",
            )

        ordering.extend(
            [
                "-discovery_rank_score",
                "-BUSN_CREATED_AT",
                "BUSN_ID",
            ],
        )

        return queryset.order_by(
            *ordering,
        )

    @staticmethod
    def list_hidden_gems(
        user,
        category_ids=None,
        cluster_id=None,
        specialty_tag_id=None,
    ):
        """Return the filtered Hidden Gems collection with pure Discovery ordering."""

        return DiscoveryFeedService.list_discovery_businesses(
            user=user,
            category_ids=category_ids,
            cluster_id=cluster_id,
            specialty_tag_id=specialty_tag_id,
            rank_specialty_by_tag_score=False,
        )
