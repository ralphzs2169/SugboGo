import logging
from collections import Counter, defaultdict
from decimal import Decimal
from enum import IntEnum

from apps.admin_operations.system_configuration.services import (
    RecommendationAlgorithmConfigurationService,
)
from apps.business.models import (
    Business,
    BusinessPocket,
    BusinessSpecialtyTag,
    BusinessVouch,
)
from apps.business.services.visibility_event_service import (
    VisibilityEventService,
    VisibilityTrackingUnavailable,
)
from apps.explorer_operations.explore_businesses.services.discovery_feed_service import (
    DiscoveryFeedService,
)
from apps.explorer_operations.explore_businesses.services.taxonomy_similarity import (
    FeatureMap,
    build_business_feature_map,
    cosine_similarity,
)
from apps.explorer_operations.explore_businesses.services.taxonomy_filter_service import (
    business_matches_taxonomy,
)
from apps.users.models import UserCategoryInterest, UserSpecialtyTagInterest
from django.db.models import DecimalField, Exists, OuterRef, Prefetch, Value
from django.db.models.functions import Coalesce

logger = logging.getLogger(__name__)


class RelevanceGroup(IntEnum):
    NO_MATCH = 0
    LOW = 1
    MODERATE = 2
    HIGH = 3


def classify_relevance(
    similarity: float,
    configuration,
) -> RelevanceGroup:
    """Classifies the relevance of a business to a user based on similarity score."""
    if similarity >= float(configuration.RAC_HIGH_MATCH_THRESHOLD):
        return RelevanceGroup.HIGH

    if similarity >= float(configuration.RAC_MODERATE_MATCH_THRESHOLD):
        return RelevanceGroup.MODERATE

    if similarity > 0:
        return RelevanceGroup.LOW

    return RelevanceGroup.NO_MATCH


def recommendation_sort_key(item):
    """Build the deterministic sort key used to rank recommendations."""

    business, relevance_group, similarity = item

    return (
        -int(relevance_group),
        -business.recommendation_visibility_gap,
        -similarity,
        -business.recommendation_discovery_score,
        business.BUSN_ID,
    )


class RecommendationService:
    """Builds deterministic content-based recommendations for one user."""

    REASON_FEATURE_TYPES = (
        "tag",
        "category",
        "cluster",
    )

    @staticmethod
    def build_business_feature_map(
        business,
        configuration,
    ) -> FeatureMap:
        """Build the weighted taxonomy feature map for a business."""

        return build_business_feature_map(
            business,
            configuration,
        )

    @staticmethod
    def build_recommendation_reason(
        explorer_features,
        business,
        business_features,
    ):
        """Select the strongest shared taxonomy feature explaining a recommendation."""

        for feature_type in RecommendationService.REASON_FEATURE_TYPES:
            matching_features = [
                (
                    feature_id,
                    explorer_value,
                )
                for (
                    candidate_type,
                    feature_id,
                ), explorer_value in explorer_features.items()
                if candidate_type == feature_type
                and (
                    feature_type,
                    feature_id,
                ) in business_features
            ]

            if not matching_features:
                continue

            feature_id, _ = min(
                matching_features,
                key=lambda match: (
                    -match[1],
                    match[0],
                ),
            )

            if feature_type == "tag":
                matching_link = next(
                    link
                    for link in business.active_specialty_tag_links
                    if link.TAG_ID_id == feature_id
                )
                reason_type = "specialty_tag"
                label = matching_link.TAG_ID.TAG_NAME
            elif feature_type == "category":
                reason_type = "category"
                label = business.CTGRY_ID.CTGRY_NAME
            else:
                reason_type = "cluster"
                label = business.CTGRY_ID.CLUS_ID.CLUS_NAME

            return {
                "type": reason_type,
                "id": feature_id,
                "label": label,
            }

        return None

    @staticmethod
    def _candidate_queryset(user):
        """Build the optimized active-business queryset used for recommendations."""

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
            .filter(BST_IS_ACTIVE=True)
            .select_related("TAG_ID")
            .annotate(
                is_vouched=Exists(user_vouch_exists),
            )
        )

        return (
            Business.objects
            .filter(BUSN_STATUS=Business.BusinessStatus.ACTIVE)
            .select_related(
                "CTGRY_ID",
                "CTGRY_ID__CLUS_ID",
                "LOCT_ID",
                "discovery_score",
                "review_summary",
            )
            .annotate(
                is_pocketed=Exists(user_pocket_exists),
                recommendation_visibility_gap=Coalesce(
                    "discovery_score__DSC_V_SCORE",
                    Value(Decimal("0.00000")),
                    output_field=DecimalField(
                        max_digits=6,
                        decimal_places=5,
                    ),
                ),
                recommendation_discovery_score=Coalesce(
                    "discovery_score__DSC_D_SCORE",
                    Value(Decimal("0.00000")),
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
    def _add_business_features(
        explorer_features,
        business,
        configuration,
        strength,
    ):
        business_features = RecommendationService.build_business_feature_map(
            business,
            configuration,
        )

        for feature, value in business_features.items():
            explorer_features[feature] += value * strength

    @staticmethod
    def build_explorer_feature_map(
        user,
        businesses,
        configuration,
    ) -> FeatureMap:
        """Build the explorer feature map from explicit and learned interests."""

        features = defaultdict(Decimal)

        category_interests = (
            UserCategoryInterest.objects
            .filter(USER_ID=user)
            .select_related("CTGRY_ID__CLUS_ID")
        )
        for interest in category_interests:
            features[("category", interest.CTGRY_ID_id)] += (
                configuration.RAC_CATEGORY_WEIGHT
            )
            features[("cluster", interest.CTGRY_ID.CLUS_ID_id)] += (
                configuration.RAC_CLUSTER_WEIGHT
            )

        specialty_tag_ids = UserSpecialtyTagInterest.objects.filter(
            USER_ID=user,
        ).values_list(
            "TAG_ID_id",
            flat=True,
        )
        for specialty_tag_id in specialty_tag_ids:
            features[("tag", specialty_tag_id)] += (
                configuration.RAC_SPECIALTY_TAG_WEIGHT
            )

        businesses_by_id = {
            business.BUSN_ID: business
            for business in businesses
        }

        pocket_business_ids = BusinessPocket.objects.filter(
            USER_ID=user,
            BUSN_ID_id__in=businesses_by_id,
        ).values_list(
            "BUSN_ID_id",
            flat=True,
        )
        for business_id in pocket_business_ids:
            RecommendationService._add_business_features(
                features,
                businesses_by_id[business_id],
                configuration,
                configuration.RAC_POCKET_STRENGTH,
            )

        valid_vouch_tag_ids = BusinessVouch.objects.filter(
            USER_ID=user,
            VOUCH_EVIDENCE_IS_VALID=True,
        ).values_list(
            "TAG_ID_id",
            flat=True,
        )
        for specialty_tag_id in valid_vouch_tag_ids:
            features[("tag", specialty_tag_id)] += (
                configuration.RAC_SPECIALTY_TAG_WEIGHT
                * configuration.RAC_SPECIALTY_VOUCH_STRENGTH
            )

        try:
            profile_visit_business_ids = (
                VisibilityEventService.get_profile_visit_business_ids(
                    explorer_id=user.USER_ID,
                )
            )
        except VisibilityTrackingUnavailable as exc:
            if exc.cooldown_short_circuit:
                logger.debug(
                    (
                        "Recommendations continuing without profile visits "
                        "for user %s during the MongoDB cooldown."
                    ),
                    user.USER_ID,
                )
            else:
                logger.warning(
                    (
                        "Recommendations continuing without profile visits "
                        "for user %s after a MongoDB availability failure."
                    ),
                    user.USER_ID,
                )
            profile_visit_business_ids = []

        profile_visit_counts = Counter(profile_visit_business_ids)
        for business_id, count in profile_visit_counts.items():
            business = businesses_by_id.get(business_id)

            if business is None:
                continue

            RecommendationService._add_business_features(
                features,
                business,
                configuration,
                configuration.RAC_PROFILE_VISIT_STRENGTH * count,
            )

        return {
            feature: value
            for feature, value in features.items()
            if value != 0
        }

    @staticmethod
    def list_recommendations(
        user,
        allow_discovery_fallback=True,
    ):
        """Return active businesses ranked by relevance to the explorer."""

        configuration = (
            RecommendationAlgorithmConfigurationService
            .get_current_configuration()
        )
        businesses = list(
            RecommendationService._candidate_queryset(user),
        )
        explorer_features = RecommendationService.build_explorer_feature_map(
            user,
            businesses,
            configuration,
        )

        if not explorer_features:
            if allow_discovery_fallback:
                return DiscoveryFeedService.list_discovery_businesses(user)

            return []

        ranked_businesses = []

        for business in businesses:
            business_features = (
                RecommendationService.build_business_feature_map(
                    business,
                    configuration,
                )
            )
            similarity = cosine_similarity(
                explorer_features,
                business_features,
            )
            relevance_group = classify_relevance(
                similarity,
                configuration,
            )

            if relevance_group == RelevanceGroup.NO_MATCH:
                continue

            business.recommendation_reason = (
                RecommendationService.build_recommendation_reason(
                    explorer_features=explorer_features,
                    business=business,
                    business_features=business_features,
                )
            )

            ranked_businesses.append(
                (
                    business,
                    relevance_group,
                    similarity,
                ),
            )

        ranked_businesses.sort(
            key=recommendation_sort_key,
        )

        return [
            business
            for business, _, _ in ranked_businesses
        ]

    @staticmethod
    def list_recommendation_collection(
        user,
        category_ids=None,
        cluster_id=None,
        specialty_tag_id=None,
    ):
        """Return genuine recommendation matches narrowed by taxonomy."""

        recommendations = RecommendationService.list_recommendations(
            user,
            allow_discovery_fallback=False,
        )

        return [
            business
            for business in recommendations
            if business_matches_taxonomy(
                business,
                category_ids=category_ids,
                cluster_id=cluster_id,
                specialty_tag_id=specialty_tag_id,
            )
        ]
