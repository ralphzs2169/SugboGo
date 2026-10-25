from heapq import nsmallest

from apps.business.services.discovery_score_refresh_service import DiscoveryScoreRefreshService

from apps.admin_operations.system_configuration.services import (
    RecommendationAlgorithmConfigurationService,
)
from apps.business.models import (
    Business,
    BusinessPocket,
    BusinessSpecialtyTag,
    BusinessVouch,
)
from apps.business.services.display_cover_photo import display_cover_photo_expression
from apps.explorer_operations.explore_businesses.services.taxonomy_similarity import (
    build_business_feature_map,
    cosine_similarity,
)
from django.db.models import DecimalField, Exists, OuterRef, Prefetch, Q
from django.db.models.functions import Coalesce

from .published_review_count import published_review_count
from rest_framework.exceptions import NotFound


class SimilarBusinessService:
    """Find taxonomy-similar active businesses for a business profile."""

    RESULT_LIMIT = 4
    RANKING_CHUNK_SIZE = 500

    @staticmethod
    def _ranking_queryset():
        """Load only taxonomy identifiers and the existing discovery tie-breaker."""
        return (
            Business.objects
            .filter(
                BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            )
            .select_related(
                "CTGRY_ID",
            )
            .only(
                "BUSN_ID",
                "CTGRY_ID__CLUS_ID",
            )
            .annotate(
                similar_discovery_score=Coalesce(
                    "discovery_score__DSC_D_SCORE",
                    DiscoveryScoreRefreshService.missing_score_expression(),
                    output_field=DecimalField(
                        max_digits=6,
                        decimal_places=5,
                    ),
                ),
            )
            .prefetch_related(
                Prefetch(
                    "specialty_tag_links",
                    queryset=BusinessSpecialtyTag.objects.filter(
                        BST_IS_ACTIVE=True,
                    ).only(
                        "BUSN_ID",
                        "TAG_ID",
                    ),
                    to_attr="active_specialty_tag_links",
                ),
            )
        )

    @staticmethod
    def _business_queryset(user):
        """Hydrate selected active businesses with user-specific presentation data."""

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

        return (
            Business.objects
            .filter(
                BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            )
            .select_related(
                "CTGRY_ID",
                "CTGRY_ID__CLUS_ID",
                "LOCT_ID",
                "discovery_score",
                "review_summary",
            )
            .annotate(
                is_pocketed=Exists(
                    user_pocket_exists,
                ),
                published_review_count=published_review_count(),
                display_cover_photo_url=display_cover_photo_expression(),
                similar_discovery_score=Coalesce(
                    "discovery_score__DSC_D_SCORE",
                    DiscoveryScoreRefreshService.missing_score_expression(),
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
        )

    @staticmethod
    def list_similar_businesses(
        business_id,
        user,
    ):
        """Return up to four active businesses most similar to the selected business."""

        try:
            current_business = SimilarBusinessService._ranking_queryset().get(
                BUSN_ID=business_id,
            )
        except Business.DoesNotExist:
            raise NotFound(
                "The business could not be found.",
            )

        configuration = (
            RecommendationAlgorithmConfigurationService
            .get_current_configuration()
        )
        current_features = build_business_feature_map(
            current_business,
            configuration,
        )
        candidates = SimilarBusinessService._ranking_queryset().exclude(
            BUSN_ID=business_id,
        )
        threshold = float(configuration.RAC_MODERATE_MATCH_THRESHOLD)

        if threshold > 0:
            shared_specialty = BusinessSpecialtyTag.objects.filter(
                BUSN_ID=OuterRef("BUSN_ID"),
                BST_IS_ACTIVE=True,
                TAG_ID__in=[
                    link.TAG_ID_id
                    for link in current_business.active_specialty_tag_links
                ],
            )
            # No shared feature implies cosine zero, never a positive-threshold match.
            candidates = candidates.alias(
                shares_specialty=Exists(shared_specialty),
            ).filter(
                Q(CTGRY_ID=current_business.CTGRY_ID_id)
                | Q(CTGRY_ID__CLUS_ID=current_business.CTGRY_ID.CLUS_ID_id)
                | Q(shares_specialty=True),
            )

        def ranked_candidates():
            """Stream exact scores without retaining the full candidate catalogue."""
            for candidate in candidates.iterator(
                chunk_size=SimilarBusinessService.RANKING_CHUNK_SIZE,
            ):
                candidate_features = build_business_feature_map(
                    candidate,
                    configuration,
                )
                similarity = cosine_similarity(
                    current_features,
                    candidate_features,
                )
                if similarity < threshold:
                    continue
                yield candidate, similarity

        ranked_businesses = nsmallest(
            SimilarBusinessService.RESULT_LIMIT,
            ranked_candidates(),
            key=lambda item: (
                -item[1],
                -item[0].similar_discovery_score,
                item[0].BUSN_ID,
            ),
        )

        ranked_ids = [
            business.BUSN_ID
            for business, _ in ranked_businesses
        ]
        if not ranked_ids:
            return []

        selected_businesses = SimilarBusinessService._business_queryset(user).filter(
            BUSN_ID__in=ranked_ids,
        )
        hydrated = {
            business.BUSN_ID: business
            for business in selected_businesses
        }
        return [
            hydrated[business_id]
            for business_id in ranked_ids
            if business_id in hydrated
        ]
