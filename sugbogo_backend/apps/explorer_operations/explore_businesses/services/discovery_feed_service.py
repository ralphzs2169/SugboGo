from decimal import Decimal

from apps.admin_operations.system_configuration.models import (
    DiscoveryAlgorithmConfiguration,
)
from apps.business.services.discovery_score_refresh_service import DiscoveryScoreRefreshService

from apps.business.models import (
    Business,
    BusinessPocket,
    BusinessSpecialtyTag,
    BusinessVouch,
)
from apps.business.services.display_cover_photo import display_cover_photo_expression
from apps.explorer_operations.explore_businesses.services.taxonomy_filter_service import (
    apply_taxonomy_filters,
)
from django.contrib.postgres.search import TrigramStrictWordSimilarity
from django.db.models import (
    Case,
    DecimalField,
    Exists,
    F,
    IntegerField,
    OuterRef,
    Prefetch,
    Q,
    Subquery,
    Value,
    When,
)
from django.db.models.functions import Coalesce, Greatest

from .published_review_count import published_review_count


class DiscoveryFeedService:
    """Builds the ranked business feed shown to Explorer users."""

    HIDDEN_GEM_LIMIT = 10
    FUZZY_MIN_QUERY_LENGTH = 4
    FUZZY_SHORT_QUERY_THRESHOLD = 0.55
    FUZZY_QUERY_THRESHOLD = 0.50
    FUZZY_LONG_NAME_QUERY_LENGTH = 8
    FUZZY_LONG_NAME_QUERY_THRESHOLD = 0.42
    DISCOVERY_ORDERING = (
        "-discovery_rank_score",
        "-BUSN_CREATED_AT",
        "BUSN_ID",
    )

    @staticmethod
    def list_eligible_businesses():
        """Return the active businesses eligible for public Explorer discovery."""
        return Business.objects.filter(
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
        )

    @staticmethod
    def list_ranked_businesses():
        """Order eligible businesses using persisted scores and stable tie-breakers."""
        return (
            DiscoveryFeedService.list_eligible_businesses()
            .annotate(
                discovery_rank_score=Coalesce(
                    "discovery_score__DSC_D_SCORE",
                    DiscoveryScoreRefreshService.missing_score_expression(),
                    output_field=DecimalField(
                        max_digits=6,
                        decimal_places=5,
                    ),
                ),
            )
            .order_by(
                *DiscoveryFeedService.DISCOVERY_ORDERING,
            )
        )

    @staticmethod
    def hidden_gem_eligibility():
        """Require measured components meeting configured Hidden Gem thresholds."""
        def threshold(field_name):
            """Read one threshold without creating singleton configuration on reads."""
            return Coalesce(
                Subquery(
                    DiscoveryAlgorithmConfiguration.objects.filter(
                        pk=1,
                    ).values(field_name)[:1],
                ),
                Value(
                    DiscoveryAlgorithmConfiguration._meta.get_field(
                        field_name,
                    ).get_default(),
                ),
                output_field=DecimalField(
                    max_digits=6,
                    decimal_places=5,
                ),
            )

        return Q(
            discovery_score__DSC_IS_PROVISIONAL=False,
            discovery_score__DSC_COMPUTED_AT__isnull=False,
            discovery_score__DSC_S_SCORE__gte=threshold(
                "DAC_HIDDEN_GEM_MIN_SPECIALTY_SCORE",
            ),
            discovery_score__DSC_V_SCORE__gte=threshold(
                "DAC_HIDDEN_GEM_MIN_VISIBILITY_GAP",
            ),
        )

    @staticmethod
    def list_global_hidden_gem_ids():
        """Return up to ten globally eligible Hidden Gems matching the homepage."""
        return (
            DiscoveryFeedService.list_ranked_businesses()
            .filter(
                DiscoveryFeedService.hidden_gem_eligibility(),
            )
            .values_list(
                "BUSN_ID",
                flat=True,
            )[:DiscoveryFeedService.HIDDEN_GEM_LIMIT]
        )

    @staticmethod
    def _fuzzy_search_businesses(
        queryset,
        search,
    ):
        """Match names and active taxonomy labels only after normal search misses."""

        taxonomy_threshold = DiscoveryFeedService.FUZZY_QUERY_THRESHOLD

        if len(search) == DiscoveryFeedService.FUZZY_MIN_QUERY_LENGTH:
            taxonomy_threshold = DiscoveryFeedService.FUZZY_SHORT_QUERY_THRESHOLD

        name_threshold = taxonomy_threshold

        # Longer misspellings can lose several trigrams; retain word boundaries
        # and stricter taxonomy thresholds to avoid broad category expansion.
        if len(search) >= DiscoveryFeedService.FUZZY_LONG_NAME_QUERY_LENGTH:
            name_threshold = DiscoveryFeedService.FUZZY_LONG_NAME_QUERY_THRESHOLD

        # Select one strongest active label rather than multiplying business rows.
        specialty_similarity = (
            BusinessSpecialtyTag.objects
            .filter(
                BUSN_ID=OuterRef("BUSN_ID"),
                BST_IS_ACTIVE=True,
            )
            .annotate(
                similarity=TrigramStrictWordSimilarity(
                    search,
                    "TAG_ID__TAG_NAME",
                ),
            )
            .order_by(
                "-similarity",
            )
            .values(
                "similarity",
            )[:1]
        )

        return queryset.annotate(
            taxonomy_similarity=Greatest(
                TrigramStrictWordSimilarity(
                    search,
                    "CTGRY_ID__CTGRY_NAME",
                ),
                Coalesce(
                    Subquery(
                        specialty_similarity,
                    ),
                    Value(0.0),
                ),
            ),
        ).annotate(
            search_similarity=Greatest(
                TrigramStrictWordSimilarity(
                    search,
                    "BUSN_NAME",
                ),
                # An unqualified taxonomy label must not boost name confidence.
                Case(
                    When(
                        taxonomy_similarity__gte=taxonomy_threshold,
                        then=F("taxonomy_similarity"),
                    ),
                    default=Value(0.0),
                ),
            ),
        ).filter(
            search_similarity__gte=name_threshold,
        )

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
            VOUCH_WITHDRAWN_AT__isnull=True,
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
            DiscoveryFeedService.list_ranked_businesses()
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
                published_review_count=published_review_count(),
                display_cover_photo_url=display_cover_photo_expression(),
            )
            .prefetch_related(
                Prefetch(
                    "specialty_tag_links",
                    queryset=active_specialties,
                    to_attr="active_specialty_tag_links",
                ),
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
            normal_matches = queryset.annotate(
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
            # Check the complete filtered query before pagination, not its page.
            if (
                len(normalized_search) >= DiscoveryFeedService.FUZZY_MIN_QUERY_LENGTH
                and not normal_matches.exists()
            ):
                queryset = DiscoveryFeedService._fuzzy_search_businesses(
                    queryset,
                    normalized_search,
                )
                ordering.append(
                    "-search_similarity",
                )
            else:
                queryset = normal_matches
                ordering.append(
                    "-search_relevance",
                )

        if specialty_tag_id is not None and rank_specialty_by_tag_score:
            ordering.append(
                "-selected_tag_score",
            )

        ordering.extend(
            DiscoveryFeedService.DISCOVERY_ORDERING,
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
        ).filter(
            DiscoveryFeedService.hidden_gem_eligibility(),
        )
