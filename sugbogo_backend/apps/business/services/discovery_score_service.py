from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP, localcontext

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound

from apps.admin_operations.system_configuration.models import (
    DiscoveryAlgorithmConfiguration,
)
from apps.admin_operations.system_configuration.services.discovery_algorithm_configuration_service import (
    DiscoveryAlgorithmConfigurationService,
)
from apps.business.models import Business, DiscoveryScore
from apps.business.services.specialty_score_service import (
    BusinessSpecialtyScore,
    PersistedTagScore,
    SpecialtyScoreService,
)
from apps.business.services.visibility_gap_service import (
    VisibilityComparisonLevel,
    VisibilityGapResult,
    VisibilityGapService,
)


@dataclass(frozen=True)
class DiscoveryScoreResult:
    """Stores the explainable current discovery result for one business."""

    business_id: int
    reference_time: datetime
    specialty_score: Decimal
    visibility_gap: Decimal
    discovery_score: Decimal
    active_specialty_count: int
    expected_active_specialty_count: int
    has_expected_active_specialty_count: bool
    tag_scores: tuple[PersistedTagScore, ...]
    visibility_comparison_level: VisibilityComparisonLevel
    visibility_comparison_group_size: int
    specialty_result: BusinessSpecialtyScore
    visibility_result: VisibilityGapResult
    discovery_score_id: int


class DiscoveryScoreService:
    """Calculates and stores the current full discovery score."""

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
            DiscoveryScoreService.ONE,
            max(
                DiscoveryScoreService.ZERO,
                Decimal(score),
            ),
        )

    @staticmethod
    def _quantize_score(
        score: Decimal,
    ) -> Decimal:
        """Rounds a score to the stored five-decimal precision."""

        clamped_score = DiscoveryScoreService._clamp_score(
            score,
        )

        with localcontext() as context:
            context.prec = DiscoveryScoreService.CALCULATION_PRECISION

            return clamped_score.quantize(
                DiscoveryScoreService.SCORE_QUANTUM,
                rounding=ROUND_HALF_UP,
            )

    @staticmethod
    def calculate_discovery_score(
        specialty_score: Decimal,
        visibility_gap: Decimal,
        specialty_weight: Decimal,
        visibility_weight: Decimal,
    ) -> Decimal:
        """Combines Specialty Score and Visibility Gap using configured weights."""

        with localcontext() as context:
            context.prec = DiscoveryScoreService.CALCULATION_PRECISION
            discovery_score = (
                Decimal(specialty_weight)
                * Decimal(specialty_score)
                + Decimal(visibility_weight)
                * Decimal(visibility_gap)
            )

        return DiscoveryScoreService._clamp_score(
            discovery_score,
        )

    @staticmethod
    def _lock_active_business(
        business_id: int,
    ) -> Business:
        """Locks the active business before current scores are written."""

        try:
            return (
                Business.objects
                .select_for_update()
                .only(
                    "BUSN_ID",
                )
                .get(
                    BUSN_ID=business_id,
                    BUSN_STATUS=Business.BusinessStatus.ACTIVE,
                )
            )
        except Business.DoesNotExist:
            raise NotFound(
                "The active business could not be found.",
            )

    @classmethod
    def _build_result(
        cls,
        specialty_result: BusinessSpecialtyScore,
        visibility_result: VisibilityGapResult,
        discovery_score: Decimal,
        score_record: DiscoveryScore,
        reference_time: datetime,
    ) -> DiscoveryScoreResult:
        """Builds one explainable result from the stored score components."""

        return DiscoveryScoreResult(
            business_id=specialty_result.business_id,
            reference_time=reference_time,
            specialty_score=specialty_result.specialty_score,
            visibility_gap=visibility_result.visibility_gap,
            discovery_score=discovery_score,
            active_specialty_count=(
                specialty_result.active_specialty_count
            ),
            expected_active_specialty_count=(
                specialty_result.expected_active_specialty_count
            ),
            has_expected_active_specialty_count=(
                specialty_result.has_expected_active_specialty_count
            ),
            tag_scores=specialty_result.tag_scores,
            visibility_comparison_level=(
                visibility_result.comparison_group_level
            ),
            visibility_comparison_group_size=(
                visibility_result.comparison_group_size
            ),
            specialty_result=specialty_result,
            visibility_result=visibility_result,
            discovery_score_id=score_record.DSC_ID,
        )

    @classmethod
    @transaction.atomic
    def _persist_business_score(
        cls,
        business_id: int,
        visibility_result: VisibilityGapResult,
        reference_time: datetime,
        configuration: DiscoveryAlgorithmConfiguration,
    ) -> DiscoveryScoreResult:
        """Stores TagScores and one aggregate score in one transaction."""

        cls._lock_active_business(
            business_id=business_id,
        )
        specialty_result = (
            SpecialtyScoreService
            .recompute_business_specialty_score(
                business_id=business_id,
                reference_time=reference_time,
                configuration=configuration,
            )
        )
        discovery_score = cls.calculate_discovery_score(
            specialty_score=specialty_result.specialty_score,
            visibility_gap=visibility_result.visibility_gap,
            specialty_weight=(
                configuration.DAC_SPECIALTY_SCORE_WEIGHT
            ),
            visibility_weight=(
                configuration.DAC_VISIBILITY_GAP_WEIGHT
            ),
        )
        persisted_specialty_score = cls._quantize_score(
            specialty_result.specialty_score,
        )
        persisted_visibility_gap = cls._quantize_score(
            visibility_result.visibility_gap,
        )
        persisted_discovery_score = cls._quantize_score(
            discovery_score,
        )
        score_record = (
            DiscoveryScore.objects
            .select_for_update()
            .filter(
                BUSN_ID_id=business_id,
            )
            .first()
        )

        if score_record is None:
            score_record = DiscoveryScore.objects.create(
                BUSN_ID_id=business_id,
                DSC_S_SCORE=persisted_specialty_score,
                DSC_V_SCORE=persisted_visibility_gap,
                DSC_D_SCORE=persisted_discovery_score,
                DSC_COMPUTED_AT=reference_time,
            )
        else:
            score_record.DSC_S_SCORE = persisted_specialty_score
            score_record.DSC_V_SCORE = persisted_visibility_gap
            score_record.DSC_D_SCORE = persisted_discovery_score
            score_record.DSC_COMPUTED_AT = reference_time
            score_record.save(
                update_fields=[
                    "DSC_S_SCORE",
                    "DSC_V_SCORE",
                    "DSC_D_SCORE",
                    "DSC_COMPUTED_AT",
                    "DSC_UPDATED_AT",
                ],
            )

        return cls._build_result(
            specialty_result=specialty_result,
            visibility_result=visibility_result,
            discovery_score=persisted_discovery_score,
            score_record=score_record,
            reference_time=reference_time,
        )

    @classmethod
    def recompute_business_score(
        cls,
        business_id: int,
        reference_time: datetime | None = None,
        configuration: DiscoveryAlgorithmConfiguration | None = None,
    ) -> DiscoveryScoreResult:
        """Recomputes and stores the current score for one active business."""

        if reference_time is None:
            reference_time = timezone.now()

        if configuration is None:
            configuration = (
                DiscoveryAlgorithmConfigurationService
                .get_current_configuration()
            )

        visibility_result = (
            VisibilityGapService
            .calculate_business_visibility_gap(
                business_id=business_id,
                reference_time=reference_time,
                configuration=configuration,
            )
        )

        return cls._persist_business_score(
            business_id=business_id,
            visibility_result=visibility_result,
            reference_time=reference_time,
            configuration=configuration,
        )

    @classmethod
    def recompute_business_scores(
        cls,
        business_ids: Iterable[int] | None = None,
        reference_time: datetime | None = None,
    ) -> tuple[DiscoveryScoreResult, ...]:
        """Recomputes active businesses with one time and configuration snapshot."""

        if reference_time is None:
            reference_time = timezone.now()

        configuration = (
            DiscoveryAlgorithmConfigurationService
            .get_current_configuration()
        )
        visibility_results = (
            VisibilityGapService
            .calculate_visibility_gaps(
                business_ids=business_ids,
                reference_time=reference_time,
                configuration=configuration,
            )
        )

        return tuple(
            cls._persist_business_score(
                business_id=visibility_result.business_id,
                visibility_result=visibility_result,
                reference_time=reference_time,
                configuration=configuration,
            )
            for visibility_result in visibility_results
        )
