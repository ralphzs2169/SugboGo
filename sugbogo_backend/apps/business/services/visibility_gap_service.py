from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal, localcontext
from enum import StrEnum

from django.utils import timezone
from rest_framework.exceptions import NotFound

from apps.admin_operations.system_configuration.models import (
    DiscoveryAlgorithmConfiguration,
)
from apps.admin_operations.system_configuration.services.discovery_algorithm_configuration_service import (
    DiscoveryAlgorithmConfigurationService,
)
from apps.business.models import Business
from apps.business.services.visibility_event_service import (
    VisibilityEventService,
)


class VisibilityComparisonLevel(StrEnum):
    CATEGORY = "CATEGORY"
    CLUSTER = "CLUSTER"
    PLATFORM = "PLATFORM"


@dataclass(frozen=True)
class EligibleBusinessIdentity:
    """Stores the taxonomy IDs needed to select a comparison group."""

    business_id: int
    category_id: int
    cluster_id: int


@dataclass(frozen=True)
class VisibilityComparisonGroup:
    """Describes the active businesses used for visibility comparison."""

    level: VisibilityComparisonLevel
    identity: int | None
    business_ids: tuple[int, ...]


@dataclass(frozen=True)
class VisibilityGapResult:
    """Stores the explainable Visibility Gap result for one business."""

    business_id: int
    comparison_group_level: VisibilityComparisonLevel
    comparison_group_size: int
    window_start: datetime
    window_end: datetime
    impression_count: int
    profile_visit_count: int
    unique_saver_count: int
    maximum_impression_count: int
    maximum_profile_visit_count: int
    maximum_unique_saver_count: int
    normalized_impressions: Decimal
    normalized_profile_visits: Decimal
    normalized_saves: Decimal
    traction: Decimal
    visibility_gap: Decimal


class VisibilityGapService:
    """Calculates recent underexposure for active businesses."""

    CALCULATION_PRECISION = 40
    SCORE_QUANTUM = Decimal("0.00001")
    ZERO = Decimal("0")
    ONE = Decimal("1")

    @staticmethod
    def _clamp_score(
        score: Decimal,
    ) -> Decimal:
        """Keeps a calculated score between zero and one."""

        return min(
            VisibilityGapService.ONE,
            max(
                VisibilityGapService.ZERO,
                score,
            ),
        )

    @staticmethod
    def _quantize_score(
        score: Decimal,
    ) -> Decimal:
        """Rounds a score to the current five-decimal score precision."""

        clamped_score = VisibilityGapService._clamp_score(
            score,
        )

        with localcontext() as context:
            context.prec = VisibilityGapService.CALCULATION_PRECISION

            return clamped_score.quantize(
                VisibilityGapService.SCORE_QUANTUM,
                rounding=ROUND_HALF_UP,
            )

    @staticmethod
    def normalize_signal(
        business_value: int | Decimal,
        maximum_value: int | Decimal,
    ) -> Decimal:
        """Normalizes one visibility signal against its group maximum."""

        decimal_maximum = Decimal(maximum_value)

        if decimal_maximum <= VisibilityGapService.ZERO:
            return VisibilityGapService.ZERO

        with localcontext() as context:
            context.prec = VisibilityGapService.CALCULATION_PRECISION
            normalized_signal = (
                Decimal(business_value)
                / decimal_maximum
            )

        return VisibilityGapService._clamp_score(
            normalized_signal,
        )

    @staticmethod
    def calculate_traction(
        normalized_impressions: Decimal,
        normalized_profile_visits: Decimal,
        normalized_saves: Decimal,
        impression_weight: Decimal,
        profile_visit_weight: Decimal,
        save_weight: Decimal,
    ) -> Decimal:
        """Combines normalized signals using the configured weights."""

        with localcontext() as context:
            context.prec = VisibilityGapService.CALCULATION_PRECISION
            traction = (
                Decimal(impression_weight)
                * Decimal(normalized_impressions)
                + Decimal(profile_visit_weight)
                * Decimal(normalized_profile_visits)
                + Decimal(save_weight)
                * Decimal(normalized_saves)
            )

        return VisibilityGapService._clamp_score(
            traction,
        )

    @staticmethod
    def calculate_visibility_gap(
        traction: Decimal,
    ) -> Decimal:
        """Converts traction into its inverse Visibility Gap score."""

        visibility_gap = (
            VisibilityGapService.ONE
            - Decimal(traction)
        )

        return VisibilityGapService._clamp_score(
            visibility_gap,
        )

    @staticmethod
    def _load_eligible_businesses() -> list[EligibleBusinessIdentity]:
        """Loads active business IDs and their category and cluster IDs."""

        rows = (
            Business.objects.filter(
                BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            )
            .order_by(
                "BUSN_ID",
            )
            .values_list(
                "BUSN_ID",
                "CTGRY_ID_id",
                "CTGRY_ID__CLUS_ID_id",
            )
        )

        return [
            EligibleBusinessIdentity(
                business_id=business_id,
                category_id=category_id,
                cluster_id=cluster_id,
            )
            for business_id, category_id, cluster_id in rows
        ]

    @staticmethod
    def _build_group_maps(
        eligible_businesses: Iterable[EligibleBusinessIdentity],
    ) -> tuple[
        dict[int, list[int]],
        dict[int, list[int]],
        tuple[int, ...],
    ]:
        """Groups active business IDs by category and cluster."""

        category_business_ids = {}
        cluster_business_ids = {}
        platform_business_ids = []

        for business in eligible_businesses:
            category_business_ids.setdefault(
                business.category_id,
                [],
            ).append(
                business.business_id,
            )
            cluster_business_ids.setdefault(
                business.cluster_id,
                [],
            ).append(
                business.business_id,
            )
            platform_business_ids.append(
                business.business_id,
            )

        return (
            category_business_ids,
            cluster_business_ids,
            tuple(
                platform_business_ids,
            ),
        )

    @staticmethod
    def select_comparison_group(
        business: EligibleBusinessIdentity,
        category_business_ids: dict[int, list[int]],
        cluster_business_ids: dict[int, list[int]],
        platform_business_ids: tuple[int, ...],
        minimum_category_size: int,
        minimum_cluster_size: int,
    ) -> VisibilityComparisonGroup:
        """Selects the category, cluster, or platform comparison group."""

        category_ids = category_business_ids[
            business.category_id
        ]

        if len(category_ids) >= minimum_category_size:
            return VisibilityComparisonGroup(
                level=VisibilityComparisonLevel.CATEGORY,
                identity=business.category_id,
                business_ids=tuple(
                    category_ids,
                ),
            )

        cluster_ids = cluster_business_ids[
            business.cluster_id
        ]

        if len(cluster_ids) >= minimum_cluster_size:
            return VisibilityComparisonGroup(
                level=VisibilityComparisonLevel.CLUSTER,
                identity=business.cluster_id,
                business_ids=tuple(
                    cluster_ids,
                ),
            )

        return VisibilityComparisonGroup(
            level=VisibilityComparisonLevel.PLATFORM,
            identity=None,
            business_ids=platform_business_ids,
        )

    @staticmethod
    def _empty_metrics() -> dict[str, int]:
        """Returns zero values for a business with no recent events."""

        return {
            "impression_count": 0,
            "profile_visit_count": 0,
            "save_event_count": 0,
            "unique_saver_count": 0,
        }

    @staticmethod
    def _calculate_group_maxima(
        business_ids: Iterable[int],
        metrics_by_business_id: dict[int, dict[str, int]],
    ) -> tuple[int, int, int]:
        """Finds the separate maximum value for each visibility signal."""

        maximum_impression_count = 0
        maximum_profile_visit_count = 0
        maximum_unique_saver_count = 0

        for business_id in business_ids:
            metrics = metrics_by_business_id.get(
                business_id,
                VisibilityGapService._empty_metrics(),
            )
            maximum_impression_count = max(
                maximum_impression_count,
                metrics.get(
                    "impression_count",
                    0,
                ),
            )
            maximum_profile_visit_count = max(
                maximum_profile_visit_count,
                metrics.get(
                    "profile_visit_count",
                    0,
                ),
            )
            maximum_unique_saver_count = max(
                maximum_unique_saver_count,
                metrics.get(
                    "unique_saver_count",
                    0,
                ),
            )

        return (
            maximum_impression_count,
            maximum_profile_visit_count,
            maximum_unique_saver_count,
        )

    @classmethod
    def _build_result(
        cls,
        business_id: int,
        comparison_group: VisibilityComparisonGroup,
        metrics_by_business_id: dict[int, dict[str, int]],
        window_start: datetime,
        window_end: datetime,
        impression_weight: Decimal,
        profile_visit_weight: Decimal,
        save_weight: Decimal,
    ) -> VisibilityGapResult:
        """Builds one explainable Visibility Gap result."""

        target_metrics = metrics_by_business_id.get(
            business_id,
            cls._empty_metrics(),
        )
        impression_count = target_metrics.get(
            "impression_count",
            0,
        )
        profile_visit_count = target_metrics.get(
            "profile_visit_count",
            0,
        )
        unique_saver_count = target_metrics.get(
            "unique_saver_count",
            0,
        )
        (
            maximum_impression_count,
            maximum_profile_visit_count,
            maximum_unique_saver_count,
        ) = cls._calculate_group_maxima(
            business_ids=comparison_group.business_ids,
            metrics_by_business_id=metrics_by_business_id,
        )
        normalized_impressions = cls.normalize_signal(
            business_value=impression_count,
            maximum_value=maximum_impression_count,
        )
        normalized_profile_visits = cls.normalize_signal(
            business_value=profile_visit_count,
            maximum_value=maximum_profile_visit_count,
        )
        normalized_saves = cls.normalize_signal(
            business_value=unique_saver_count,
            maximum_value=maximum_unique_saver_count,
        )
        traction = cls.calculate_traction(
            normalized_impressions=normalized_impressions,
            normalized_profile_visits=normalized_profile_visits,
            normalized_saves=normalized_saves,
            impression_weight=impression_weight,
            profile_visit_weight=profile_visit_weight,
            save_weight=save_weight,
        )
        visibility_gap = cls.calculate_visibility_gap(
            traction=traction,
        )

        return VisibilityGapResult(
            business_id=business_id,
            comparison_group_level=comparison_group.level,
            comparison_group_size=len(
                comparison_group.business_ids,
            ),
            window_start=window_start,
            window_end=window_end,
            impression_count=impression_count,
            profile_visit_count=profile_visit_count,
            unique_saver_count=unique_saver_count,
            maximum_impression_count=maximum_impression_count,
            maximum_profile_visit_count=maximum_profile_visit_count,
            maximum_unique_saver_count=maximum_unique_saver_count,
            normalized_impressions=cls._quantize_score(
                normalized_impressions,
            ),
            normalized_profile_visits=cls._quantize_score(
                normalized_profile_visits,
            ),
            normalized_saves=cls._quantize_score(
                normalized_saves,
            ),
            traction=cls._quantize_score(
                traction,
            ),
            visibility_gap=cls._quantize_score(
                visibility_gap,
            ),
        )

    @classmethod
    def calculate_visibility_gaps(
        cls,
        business_ids: Iterable[int] | None = None,
        reference_time: datetime | None = None,
        configuration: DiscoveryAlgorithmConfiguration | None = None,
    ) -> tuple[VisibilityGapResult, ...]:
        """Calculates Visibility Gap results for active businesses."""

        if reference_time is None:
            reference_time = timezone.now()

        if configuration is None:
            configuration = (
                DiscoveryAlgorithmConfigurationService
                .get_current_configuration()
            )
        window_end = reference_time
        window_start = window_end - timedelta(
            days=configuration.DAC_VISIBILITY_WINDOW_DAYS,
        )
        eligible_businesses = cls._load_eligible_businesses()
        businesses_by_id = {
            business.business_id: business
            for business in eligible_businesses
        }

        if business_ids is None:
            target_business_ids = tuple(
                businesses_by_id,
            )
        else:
            target_business_ids = tuple(
                sorted(
                    set(
                        business_ids,
                    ),
                ),
            )

        missing_business_ids = [
            business_id
            for business_id in target_business_ids
            if business_id not in businesses_by_id
        ]

        if missing_business_ids:
            raise NotFound(
                "One or more active businesses could not be found.",
            )

        (
            category_business_ids,
            cluster_business_ids,
            platform_business_ids,
        ) = cls._build_group_maps(
            eligible_businesses,
        )
        groups_by_target_business_id = {}
        metrics_by_group_key = {}

        for business_id in target_business_ids:
            business = businesses_by_id[
                business_id
            ]
            comparison_group = cls.select_comparison_group(
                business=business,
                category_business_ids=category_business_ids,
                cluster_business_ids=cluster_business_ids,
                platform_business_ids=platform_business_ids,
                minimum_category_size=(
                    configuration.DAC_MIN_CATEGORY_COMPARISON_SIZE
                ),
                minimum_cluster_size=(
                    configuration.DAC_MIN_CLUSTER_COMPARISON_SIZE
                ),
            )
            group_key = (
                comparison_group.level,
                comparison_group.identity,
            )
            groups_by_target_business_id[
                business_id
            ] = comparison_group

            if group_key not in metrics_by_group_key:
                metrics_by_group_key[group_key] = (
                    VisibilityEventService
                    .get_recent_visibility_metrics(
                        business_ids=comparison_group.business_ids,
                        start_time=window_start,
                        end_time=window_end,
                    )
                )

        return tuple(
            cls._build_result(
                business_id=business_id,
                comparison_group=groups_by_target_business_id[
                    business_id
                ],
                metrics_by_business_id=metrics_by_group_key[
                    (
                        groups_by_target_business_id[
                            business_id
                        ].level,
                        groups_by_target_business_id[
                            business_id
                        ].identity,
                    )
                ],
                window_start=window_start,
                window_end=window_end,
                impression_weight=configuration.DAC_IMPRESSION_WEIGHT,
                profile_visit_weight=(
                    configuration.DAC_PROFILE_VISIT_WEIGHT
                ),
                save_weight=configuration.DAC_SAVE_WEIGHT,
            )
            for business_id in target_business_ids
        )

    @classmethod
    def calculate_business_visibility_gap(
        cls,
        business_id: int,
        reference_time: datetime | None = None,
        configuration: DiscoveryAlgorithmConfiguration | None = None,
    ) -> VisibilityGapResult:
        """Calculates Visibility Gap for one active business."""

        results = cls.calculate_visibility_gaps(
            business_ids=[
                business_id,
            ],
            reference_time=reference_time,
            configuration=configuration,
        )

        return results[0]
