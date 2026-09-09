from datetime import UTC, datetime, timedelta
from decimal import Decimal, localcontext
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.test import TestCase

from apps.admin_operations.system_configuration.services.discovery_algorithm_configuration_service import (
    DiscoveryAlgorithmConfigurationService,
)
from apps.business.models import (
    Business,
    BusinessSpecialtyTag,
    BusinessVouch,
    Category,
    Cluster,
    DiscoveryScore,
    Location,
    SpecialtyTag,
)
from apps.business.services.business_specialty_service import (
    BusinessSpecialtyService,
)
from apps.business.services.specialty_score_service import (
    SpecialtyEvidenceInput,
    SpecialtyScoreService,
)
from apps.business.services.vouch_service import VouchService
from apps.users.models import ReputationEvent, User


class SpecialtyScoreCalculationTests(TestCase):
    REFERENCE_TIME = datetime(
        2026,
        9,
        1,
        12,
        0,
        tzinfo=UTC,
    )

    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(
            email="specialty-score-owner@example.com",
            password=None,
            USER_FNAME="Score",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        cls.cluster = Cluster.objects.create(
            CLUS_NAME="Specialty Score Cluster",
            CLUS_DESCRIPTION="Specialty score test cluster.",
        )
        cls.category = Category.objects.create(
            CTGRY_NAME="Specialty Score Category",
            CTGRY_DESCRIPTION="Specialty score test category.",
            CLUS_ID=cls.cluster,
        )
        cls.location = Location.objects.create(
            LOCT_POINT=Point(
                123.8854,
                10.3157,
                srid=4326,
            ),
            LOCT_ADDRESS="Specialty Score Street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        cls.business = Business.objects.create(
            BUSN_NAME="Specialty Score Cafe",
            BUSN_DESCRIPTION="A specialty score test business.",
            BUSN_CONTACT_NUMBER="09171234567",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=cls.owner,
            CTGRY_ID=cls.category,
            LOCT_ID=cls.location,
        )

        cls.tags = []
        cls.business_specialties = []

        for index in range(3):
            tag = SpecialtyTag.objects.create(
                TAG_NAME=f"Score Specialty {index}",
                TAG_COLOR="blue",
            )
            business_specialty = BusinessSpecialtyTag.objects.create(
                BUSN_ID=cls.business,
                TAG_ID=tag,
            )

            cls.tags.append(
                tag,
            )
            cls.business_specialties.append(
                business_specialty,
            )

    def setUp(self):
        BusinessSpecialtyTag.objects.filter(
            BUSN_ID=self.business,
        ).update(
            BST_IS_ACTIVE=True,
            BST_DEACTIVATED_AT=None,
            BST_TAG_SCORE=Decimal("0.00000"),
            BST_SCORE_UPDATED_AT=None,
        )
        BusinessVouch.objects.filter(
            BUSN_ID=self.business,
        ).delete()
        ReputationEvent.objects.all().delete()
        DiscoveryScore.objects.filter(
            BUSN_ID=self.business,
        ).delete()

        configuration = (
            DiscoveryAlgorithmConfigurationService
            .get_current_configuration()
        )
        configuration.DAC_DECAY_RATE = Decimal("0.10")
        configuration.save(
            update_fields=[
                "DAC_DECAY_RATE",
                "DAC_UPDATED_AT",
            ],
        )

    def _get_explorer(
        self,
        index: int,
        reputation: Decimal = Decimal("0.20"),
    ) -> User:
        email = f"score-explorer-{index}@example.com"
        explorer, _ = User.objects.get_or_create(
            USER_EMAIL=email,
            defaults={
                "password": "!",
                "USER_FNAME": "Score",
                "USER_LNAME": f"Explorer {index}",
                "USER_ROLE": User.UserRole.EXPLORER,
                "USER_STATUS": User.UserStatus.ACTIVE,
                "USER_REPUTATION": reputation,
            },
        )

        if explorer.USER_REPUTATION != reputation:
            User.objects.filter(
                USER_ID=explorer.USER_ID,
            ).update(
                USER_REPUTATION=reputation,
            )
            explorer.refresh_from_db()

        return explorer

    def _create_vouch(
        self,
        explorer_index: int,
        business_specialty_index: int = 0,
        reputation_snapshot: Decimal = Decimal("0.20"),
        age_days: Decimal = Decimal("0"),
        is_valid: bool = True,
    ) -> BusinessVouch:
        explorer = self._get_explorer(
            explorer_index,
        )
        business_specialty = self.business_specialties[
            business_specialty_index
        ]
        vouch = BusinessVouch.objects.create(
            BUSN_ID=self.business,
            USER_ID=explorer,
            TAG_ID=business_specialty.TAG_ID,
            VOUCH_REPUTATION_SNAPSHOT=reputation_snapshot,
            VOUCH_EVIDENCE_IS_VALID=is_valid,
        )
        created_at = self.REFERENCE_TIME - timedelta(
            days=float(age_days),
        )

        BusinessVouch.objects.filter(
            VOUCH_ID=vouch.VOUCH_ID,
        ).update(
            VOUCH_CREATED_AT=created_at,
        )
        vouch.refresh_from_db()

        return vouch

    def _recompute_business(self):
        return SpecialtyScoreService.recompute_business_specialty_score(
            business_id=self.business.BUSN_ID,
            reference_time=self.REFERENCE_TIME,
        )

    def test_newly_created_evidence_has_decay_one(self):
        decay = SpecialtyScoreService.calculate_decay(
            vouch_created_at=self.REFERENCE_TIME,
            reference_time=self.REFERENCE_TIME,
            decay_rate=Decimal("0.10"),
        )

        self.assertEqual(
            decay,
            Decimal("1"),
        )

    def test_older_evidence_has_lower_decay(self):
        current_decay = SpecialtyScoreService.calculate_decay(
            vouch_created_at=self.REFERENCE_TIME,
            reference_time=self.REFERENCE_TIME,
            decay_rate=Decimal("0.10"),
        )
        old_decay = SpecialtyScoreService.calculate_decay(
            vouch_created_at=(
                self.REFERENCE_TIME
                - timedelta(days=90)
            ),
            reference_time=self.REFERENCE_TIME,
            decay_rate=Decimal("0.10"),
        )

        self.assertLess(
            old_decay,
            current_decay,
        )

    def test_configured_decay_rate_is_used(self):
        vouch = self._create_vouch(
            explorer_index=1,
            reputation_snapshot=Decimal("0.50"),
            age_days=Decimal("30"),
        )
        configuration = (
            DiscoveryAlgorithmConfigurationService
            .get_current_configuration()
        )
        configuration.DAC_DECAY_RATE = Decimal("0.20")
        configuration.save(
            update_fields=[
                "DAC_DECAY_RATE",
                "DAC_UPDATED_AT",
            ],
        )

        result = SpecialtyScoreService.recompute_tag_score(
            business_specialty_id=(
                self.business_specialties[0].BST_ID
            ),
            reference_time=self.REFERENCE_TIME,
        )

        with localcontext() as context:
            context.prec = 40
            expected_raw = Decimal("0.50") * Decimal("-0.20").exp()

        self.assertAlmostEqual(
            result.raw_tag_evidence,
            expected_raw,
            places=20,
        )
        self.assertEqual(
            vouch.VOUCH_REPUTATION_SNAPSHOT,
            Decimal("0.50"),
        )

    def test_future_timestamp_does_not_produce_decay_above_one(self):
        decay = SpecialtyScoreService.calculate_decay(
            vouch_created_at=(
                self.REFERENCE_TIME
                + timedelta(days=10)
            ),
            reference_time=self.REFERENCE_TIME,
            decay_rate=Decimal("0.10"),
        )

        self.assertEqual(
            decay,
            Decimal("1"),
        )

    def test_fractional_month_age_decays_gradually(self):
        decay = SpecialtyScoreService.calculate_decay(
            vouch_created_at=(
                self.REFERENCE_TIME
                - timedelta(days=15)
            ),
            reference_time=self.REFERENCE_TIME,
            decay_rate=Decimal("0.10"),
        )

        with localcontext() as context:
            context.prec = 40
            expected = Decimal("-0.05").exp()

        self.assertAlmostEqual(
            decay,
            expected,
            places=20,
        )
        self.assertLess(
            decay,
            Decimal("1"),
        )

    def test_first_valid_interaction_has_full_dampening(self):
        dampening = (
            SpecialtyScoreService.calculate_evidence_dampening(
                previous_valid_interactions=0,
            )
        )

        self.assertEqual(
            dampening,
            Decimal("1"),
        )

    def test_second_valid_interaction_uses_square_root_two(self):
        dampening = (
            SpecialtyScoreService.calculate_evidence_dampening(
                previous_valid_interactions=1,
            )
        )

        with localcontext() as context:
            context.prec = 40
            expected = Decimal("1") / Decimal("2").sqrt()

        self.assertAlmostEqual(
            dampening,
            expected,
            places=20,
        )

    def test_third_valid_interaction_uses_square_root_three(self):
        dampening = (
            SpecialtyScoreService.calculate_evidence_dampening(
                previous_valid_interactions=2,
            )
        )

        with localcontext() as context:
            context.prec = 40
            expected = Decimal("1") / Decimal("3").sqrt()

        self.assertAlmostEqual(
            dampening,
            expected,
            places=20,
        )

    def test_invalid_evidence_does_not_consume_dampening_position(self):
        first = self._create_vouch(
            explorer_index=2,
            reputation_snapshot=Decimal("0.20"),
            age_days=Decimal("2"),
        )
        self._create_vouch(
            explorer_index=3,
            reputation_snapshot=Decimal("0.90"),
            age_days=Decimal("1"),
            is_valid=False,
        )
        second = self._create_vouch(
            explorer_index=4,
            reputation_snapshot=Decimal("0.30"),
            age_days=Decimal("0"),
        )

        result = SpecialtyScoreService.recompute_tag_score(
            business_specialty_id=(
                self.business_specialties[0].BST_ID
            ),
            reference_time=self.REFERENCE_TIME,
        )

        evidence = [
            SpecialtyEvidenceInput(
                evidence_id=first.VOUCH_ID,
                created_at=first.VOUCH_CREATED_AT,
                reputation_snapshot=Decimal("0.20"),
            ),
            SpecialtyEvidenceInput(
                evidence_id=second.VOUCH_ID,
                created_at=second.VOUCH_CREATED_AT,
                reputation_snapshot=Decimal("0.30"),
            ),
        ]
        expected = SpecialtyScoreService.calculate_tag_score(
            evidence=evidence,
            decay_rate=Decimal("0.10"),
            reference_time=self.REFERENCE_TIME,
        )

        self.assertEqual(
            result.valid_evidence_count,
            2,
        )
        self.assertAlmostEqual(
            result.raw_tag_evidence,
            expected.raw_tag_evidence,
            places=20,
        )

    def test_timestamp_ties_are_ordered_by_primary_key(self):
        same_time = self.REFERENCE_TIME - timedelta(days=1)
        evidence = [
            SpecialtyEvidenceInput(
                evidence_id=20,
                created_at=same_time,
                reputation_snapshot=Decimal("0.80"),
            ),
            SpecialtyEvidenceInput(
                evidence_id=10,
                created_at=same_time,
                reputation_snapshot=Decimal("0.20"),
            ),
        ]

        calculation = SpecialtyScoreService.calculate_tag_score(
            evidence=evidence,
            decay_rate=Decimal("0.10"),
            reference_time=self.REFERENCE_TIME,
        )

        self.assertEqual(
            calculation.contributions[0].evidence_id,
            10,
        )
        self.assertEqual(
            calculation.contributions[1].evidence_id,
            20,
        )
        self.assertEqual(
            calculation.contributions[0].dampening,
            Decimal("1"),
        )

    def test_contribution_uses_reputation_snapshot(self):
        contribution = SpecialtyScoreService.calculate_contribution(
            reputation_snapshot=Decimal("0.35"),
            decay=Decimal("0.80"),
            dampening=Decimal("0.50"),
        )

        self.assertEqual(
            contribution,
            Decimal("0.1400"),
        )

    def test_current_user_reputation_is_ignored(self):
        vouch = self._create_vouch(
            explorer_index=5,
            reputation_snapshot=Decimal("0.25"),
        )
        User.objects.filter(
            USER_ID=vouch.USER_ID_id,
        ).update(
            USER_REPUTATION=Decimal("0.90"),
        )

        result = SpecialtyScoreService.recompute_tag_score(
            business_specialty_id=(
                self.business_specialties[0].BST_ID
            ),
            reference_time=self.REFERENCE_TIME,
        )

        self.assertEqual(
            result.raw_tag_evidence,
            Decimal("0.25"),
        )

    def test_contribution_has_no_confidence_multiplier(self):
        contribution = SpecialtyScoreService.calculate_contribution(
            reputation_snapshot=Decimal("0.40"),
            decay=Decimal("0.75"),
            dampening=Decimal("0.50"),
        )

        self.assertEqual(
            contribution,
            Decimal("0.150000"),
        )

    def test_no_valid_evidence_produces_zero_tag_score(self):
        result = SpecialtyScoreService.recompute_tag_score(
            business_specialty_id=(
                self.business_specialties[0].BST_ID
            ),
            reference_time=self.REFERENCE_TIME,
        )

        self.assertEqual(
            result.raw_tag_evidence,
            Decimal("0"),
        )
        self.assertEqual(
            result.tag_score,
            Decimal("0.00000"),
        )

    def test_one_contribution_produces_expected_bounded_tag_score(self):
        self._create_vouch(
            explorer_index=6,
            reputation_snapshot=Decimal("0.40"),
        )

        result = SpecialtyScoreService.recompute_tag_score(
            business_specialty_id=(
                self.business_specialties[0].BST_ID
            ),
            reference_time=self.REFERENCE_TIME,
        )

        with localcontext() as context:
            context.prec = 40
            expected = Decimal("1") - Decimal("-0.40").exp()

        self.assertAlmostEqual(
            result.tag_score,
            expected,
            places=5,
        )
        self.assertGreaterEqual(
            result.tag_score,
            Decimal("0"),
        )
        self.assertLessEqual(
            result.tag_score,
            Decimal("1"),
        )

    def test_multiple_contributions_sum_before_tag_transform(self):
        first = self._create_vouch(
            explorer_index=7,
            reputation_snapshot=Decimal("0.30"),
        )
        second = self._create_vouch(
            explorer_index=8,
            reputation_snapshot=Decimal("0.60"),
        )

        result = SpecialtyScoreService.recompute_tag_score(
            business_specialty_id=(
                self.business_specialties[0].BST_ID
            ),
            reference_time=self.REFERENCE_TIME,
        )
        expected = SpecialtyScoreService.calculate_tag_score(
            evidence=[
                SpecialtyEvidenceInput(
                    evidence_id=first.VOUCH_ID,
                    created_at=first.VOUCH_CREATED_AT,
                    reputation_snapshot=Decimal("0.30"),
                ),
                SpecialtyEvidenceInput(
                    evidence_id=second.VOUCH_ID,
                    created_at=second.VOUCH_CREATED_AT,
                    reputation_snapshot=Decimal("0.60"),
                ),
            ],
            decay_rate=Decimal("0.10"),
            reference_time=self.REFERENCE_TIME,
        )

        self.assertAlmostEqual(
            result.raw_tag_evidence,
            expected.raw_tag_evidence,
            places=20,
        )
        self.assertAlmostEqual(
            result.tag_score,
            expected.tag_score,
            places=5,
        )

    def test_tag_score_approaches_but_does_not_exceed_one(self):
        evidence = [
            SpecialtyEvidenceInput(
                evidence_id=index,
                created_at=self.REFERENCE_TIME,
                reputation_snapshot=Decimal("1.00"),
            )
            for index in range(1, 501)
        ]

        result = SpecialtyScoreService.calculate_tag_score(
            evidence=evidence,
            decay_rate=Decimal("0.10"),
            reference_time=self.REFERENCE_TIME,
        )

        self.assertGreater(
            result.tag_score,
            Decimal("0.99"),
        )
        self.assertLessEqual(
            result.tag_score,
            Decimal("1"),
        )

    def test_invalidating_evidence_recalculates_to_lower_score(self):
        self._create_vouch(
            explorer_index=9,
            reputation_snapshot=Decimal("0.20"),
        )
        invalidated = self._create_vouch(
            explorer_index=10,
            reputation_snapshot=Decimal("0.80"),
        )

        before = SpecialtyScoreService.recompute_tag_score(
            business_specialty_id=(
                self.business_specialties[0].BST_ID
            ),
            reference_time=self.REFERENCE_TIME,
        )
        BusinessVouch.objects.filter(
            VOUCH_ID=invalidated.VOUCH_ID,
        ).update(
            VOUCH_EVIDENCE_IS_VALID=False,
            VOUCH_EVIDENCE_INVALIDATED_AT=self.REFERENCE_TIME,
        )
        after = SpecialtyScoreService.recompute_tag_score(
            business_specialty_id=(
                self.business_specialties[0].BST_ID
            ),
            reference_time=self.REFERENCE_TIME,
        )

        self.assertLess(
            after.tag_score,
            before.tag_score,
        )
        self.assertEqual(
            after.valid_evidence_count,
            1,
        )

    def test_later_recomputation_reflects_decay(self):
        self._create_vouch(
            explorer_index=11,
            reputation_snapshot=Decimal("0.50"),
        )

        current = SpecialtyScoreService.recompute_tag_score(
            business_specialty_id=(
                self.business_specialties[0].BST_ID
            ),
            reference_time=self.REFERENCE_TIME,
        )
        later = SpecialtyScoreService.recompute_tag_score(
            business_specialty_id=(
                self.business_specialties[0].BST_ID
            ),
            reference_time=(
                self.REFERENCE_TIME
                + timedelta(days=60)
            ),
        )

        self.assertLess(
            later.tag_score,
            current.tag_score,
        )

    def test_inactive_specialty_is_excluded_from_current_sc(self):
        self._create_vouch(
            explorer_index=12,
            business_specialty_index=0,
            reputation_snapshot=Decimal("0.90"),
        )
        BusinessSpecialtyService.deactivate_specialty(
            business_id=self.business.BUSN_ID,
            tag_id=self.tags[0].TAG_ID,
        )

        result = self._recompute_business()

        self.assertEqual(
            result.active_specialty_count,
            2,
        )
        self.assertEqual(
            result.specialty_score,
            Decimal("0.00000"),
        )

    def test_inactive_specialty_can_recompute_its_historical_tag_score(self):
        self._create_vouch(
            explorer_index=30,
            business_specialty_index=0,
            reputation_snapshot=Decimal("0.40"),
        )
        BusinessSpecialtyService.deactivate_specialty(
            business_id=self.business.BUSN_ID,
            tag_id=self.tags[0].TAG_ID,
        )

        result = SpecialtyScoreService.recompute_tag_score(
            business_specialty_id=(
                self.business_specialties[0].BST_ID
            ),
            reference_time=self.REFERENCE_TIME,
        )

        self.assertGreater(
            result.tag_score,
            Decimal("0"),
        )
        self.assertFalse(
            BusinessSpecialtyTag.objects.get(
                BST_ID=self.business_specialties[0].BST_ID,
            ).BST_IS_ACTIVE,
        )

    def test_vouches_remain_stored_while_specialty_is_inactive(self):
        vouch = self._create_vouch(
            explorer_index=13,
        )

        BusinessSpecialtyService.deactivate_specialty(
            business_id=self.business.BUSN_ID,
            tag_id=self.tags[0].TAG_ID,
        )
        self._recompute_business()

        self.assertTrue(
            BusinessVouch.objects.filter(
                VOUCH_ID=vouch.VOUCH_ID,
            ).exists(),
        )

    def test_reactivated_specialty_reuses_historical_valid_evidence(self):
        vouch = self._create_vouch(
            explorer_index=14,
            reputation_snapshot=Decimal("0.45"),
            age_days=Decimal("30"),
        )
        original_specialty_id = self.business_specialties[0].BST_ID
        BusinessSpecialtyService.deactivate_specialty(
            business_id=self.business.BUSN_ID,
            tag_id=self.tags[0].TAG_ID,
        )
        BusinessSpecialtyService.reactivate_specialty(
            business_id=self.business.BUSN_ID,
            tag_id=self.tags[0].TAG_ID,
        )

        result = self._recompute_business()
        tag_result = next(
            item
            for item in result.tag_scores
            if item.business_specialty_id == original_specialty_id
        )

        self.assertGreater(
            tag_result.tag_score,
            Decimal("0"),
        )
        self.assertEqual(
            tag_result.valid_evidence_count,
            1,
        )
        self.assertTrue(
            BusinessVouch.objects.filter(
                VOUCH_ID=vouch.VOUCH_ID,
            ).exists(),
        )

    def test_reactivation_recomputes_decay_at_current_reference_time(self):
        self._create_vouch(
            explorer_index=15,
            reputation_snapshot=Decimal("0.50"),
        )
        BusinessSpecialtyService.deactivate_specialty(
            business_id=self.business.BUSN_ID,
            tag_id=self.tags[0].TAG_ID,
        )
        BusinessSpecialtyService.reactivate_specialty(
            business_id=self.business.BUSN_ID,
            tag_id=self.tags[0].TAG_ID,
        )

        current = self._recompute_business()
        later = SpecialtyScoreService.recompute_business_specialty_score(
            business_id=self.business.BUSN_ID,
            reference_time=(
                self.REFERENCE_TIME
                + timedelta(days=90)
            ),
        )

        self.assertLess(
            later.specialty_score,
            current.specialty_score,
        )

    def test_reactivation_does_not_change_reputation_snapshot(self):
        vouch = self._create_vouch(
            explorer_index=16,
            reputation_snapshot=Decimal("0.33"),
        )
        BusinessSpecialtyService.deactivate_specialty(
            business_id=self.business.BUSN_ID,
            tag_id=self.tags[0].TAG_ID,
        )
        BusinessSpecialtyService.reactivate_specialty(
            business_id=self.business.BUSN_ID,
            tag_id=self.tags[0].TAG_ID,
        )

        self._recompute_business()
        vouch.refresh_from_db()

        self.assertEqual(
            vouch.VOUCH_REPUTATION_SNAPSHOT,
            Decimal("0.33"),
        )

    def test_three_active_tag_scores_use_denominator_three(self):
        self._create_vouch(
            explorer_index=17,
            business_specialty_index=0,
            reputation_snapshot=Decimal("0.20"),
        )
        self._create_vouch(
            explorer_index=18,
            business_specialty_index=1,
            reputation_snapshot=Decimal("0.40"),
        )
        self._create_vouch(
            explorer_index=19,
            business_specialty_index=2,
            reputation_snapshot=Decimal("0.60"),
        )

        result = self._recompute_business()
        expected = SpecialtyScoreService._quantize_score(
            SpecialtyScoreService.calculate_specialty_score(
                tag_scores=[
                    Decimal("1") - Decimal("-0.20").exp(),
                    Decimal("1") - Decimal("-0.40").exp(),
                    Decimal("1") - Decimal("-0.60").exp(),
                ],
            ),
        )

        self.assertEqual(
            result.specialty_score,
            expected,
        )
        self.assertTrue(
            result.has_expected_active_specialty_count,
        )

    def test_two_active_specialties_still_use_denominator_three(self):
        self._create_vouch(
            explorer_index=20,
            business_specialty_index=0,
            reputation_snapshot=Decimal("0.50"),
        )
        self._create_vouch(
            explorer_index=21,
            business_specialty_index=1,
            reputation_snapshot=Decimal("0.50"),
        )
        BusinessSpecialtyService.deactivate_specialty(
            business_id=self.business.BUSN_ID,
            tag_id=self.tags[2].TAG_ID,
        )

        result = self._recompute_business()
        tag_total = sum(
            (
                item.tag_score
                for item in result.tag_scores
            ),
            Decimal("0"),
        )

        self.assertAlmostEqual(
            result.specialty_score,
            tag_total / Decimal("3"),
            places=5,
        )
        self.assertFalse(
            result.has_expected_active_specialty_count,
        )
        self.assertEqual(
            result.expected_active_specialty_count,
            3,
        )

    def test_one_active_specialty_still_uses_denominator_three(self):
        self._create_vouch(
            explorer_index=22,
            business_specialty_index=0,
            reputation_snapshot=Decimal("0.60"),
        )
        for tag in self.tags[1:]:
            BusinessSpecialtyService.deactivate_specialty(
                business_id=self.business.BUSN_ID,
                tag_id=tag.TAG_ID,
            )

        result = self._recompute_business()

        self.assertAlmostEqual(
            result.specialty_score,
            result.tag_scores[0].tag_score / Decimal("3"),
            places=5,
        )
        self.assertEqual(
            result.active_specialty_count,
            1,
        )

    def test_zero_active_specialties_returns_zero_sc(self):
        for tag in self.tags:
            BusinessSpecialtyService.deactivate_specialty(
                business_id=self.business.BUSN_ID,
                tag_id=tag.TAG_ID,
            )

        result = self._recompute_business()

        self.assertEqual(
            result.specialty_score,
            Decimal("0.00000"),
        )
        self.assertEqual(
            result.active_specialty_count,
            0,
        )

    def test_unsupported_active_specialty_contributes_zero(self):
        self._create_vouch(
            explorer_index=23,
            business_specialty_index=0,
            reputation_snapshot=Decimal("0.50"),
        )

        result = self._recompute_business()
        scores = [
            item.tag_score
            for item in result.tag_scores
        ]

        self.assertEqual(
            scores.count(
                Decimal("0.00000"),
            ),
            2,
        )

    def test_current_tag_score_and_timestamp_are_persisted(self):
        self._create_vouch(
            explorer_index=24,
            reputation_snapshot=Decimal("0.50"),
        )

        result = SpecialtyScoreService.recompute_tag_score(
            business_specialty_id=(
                self.business_specialties[0].BST_ID
            ),
            reference_time=self.REFERENCE_TIME,
        )
        business_specialty = BusinessSpecialtyTag.objects.get(
            BST_ID=self.business_specialties[0].BST_ID,
        )

        self.assertEqual(
            business_specialty.BST_TAG_SCORE,
            result.tag_score,
        )
        self.assertEqual(
            business_specialty.BST_SCORE_UPDATED_AT,
            self.REFERENCE_TIME,
        )

    def test_uncomputed_tag_score_defaults_to_zero_without_timestamp(self):
        business_specialty = BusinessSpecialtyTag.objects.get(
            BST_ID=self.business_specialties[0].BST_ID,
        )

        self.assertEqual(
            business_specialty.BST_TAG_SCORE,
            Decimal("0.00000"),
        )
        self.assertIsNone(
            business_specialty.BST_SCORE_UPDATED_AT,
        )

    def test_business_persistence_failure_leaves_no_partial_tag_writes(self):
        self._create_vouch(
            explorer_index=25,
            business_specialty_index=0,
            reputation_snapshot=Decimal("0.50"),
        )

        with patch(
            "django.db.models.query.QuerySet.bulk_update",
            side_effect=RuntimeError("Simulated persistence failure."),
        ):
            with self.assertRaises(RuntimeError):
                self._recompute_business()

        business_specialties = BusinessSpecialtyTag.objects.filter(
            BUSN_ID=self.business,
        )

        for business_specialty in business_specialties:
            self.assertEqual(
                business_specialty.BST_TAG_SCORE,
                Decimal("0.00000"),
            )
            self.assertIsNone(
                business_specialty.BST_SCORE_UPDATED_AT,
            )

    def test_specialty_score_does_not_create_partial_discovery_score(self):
        self._create_vouch(
            explorer_index=26,
            reputation_snapshot=Decimal("0.50"),
        )

        result = self._recompute_business()

        self.assertGreater(
            result.specialty_score,
            Decimal("0"),
        )
        self.assertFalse(
            DiscoveryScore.objects.filter(
                BUSN_ID=self.business,
            ).exists(),
        )

    def test_scoring_does_not_change_reputation_or_events(self):
        explorer = self._get_explorer(
            27,
            reputation=Decimal("0.55"),
        )
        vouch = BusinessVouch.objects.create(
            BUSN_ID=self.business,
            USER_ID=explorer,
            TAG_ID=self.tags[0],
            VOUCH_REPUTATION_SNAPSHOT=Decimal("0.35"),
        )
        BusinessVouch.objects.filter(
            VOUCH_ID=vouch.VOUCH_ID,
        ).update(
            VOUCH_CREATED_AT=self.REFERENCE_TIME,
        )
        event_count = ReputationEvent.objects.count()

        self._recompute_business()
        explorer.refresh_from_db()
        vouch.refresh_from_db()

        self.assertEqual(
            explorer.USER_REPUTATION,
            Decimal("0.55"),
        )
        self.assertEqual(
            ReputationEvent.objects.count(),
            event_count,
        )
        self.assertEqual(
            vouch.VOUCH_REPUTATION_SNAPSHOT,
            Decimal("0.35"),
        )

    def test_invalid_vouch_remains_stored_after_scoring(self):
        invalid_vouch = self._create_vouch(
            explorer_index=28,
            reputation_snapshot=Decimal("0.80"),
            is_valid=False,
        )

        result = self._recompute_business()

        self.assertTrue(
            BusinessVouch.objects.filter(
                VOUCH_ID=invalid_vouch.VOUCH_ID,
            ).exists(),
        )
        self.assertEqual(
            result.specialty_score,
            Decimal("0.00000"),
        )

    def test_configuration_has_no_confidence_fields(self):
        configuration = (
            DiscoveryAlgorithmConfigurationService
            .get_current_configuration()
        )

        self.assertFalse(
            hasattr(
                configuration,
                "DAC_VOUCH_ONLY_CONFIDENCE",
            ),
        )
        self.assertFalse(
            hasattr(
                configuration,
                "DAC_VOUCH_REVIEW_CONFIDENCE",
            ),
        )
        self.assertFalse(
            hasattr(
                configuration,
                "DAC_VOUCH_REVIEW_PHOTO_CONFIDENCE",
            ),
        )

    def test_worked_reference_example_matches_formula(self):
        evidence = [
            SpecialtyEvidenceInput(
                evidence_id=1,
                created_at=(
                    self.REFERENCE_TIME
                    - timedelta(days=60)
                ),
                reputation_snapshot=Decimal("0.20"),
            ),
            SpecialtyEvidenceInput(
                evidence_id=2,
                created_at=(
                    self.REFERENCE_TIME
                    - timedelta(days=30)
                ),
                reputation_snapshot=Decimal("0.50"),
            ),
            SpecialtyEvidenceInput(
                evidence_id=3,
                created_at=self.REFERENCE_TIME,
                reputation_snapshot=Decimal("0.80"),
            ),
        ]

        result = SpecialtyScoreService.calculate_tag_score(
            evidence=evidence,
            decay_rate=Decimal("0.10"),
            reference_time=self.REFERENCE_TIME,
        )

        with localcontext() as context:
            context.prec = 40
            first_decay = Decimal("-0.20").exp()
            second_decay = Decimal("-0.10").exp()
            third_decay = Decimal("1")
            first_dampening = Decimal("1")
            second_dampening = Decimal("1") / Decimal("2").sqrt()
            third_dampening = Decimal("1") / Decimal("3").sqrt()
            first_contribution = (
                Decimal("0.20")
                * first_decay
                * first_dampening
            )
            second_contribution = (
                Decimal("0.50")
                * second_decay
                * second_dampening
            )
            third_contribution = (
                Decimal("0.80")
                * third_decay
                * third_dampening
            )
            expected_raw = (
                first_contribution
                + second_contribution
                + third_contribution
            )
            expected_tag_score = (
                Decimal("1")
                - (-expected_raw).exp()
            )

        self.assertAlmostEqual(
            result.contributions[0].decay,
            first_decay,
            places=20,
        )
        self.assertAlmostEqual(
            result.contributions[1].dampening,
            second_dampening,
            places=20,
        )
        self.assertAlmostEqual(
            result.contributions[2].contribution,
            third_contribution,
            places=20,
        )
        self.assertAlmostEqual(
            result.raw_tag_evidence,
            expected_raw,
            places=20,
        )
        self.assertAlmostEqual(
            result.tag_score,
            expected_tag_score,
            places=20,
        )

    def test_vouch_service_counters_still_work_before_scoring(self):
        explorer = self._get_explorer(
            29,
        )
        vouch = VouchService.create_vouch(
            user=explorer,
            business_id=self.business.BUSN_ID,
            tag_id=self.tags[0].TAG_ID,
        )
        BusinessVouch.objects.filter(
            VOUCH_ID=vouch.VOUCH_ID,
        ).update(
            VOUCH_CREATED_AT=self.REFERENCE_TIME,
        )

        self._recompute_business()
        self.business.refresh_from_db()
        business_specialty = BusinessSpecialtyTag.objects.get(
            BST_ID=self.business_specialties[0].BST_ID,
        )

        self.assertEqual(
            self.business.BUSN_VOUCH_COUNT,
            1,
        )
        self.assertEqual(
            business_specialty.BST_VOUCH_COUNT,
            1,
        )
