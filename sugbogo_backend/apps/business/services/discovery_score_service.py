from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal, localcontext
from enum import StrEnum

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
from apps.business.services.discovery_score_refresh_service import DiscoveryScoreRefreshService
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


class DiscoveryScoreRecomputeStatus(StrEnum):
    UPDATED = "UPDATED"
    SKIPPED_STALE = "SKIPPED_STALE"


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
    status: DiscoveryScoreRecomputeStatus = (
        DiscoveryScoreRecomputeStatus.UPDATED
    )


@dataclass(frozen=True)
class StaleDiscoveryScoreResult:
    """Describes a score run skipped because a newer score already exists."""

    business_id: int
    requested_reference_time: datetime
    current_reference_time: datetime | None
    specialty_score: Decimal
    visibility_gap: Decimal
    discovery_score: Decimal
    discovery_score_id: int
    status: DiscoveryScoreRecomputeStatus = (
        DiscoveryScoreRecomputeStatus.SKIPPED_STALE
    )


@dataclass(frozen=True)
class DiscoveryScoreBusinessFailure:
    """Describes one business-level domain failure in a batch run."""

    business_id: int
    error_type: str
    detail: str


@dataclass(frozen=True)
class DiscoveryScoreBatchResult:
    """Summarizes updated, stale, and failed businesses in one batch."""

    reference_time: datetime
    considered_count: int
    updated_results: tuple[DiscoveryScoreResult, ...]
    stale_results: tuple[StaleDiscoveryScoreResult, ...]
    failures: tuple[DiscoveryScoreBusinessFailure, ...]

    @property
    def updated_count(self) -> int:
        """Returns how many businesses received a current score update."""

        return len(
            self.updated_results,
        )

    @property
    def stale_count(self) -> int:
        """Returns how many businesses were skipped as stale."""

        return len(
            self.stale_results,
        )

    @property
    def failed_count(self) -> int:
        """Returns how many businesses had an isolated domain failure."""

        return len(
            self.failures,
        )


DiscoveryScoreBusinessResult = (
    DiscoveryScoreResult
    | StaleDiscoveryScoreResult
)


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

    @staticmethod
    def _build_stale_result(
        business_id: int,
        reference_time: datetime,
        score_record: DiscoveryScore,
    ) -> StaleDiscoveryScoreResult:
        """Builds a result showing that an older score run was skipped."""

        return StaleDiscoveryScoreResult(
            business_id=business_id,
            requested_reference_time=reference_time,
            current_reference_time=score_record.DSC_COMPUTED_AT,
            specialty_score=score_record.DSC_S_SCORE,
            visibility_gap=score_record.DSC_V_SCORE,
            discovery_score=score_record.DSC_D_SCORE,
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
        expected_version: int | None = None,
        only_if_pending: bool = False,
    ) -> DiscoveryScoreBusinessResult:
        """Stores TagScores and one aggregate score in one transaction."""

        cls._lock_active_business(
            business_id=business_id,
        )
        score_record = (
            DiscoveryScore.objects
            .select_for_update()
            .filter(
                BUSN_ID_id=business_id,
            )
            .first()
        )

        if (
            score_record is not None
            and (
                (
                    score_record.DSC_COMPUTED_AT is not None
                    and reference_time <= score_record.DSC_COMPUTED_AT
                )
                or (
                    expected_version is not None
                    and score_record.DSC_REFRESH_VERSION != expected_version
                )
                or (
                    # Generation zero is initialization, not an evidence invalidation.
                    score_record.DSC_REFRESH_VERSION > 0
                    and score_record.DSC_REFRESH_REQUESTED_AT is not None
                    and reference_time < score_record.DSC_REFRESH_REQUESTED_AT
                )
                or (
                    score_record.DSC_LAST_ATTEMPT_AT is not None
                    and reference_time < score_record.DSC_LAST_ATTEMPT_AT
                )
                or (
                    configuration.DAC_UPDATED_AT is not None
                    and not DiscoveryAlgorithmConfiguration.objects.filter(
                        pk=configuration.pk,
                        DAC_UPDATED_AT=configuration.DAC_UPDATED_AT,
                    ).exists()
                )
                or (
                    only_if_pending
                    and not DiscoveryScoreRefreshService.needs_refresh(
                        score_record,
                        reference_time,
                    )
                )
            )
        ):
            return cls._build_stale_result(
                business_id=business_id,
                reference_time=reference_time,
                score_record=score_record,
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
        if score_record is None:
            score_record = DiscoveryScore.objects.create(
                BUSN_ID_id=business_id,
                DSC_S_SCORE=persisted_specialty_score,
                DSC_V_SCORE=persisted_visibility_gap,
                DSC_D_SCORE=persisted_discovery_score,
                DSC_COMPUTED_AT=reference_time,
                DSC_LAST_ATTEMPT_AT=reference_time,
            )
        else:
            score_record.DSC_S_SCORE = persisted_specialty_score
            score_record.DSC_V_SCORE = persisted_visibility_gap
            score_record.DSC_D_SCORE = persisted_discovery_score
            score_record.DSC_COMPUTED_AT = reference_time
            score_record.DSC_IS_PROVISIONAL = False
            score_record.DSC_REFRESH_REQUESTED_AT = None
            score_record.DSC_LAST_ATTEMPT_AT = reference_time
            score_record.DSC_LAST_ERROR = ""
            score_record.save(
                update_fields=[
                    "DSC_S_SCORE",
                    "DSC_V_SCORE",
                    "DSC_D_SCORE",
                    "DSC_COMPUTED_AT",
                    "DSC_IS_PROVISIONAL",
                    "DSC_REFRESH_REQUESTED_AT",
                    "DSC_LAST_ATTEMPT_AT",
                    "DSC_LAST_ERROR",
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
        only_if_pending: bool = False,
    ) -> DiscoveryScoreBusinessResult:
        """Refreshes one active business while retaining provenance on failures."""
        if reference_time is None:
            reference_time = timezone.now()
        if configuration is None:
            configuration = DiscoveryAlgorithmConfigurationService.get_current_configuration()
        score = DiscoveryScoreRefreshService.initialize(
            business_id,
            configuration,
        )
        if (
            only_if_pending
            and not DiscoveryScoreRefreshService.needs_refresh(
                score,
                reference_time,
            )
        ):
            return cls._build_stale_result(
                business_id,
                reference_time,
                score,
            )
        version = score.DSC_REFRESH_VERSION
        if not DiscoveryScoreRefreshService.record_attempt(
            business_id,
            version,
            reference_time,
        ):
            score.refresh_from_db()
            return cls._build_stale_result(
                business_id,
                reference_time,
                score,
            )
        try:
            visibility_result = VisibilityGapService.calculate_business_visibility_gap(
                business_id=business_id,
                reference_time=reference_time,
                configuration=configuration,
            )
            return cls._persist_business_score(
                business_id=business_id,
                visibility_result=visibility_result,
                reference_time=reference_time,
                configuration=configuration,
                expected_version=version,
                only_if_pending=only_if_pending,
            )
        except Exception as exc:
            DiscoveryScoreRefreshService.record_failure(
                business_id,
                version,
                reference_time,
                exc,
            )
            raise

    @classmethod
    def recompute_business_scores(
        cls,
        business_ids: Iterable[int] | None = None,
        reference_time: datetime | None = None,
    ) -> DiscoveryScoreBatchResult:
        """Uses one visibility snapshot and isolates per-business persistence failures."""
        if reference_time is None:
            reference_time = timezone.now()
        if business_ids is not None:
            business_ids = tuple(business_ids)
        configuration = DiscoveryAlgorithmConfigurationService.get_current_configuration()
        targets = Business.objects.filter(
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
        )
        if business_ids is not None:
            targets = targets.filter(pk__in=business_ids)
        states = {}
        target_ids = targets.order_by("BUSN_ID").values_list(
            "BUSN_ID",
            flat=True,
        )
        for business_id in target_ids:
            try:
                score = DiscoveryScoreRefreshService.initialize(
                    business_id,
                    configuration,
                )
            except NotFound:
                continue
            states[business_id] = score
            DiscoveryScoreRefreshService.record_attempt(
                business_id,
                score.DSC_REFRESH_VERSION,
                reference_time,
            )
        try:
            visibility_results = VisibilityGapService.calculate_visibility_gaps(
                business_ids=business_ids,
                reference_time=reference_time,
                configuration=configuration,
            )
        except Exception as exc:
            for business_id, score in states.items():
                DiscoveryScoreRefreshService.record_failure(
                    business_id,
                    score.DSC_REFRESH_VERSION,
                    reference_time,
                    exc,
                )
            raise

        updated_results = []
        stale_results = []
        failures = []
        for visibility_result in visibility_results:
            business_id = visibility_result.business_id
            score = states.get(business_id)
            if score is None:
                failures.append(
                    DiscoveryScoreBusinessFailure(
                        business_id=business_id,
                        error_type="NotFound",
                        detail="Business population changed during the refresh.",
                    ),
                )
                continue
            try:
                result = cls._persist_business_score(
                    business_id=business_id,
                    visibility_result=visibility_result,
                    reference_time=reference_time,
                    configuration=configuration,
                    expected_version=score.DSC_REFRESH_VERSION,
                )
            except Exception as exc:
                DiscoveryScoreRefreshService.record_failure(
                    business_id,
                    score.DSC_REFRESH_VERSION,
                    reference_time,
                    exc,
                )
                failures.append(
                    DiscoveryScoreBusinessFailure(
                        business_id=business_id,
                        error_type=type(exc).__name__,
                        detail="Score refresh failed; pending state retained.",
                    ),
                )
                continue
            if isinstance(result, StaleDiscoveryScoreResult):
                stale_results.append(result)
            else:
                updated_results.append(result)
        return DiscoveryScoreBatchResult(
            reference_time=reference_time,
            considered_count=len(visibility_results),
            updated_results=tuple(updated_results),
            stale_results=tuple(stale_results),
            failures=tuple(failures),
        )
