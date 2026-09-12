from decimal import Decimal

from apps.admin_operations.system_configuration.services import (
    RecommendationAlgorithmConfigurationService,
)
from apps.business.models import (
    Business,
    BusinessPocket,
    BusinessSpecialtyTag,
    BusinessVouch,
)
from apps.explorer_operations.explore_businesses.services.taxonomy_similarity import (
    build_business_feature_map,
    cosine_similarity,
)
from django.db.models import DecimalField, Exists, OuterRef, Prefetch, Value
from django.db.models.functions import Coalesce
from rest_framework.exceptions import NotFound


class SimilarBusinessService:
    """Find taxonomy-similar active businesses for a business profile."""

    RESULT_LIMIT = 4

    @staticmethod
    def _business_queryset(user):
        """Build the optimized active-business queryset used for similarity ranking."""
        
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
            )
            .annotate(
                is_pocketed=Exists(
                    user_pocket_exists,
                ),
                similar_discovery_score=Coalesce(
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
        )

    @staticmethod
    def list_similar_businesses(
        business_id,
        user,
    ):
        """Return up to four active businesses most similar to the selected business."""

        try:
            current_business = SimilarBusinessService._business_queryset(
                user,
            ).get(
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
        ranked_businesses = []

        candidates = SimilarBusinessService._business_queryset(user).exclude(
            BUSN_ID=business_id,
        )

        for candidate in candidates:
            candidate_features = build_business_feature_map(
                candidate,
                configuration,
            )
            similarity = cosine_similarity(
                current_features,
                candidate_features,
            )

            if similarity < float(
                configuration.RAC_MODERATE_MATCH_THRESHOLD,
            ):
                continue

            ranked_businesses.append(
                (
                    candidate,
                    similarity,
                ),
            )

        ranked_businesses.sort(
            key=lambda item: (
                -item[1],
                -item[0].similar_discovery_score,
                item[0].BUSN_ID,
            ),
        )

        return [
            business
            for business, _ in ranked_businesses[
                :SimilarBusinessService.RESULT_LIMIT
            ]
        ]
