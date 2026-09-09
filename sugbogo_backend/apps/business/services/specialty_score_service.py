from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP, localcontext
from typing import Iterable

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound

from apps.admin_operations.system_configuration.services.discovery_algorithm_configuration_service import (
    DiscoveryAlgorithmConfigurationService,
)
from apps.business.models import (
    Business,
    BusinessSpecialtyTag,
    BusinessVouch,
)


@dataclass(frozen=True)
class SpecialtyEvidenceInput:
    """Immutable scoring input derived from one valid specialty vouch."""

    evidence_id: int
    created_at: datetime
    reputation_snapshot: Decimal


@dataclass(frozen=True)
class EvidenceContribution:
    """Explainable calculation details for one valid specialty vouch."""

    evidence_id: int
    decay: Decimal
    dampening: Decimal
    contribution: Decimal


@dataclass(frozen=True)
class TagScoreCalculation:
    """Pure, unpersisted result for one business-specialty pair."""

    raw_tag_evidence: Decimal
    tag_score: Decimal
    contributions: tuple[EvidenceContribution, ...]


@dataclass(frozen=True)
class PersistedTagScore:
    """Current score state persisted for one business-specialty pair."""

    business_specialty_id: int
    raw_tag_evidence: Decimal
    tag_score: Decimal
    valid_evidence_count: int
    score_updated_at: datetime


@dataclass(frozen=True)
class BusinessSpecialtyScore:
    """Current calculated Specialty Score and assignment-count health."""

    business_id: int
    specialty_score: Decimal
    active_specialty_count: int
    expected_active_specialty_count: int
    has_expected_active_specialty_count: bool
    tag_scores: tuple[PersistedTagScore, ...]
    score_updated_at: datetime


class SpecialtyScoreService:
    """Calculates and persists the Specialty Score side of discovery.

    Vouch age is represented as fractional thirty-day months. This keeps
    decay gradual and makes repeated calculations reproducible for the same
    configuration and reference timestamp.
    """

    CALCULATION_PRECISION = 40
    EXPECTED_ACTIVE_SPECIALTY_COUNT = 3
    MICROSECONDS_PER_DAY = 86_400_000_000
    DAYS_PER_MONTH = Decimal("30")
    SCORE_QUANTUM = Decimal("0.00001")
    ZERO = Decimal("0")
    ONE = Decimal("1")

    @staticmethod
    def _clamp_score(
        score: Decimal,
    ) -> Decimal:
        return min(
            SpecialtyScoreService.ONE,
            max(
                SpecialtyScoreService.ZERO,
                score,
            ),
        )

    @staticmethod
    def _quantize_score(
        score: Decimal,
    ) -> Decimal:
        clamped_score = SpecialtyScoreService._clamp_score(
            score,
        )

        with localcontext() as context:
            context.prec = SpecialtyScoreService.CALCULATION_PRECISION

            return clamped_score.quantize(
                SpecialtyScoreService.SCORE_QUANTUM,
                rounding=ROUND_HALF_UP,
            )

    @staticmethod
    def calculate_months_since_vouch(
        vouch_created_at: datetime,
        reference_time: datetime,
    ) -> Decimal:
        elapsed = reference_time - vouch_created_at

        if elapsed <= timedelta(0):
            return SpecialtyScoreService.ZERO

        elapsed_microseconds = (
            Decimal(elapsed.days)
            * Decimal(SpecialtyScoreService.MICROSECONDS_PER_DAY)
            + Decimal(elapsed.seconds)
            * Decimal("1000000")
            + Decimal(elapsed.microseconds)
        )

        with localcontext() as context:
            context.prec = SpecialtyScoreService.CALCULATION_PRECISION

            elapsed_days = (
                elapsed_microseconds
                / Decimal(SpecialtyScoreService.MICROSECONDS_PER_DAY)
            )

            return (
                elapsed_days
                / SpecialtyScoreService.DAYS_PER_MONTH
            )

    @staticmethod
    def calculate_decay(
        vouch_created_at: datetime,
        reference_time: datetime,
        decay_rate: Decimal,
    ) -> Decimal:
        months_since_vouch = (
            SpecialtyScoreService.calculate_months_since_vouch(
                vouch_created_at=vouch_created_at,
                reference_time=reference_time,
            )
        )

        with localcontext() as context:
            context.prec = SpecialtyScoreService.CALCULATION_PRECISION

            exponent = -(
                Decimal(decay_rate)
                * months_since_vouch
            )
            decay = exponent.exp()

        return SpecialtyScoreService._clamp_score(
            decay,
        )

    @staticmethod
    def calculate_evidence_dampening(
        previous_valid_interactions: int,
    ) -> Decimal:
        if previous_valid_interactions < 0:
            raise ValueError(
                "Previous valid interactions cannot be negative.",
            )

        with localcontext() as context:
            context.prec = SpecialtyScoreService.CALCULATION_PRECISION

            interaction_position = (
                SpecialtyScoreService.ONE
                + Decimal(previous_valid_interactions)
            )

            return (
                SpecialtyScoreService.ONE
                / interaction_position.sqrt()
            )

    @staticmethod
    def calculate_contribution(
        reputation_snapshot: Decimal,
        decay: Decimal,
        dampening: Decimal,
    ) -> Decimal:
        with localcontext() as context:
            context.prec = SpecialtyScoreService.CALCULATION_PRECISION

            return (
                Decimal(reputation_snapshot)
                * Decimal(decay)
                * Decimal(dampening)
            )

    @staticmethod
    def calculate_tag_score(
        evidence: Iterable[SpecialtyEvidenceInput],
        decay_rate: Decimal,
        reference_time: datetime,
    ) -> TagScoreCalculation:
        ordered_evidence = sorted(
            evidence,
            key=lambda item: (
                item.created_at,
                item.evidence_id,
            ),
        )

        contributions = []

        with localcontext() as context:
            context.prec = SpecialtyScoreService.CALCULATION_PRECISION
            raw_tag_evidence = SpecialtyScoreService.ZERO

            for evidence_index, evidence_item in enumerate(
                ordered_evidence,
            ):
                decay = SpecialtyScoreService.calculate_decay(
                    vouch_created_at=evidence_item.created_at,
                    reference_time=reference_time,
                    decay_rate=decay_rate,
                )
                dampening = (
                    SpecialtyScoreService.calculate_evidence_dampening(
                        previous_valid_interactions=evidence_index,
                    )
                )
                contribution = SpecialtyScoreService.calculate_contribution(
                    reputation_snapshot=(
                        evidence_item.reputation_snapshot
                    ),
                    decay=decay,
                    dampening=dampening,
                )

                raw_tag_evidence += contribution

                contributions.append(
                    EvidenceContribution(
                        evidence_id=evidence_item.evidence_id,
                        decay=decay,
                        dampening=dampening,
                        contribution=contribution,
                    ),
                )

            tag_score = SpecialtyScoreService.ONE - (
                -raw_tag_evidence
            ).exp()

        return TagScoreCalculation(
            raw_tag_evidence=raw_tag_evidence,
            tag_score=SpecialtyScoreService._clamp_score(
                tag_score,
            ),
            contributions=tuple(
                contributions,
            ),
        )

    @staticmethod
    def calculate_specialty_score(
        tag_scores: Iterable[Decimal],
    ) -> Decimal:
        with localcontext() as context:
            context.prec = SpecialtyScoreService.CALCULATION_PRECISION

            total_tag_score = sum(
                (
                    Decimal(tag_score)
                    for tag_score in tag_scores
                ),
                SpecialtyScoreService.ZERO,
            )
            specialty_score = (
                total_tag_score
                / Decimal(
                    SpecialtyScoreService
                    .EXPECTED_ACTIVE_SPECIALTY_COUNT,
                )
            )

        return SpecialtyScoreService._clamp_score(
            specialty_score,
        )

    @staticmethod
    def _evidence_from_vouches(
        vouches: Iterable[BusinessVouch],
    ) -> list[SpecialtyEvidenceInput]:
        return [
            SpecialtyEvidenceInput(
                evidence_id=vouch.VOUCH_ID,
                created_at=vouch.VOUCH_CREATED_AT,
                reputation_snapshot=(
                    vouch.VOUCH_REPUTATION_SNAPSHOT
                ),
            )
            for vouch in vouches
        ]

    @staticmethod
    def _calculate_persisted_tag_score(
        business_specialty: BusinessSpecialtyTag,
        vouches: Iterable[BusinessVouch],
        decay_rate: Decimal,
        reference_time: datetime,
    ) -> PersistedTagScore:
        evidence = SpecialtyScoreService._evidence_from_vouches(
            vouches,
        )
        calculation = SpecialtyScoreService.calculate_tag_score(
            evidence=evidence,
            decay_rate=decay_rate,
            reference_time=reference_time,
        )
        persisted_tag_score = SpecialtyScoreService._quantize_score(
            calculation.tag_score,
        )

        business_specialty.BST_TAG_SCORE = persisted_tag_score
        business_specialty.BST_SCORE_UPDATED_AT = reference_time

        return PersistedTagScore(
            business_specialty_id=business_specialty.BST_ID,
            raw_tag_evidence=calculation.raw_tag_evidence,
            tag_score=persisted_tag_score,
            valid_evidence_count=len(
                evidence,
            ),
            score_updated_at=reference_time,
        )

    @staticmethod
    @transaction.atomic
    def recompute_tag_score(
        business_specialty_id: int,
        reference_time: datetime | None = None,
    ) -> PersistedTagScore:
        if reference_time is None:
            reference_time = timezone.now()

        try:
            business_specialty = (
                BusinessSpecialtyTag.objects
                .select_for_update()
                .get(
                    BST_ID=business_specialty_id,
                )
            )
        except BusinessSpecialtyTag.DoesNotExist:
            raise NotFound(
                "The business specialty could not be found.",
            )

        configuration = (
            DiscoveryAlgorithmConfigurationService
            .get_current_configuration()
        )
        vouches = list(
            BusinessVouch.objects.filter(
                BUSN_ID=business_specialty.BUSN_ID_id,
                TAG_ID=business_specialty.TAG_ID_id,
                VOUCH_EVIDENCE_IS_VALID=True,
            ).order_by(
                "VOUCH_CREATED_AT",
                "VOUCH_ID",
            ),
        )
        result = SpecialtyScoreService._calculate_persisted_tag_score(
            business_specialty=business_specialty,
            vouches=vouches,
            decay_rate=configuration.DAC_DECAY_RATE,
            reference_time=reference_time,
        )

        business_specialty.save(
            update_fields=[
                "BST_TAG_SCORE",
                "BST_SCORE_UPDATED_AT",
                "BST_UPDATED_AT",
            ],
        )

        return result

    @staticmethod
    @transaction.atomic
    def recompute_business_specialty_score(
        business_id: int,
        reference_time: datetime | None = None,
    ) -> BusinessSpecialtyScore:
        if reference_time is None:
            reference_time = timezone.now()

        try:
            business = (
                Business.objects
                .select_for_update()
                .get(
                    BUSN_ID=business_id,
                )
            )
        except Business.DoesNotExist:
            raise NotFound(
                "The business could not be found.",
            )

        configuration = (
            DiscoveryAlgorithmConfigurationService
            .get_current_configuration()
        )
        business_specialties = list(
            BusinessSpecialtyTag.objects
            .select_for_update()
            .filter(
                BUSN_ID=business,
                BST_IS_ACTIVE=True,
            )
            .order_by(
                "BST_ID",
            ),
        )

        specialty_tag_ids = [
            business_specialty.TAG_ID_id
            for business_specialty in business_specialties
        ]
        vouches_by_tag_id = {
            specialty_tag_id: []
            for specialty_tag_id in specialty_tag_ids
        }

        valid_vouches = (
            BusinessVouch.objects.filter(
                BUSN_ID=business,
                TAG_ID_id__in=specialty_tag_ids,
                VOUCH_EVIDENCE_IS_VALID=True,
            )
            .order_by(
                "TAG_ID_id",
                "VOUCH_CREATED_AT",
                "VOUCH_ID",
            )
        )

        for vouch in valid_vouches:
            vouches_by_tag_id[
                vouch.TAG_ID_id
            ].append(
                vouch,
            )

        tag_score_results = []
        unrounded_tag_scores = []

        for business_specialty in business_specialties:
            tag_vouches = vouches_by_tag_id[
                business_specialty.TAG_ID_id
            ]
            evidence = SpecialtyScoreService._evidence_from_vouches(
                tag_vouches,
            )
            calculation = SpecialtyScoreService.calculate_tag_score(
                evidence=evidence,
                decay_rate=configuration.DAC_DECAY_RATE,
                reference_time=reference_time,
            )
            persisted_tag_score = SpecialtyScoreService._quantize_score(
                calculation.tag_score,
            )

            business_specialty.BST_TAG_SCORE = persisted_tag_score
            business_specialty.BST_SCORE_UPDATED_AT = reference_time
            business_specialty.BST_UPDATED_AT = timezone.now()

            unrounded_tag_scores.append(
                calculation.tag_score,
            )
            tag_score_results.append(
                PersistedTagScore(
                    business_specialty_id=business_specialty.BST_ID,
                    raw_tag_evidence=calculation.raw_tag_evidence,
                    tag_score=persisted_tag_score,
                    valid_evidence_count=len(
                        evidence,
                    ),
                    score_updated_at=reference_time,
                ),
            )

        if business_specialties:
            BusinessSpecialtyTag.objects.bulk_update(
                business_specialties,
                fields=[
                    "BST_TAG_SCORE",
                    "BST_SCORE_UPDATED_AT",
                    "BST_UPDATED_AT",
                ],
            )

        specialty_score = SpecialtyScoreService.calculate_specialty_score(
            tag_scores=unrounded_tag_scores,
        )
        persisted_specialty_score = (
            SpecialtyScoreService._quantize_score(
                specialty_score,
            )
        )
        active_specialty_count = len(
            business_specialties,
        )

        return BusinessSpecialtyScore(
            business_id=business.BUSN_ID,
            specialty_score=persisted_specialty_score,
            active_specialty_count=active_specialty_count,
            expected_active_specialty_count=(
                SpecialtyScoreService.EXPECTED_ACTIVE_SPECIALTY_COUNT
            ),
            has_expected_active_specialty_count=(
                active_specialty_count
                == SpecialtyScoreService.EXPECTED_ACTIVE_SPECIALTY_COUNT
            ),
            tag_scores=tuple(
                tag_score_results,
            ),
            score_updated_at=reference_time,
        )
