from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework.exceptions import NotFound

from apps.admin_operations.system_configuration.services.discovery_algorithm_configuration_service import (
    DiscoveryAlgorithmConfigurationService,
)
from apps.business.models import (
    Business,
    BusinessPocket,
    BusinessSpecialtyTag,
    BusinessVouch,
    Category,
    Cluster,
    DiscoveryScore,
    Location,
    SpecialtyTag,
)
from apps.business.services.discovery_score_service import (
    DiscoveryScoreRecomputeStatus,
    DiscoveryScoreService,
    StaleDiscoveryScoreResult,
)
from apps.business.services.specialty_score_service import (
    BusinessSpecialtyScore,
    SpecialtyScoreService,
)
from apps.business.services.visibility_event_service import (
    VisibilityEventService,
    VisibilityTrackingUnavailable,
)
from apps.business.services.visibility_gap_service import (
    VisibilityComparisonLevel,
    VisibilityGapResult,
    VisibilityGapService,
)
from apps.users.models import ReputationEvent, User


class DiscoveryScoreServiceTests(TestCase):
    """Tests the full current-score calculation and persistence flow."""

    REFERENCE_TIME = datetime(
        2026,
        9,
        20,
        12,
        0,
        tzinfo=UTC,
    )

    @classmethod
    def setUpTestData(cls):
        """Creates one active business with three active specialties."""

        cls.owner = User.objects.create_user(
            email="discovery-score-owner@example.com",
            password=None,
            USER_FNAME="Discovery",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        cls.cluster = Cluster.objects.create(
            CLUS_NAME="Discovery Score Cluster",
            CLUS_DESCRIPTION="Discovery score test cluster.",
        )
        cls.category = Category.objects.create(
            CTGRY_NAME="Discovery Score Category",
            CTGRY_DESCRIPTION="Discovery score test category.",
            CLUS_ID=cls.cluster,
        )
        cls.location = Location.objects.create(
            LOCT_POINT=Point(
                123.8854,
                10.3157,
                srid=4326,
            ),
            LOCT_ADDRESS="Discovery Score Street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        cls.business = Business.objects.create(
            BUSN_NAME="Discovery Score Business",
            BUSN_DESCRIPTION="A business used for full score tests.",
            BUSN_CONTACT_NUMBER="09171234567",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=cls.owner,
            CTGRY_ID=cls.category,
            LOCT_ID=cls.location,
        )
        cls.specialties = []

        for index in range(3):
            tag = SpecialtyTag.objects.create(
                TAG_NAME=f"Discovery Score Specialty {index}",
                TAG_COLOR="blue",
            )
            business_specialty = BusinessSpecialtyTag.objects.create(
                BUSN_ID=cls.business,
                TAG_ID=tag,
            )
            cls.specialties.append(
                business_specialty,
            )

    def setUp(self):
        """Restores score data and the default calculation settings."""

        DiscoveryScore.objects.all().delete()
        BusinessVouch.objects.filter(
            BUSN_ID=self.business,
        ).delete()
        BusinessPocket.objects.filter(
            BUSN_ID=self.business,
        ).delete()
        ReputationEvent.objects.all().delete()
        BusinessSpecialtyTag.objects.filter(
            BUSN_ID=self.business,
        ).update(
            BST_IS_ACTIVE=True,
            BST_DEACTIVATED_AT=None,
            BST_TAG_SCORE=Decimal("0.00000"),
            BST_SCORE_UPDATED_AT=None,
        )
        Business.objects.filter(
            BUSN_ID=self.business.BUSN_ID,
        ).update(
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            BUSN_POCKET_COUNT=0,
        )

        self.configuration = (
            DiscoveryAlgorithmConfigurationService
            .get_current_configuration()
        )
        self.configuration.DAC_SPECIALTY_SCORE_WEIGHT = Decimal("0.80")
        self.configuration.DAC_VISIBILITY_GAP_WEIGHT = Decimal("0.20")
        self.configuration.DAC_DECAY_RATE = Decimal("0.10")
        self.configuration.DAC_MIN_CATEGORY_COMPARISON_SIZE = 1
        self.configuration.DAC_MIN_CLUSTER_COMPARISON_SIZE = 1
        self.configuration.DAC_VISIBILITY_WINDOW_DAYS = 30
        self.configuration.DAC_IMPRESSION_WEIGHT = Decimal("0.60")
        self.configuration.DAC_PROFILE_VISIT_WEIGHT = Decimal("0.20")
        self.configuration.DAC_SAVE_WEIGHT = Decimal("0.20")
        self.configuration.save(
            update_fields=[
                "DAC_SPECIALTY_SCORE_WEIGHT",
                "DAC_VISIBILITY_GAP_WEIGHT",
                "DAC_DECAY_RATE",
                "DAC_MIN_CATEGORY_COMPARISON_SIZE",
                "DAC_MIN_CLUSTER_COMPARISON_SIZE",
                "DAC_VISIBILITY_WINDOW_DAYS",
                "DAC_IMPRESSION_WEIGHT",
                "DAC_PROFILE_VISIT_WEIGHT",
                "DAC_SAVE_WEIGHT",
                "DAC_UPDATED_AT",
            ],
        )

    def _specialty_result(
        self,
        specialty_score: Decimal,
        business_id: int | None = None,
    ) -> BusinessSpecialtyScore:
        """Builds a simple Specialty Score result for orchestration tests."""

        if business_id is None:
            business_id = self.business.BUSN_ID

        return BusinessSpecialtyScore(
            business_id=business_id,
            specialty_score=specialty_score,
            active_specialty_count=3,
            expected_active_specialty_count=3,
            has_expected_active_specialty_count=True,
            tag_scores=(),
            score_updated_at=self.REFERENCE_TIME,
        )

    def _visibility_result(
        self,
        visibility_gap: Decimal,
        business_id: int | None = None,
    ) -> VisibilityGapResult:
        """Builds a simple Visibility Gap result for orchestration tests."""

        if business_id is None:
            business_id = self.business.BUSN_ID

        return VisibilityGapResult(
            business_id=business_id,
            comparison_group_level=VisibilityComparisonLevel.CATEGORY,
            comparison_group_size=1,
            window_start=datetime(
                2026,
                8,
                21,
                12,
                0,
                tzinfo=UTC,
            ),
            window_end=self.REFERENCE_TIME,
            impression_count=0,
            profile_visit_count=0,
            unique_saver_count=0,
            maximum_impression_count=0,
            maximum_profile_visit_count=0,
            maximum_unique_saver_count=0,
            normalized_impressions=Decimal("0.00000"),
            normalized_profile_visits=Decimal("0.00000"),
            normalized_saves=Decimal("0.00000"),
            traction=(
                Decimal("1.00000")
                - visibility_gap
            ),
            visibility_gap=visibility_gap,
        )

    def _recompute_with_results(
        self,
        specialty_score: Decimal,
        visibility_gap: Decimal,
    ):
        """Runs the combined service with controlled lower-level results."""

        with patch.object(
            VisibilityGapService,
            "calculate_business_visibility_gap",
            return_value=self._visibility_result(
                visibility_gap,
            ),
        ), patch.object(
            SpecialtyScoreService,
            "recompute_business_specialty_score",
            return_value=self._specialty_result(
                specialty_score,
            ),
        ):
            return DiscoveryScoreService.recompute_business_score(
                business_id=self.business.BUSN_ID,
                reference_time=self.REFERENCE_TIME,
            )

    def _create_explorer(
        self,
        reputation: Decimal,
    ) -> User:
        """Creates an explorer with a chosen current reputation."""

        return User.objects.create_user(
            email=f"score-explorer-{reputation}@example.com",
            password=None,
            USER_FNAME="Score",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
            USER_REPUTATION=reputation,
        )

    def test_default_formula_examples(self):
        """Uses the configured default weights for deterministic examples."""

        equal_components = (
            DiscoveryScoreService.calculate_discovery_score(
                specialty_score=Decimal("0.62000"),
                visibility_gap=Decimal("0.62000"),
                specialty_weight=Decimal("0.80"),
                visibility_weight=Decimal("0.20"),
            )
        )
        weighted_components = (
            DiscoveryScoreService.calculate_discovery_score(
                specialty_score=Decimal("0.70000"),
                visibility_gap=Decimal("0.20000"),
                specialty_weight=Decimal("0.80"),
                visibility_weight=Decimal("0.20"),
            )
        )

        self.assertEqual(
            equal_components,
            Decimal("0.6200000"),
        )
        self.assertEqual(
            weighted_components,
            Decimal("0.6000000"),
        )

    def test_formula_boundary_examples(self):
        """Calculates expected scores at the formula boundaries."""

        cases = (
            (
                Decimal("0"),
                Decimal("1"),
                Decimal("0.20"),
            ),
            (
                Decimal("1"),
                Decimal("0"),
                Decimal("0.80"),
            ),
            (
                Decimal("1"),
                Decimal("1"),
                Decimal("1.00"),
            ),
        )

        for specialty_score, visibility_gap, expected in cases:
            with self.subTest(
                specialty_score=specialty_score,
                visibility_gap=visibility_gap,
            ):
                result = DiscoveryScoreService.calculate_discovery_score(
                    specialty_score=specialty_score,
                    visibility_gap=visibility_gap,
                    specialty_weight=Decimal("0.80"),
                    visibility_weight=Decimal("0.20"),
                )

                self.assertEqual(
                    result,
                    expected,
                )

    def test_formula_uses_supplied_weights_and_decimal_precision(self):
        """Changes weights without changing formula code or using floats."""

        result = DiscoveryScoreService.calculate_discovery_score(
            specialty_score=Decimal("0.12345"),
            visibility_gap=Decimal("0.98765"),
            specialty_weight=Decimal("0.35"),
            visibility_weight=Decimal("0.65"),
        )

        self.assertIsInstance(
            result,
            Decimal,
        )
        self.assertEqual(
            result,
            Decimal("0.6851800"),
        )

    def test_formula_clamps_values_defensively(self):
        """Keeps unexpected calculated scores within zero and one."""

        upper = DiscoveryScoreService.calculate_discovery_score(
            specialty_score=Decimal("2"),
            visibility_gap=Decimal("2"),
            specialty_weight=Decimal("0.80"),
            visibility_weight=Decimal("0.20"),
        )
        lower = DiscoveryScoreService.calculate_discovery_score(
            specialty_score=Decimal("-2"),
            visibility_gap=Decimal("-2"),
            specialty_weight=Decimal("0.80"),
            visibility_weight=Decimal("0.20"),
        )

        self.assertEqual(
            upper,
            Decimal("1"),
        )
        self.assertEqual(
            lower,
            Decimal("0"),
        )

    def test_first_recompute_creates_one_current_score(self):
        """Creates one current aggregate record on the first recomputation."""

        result = self._recompute_with_results(
            specialty_score=Decimal("0.70000"),
            visibility_gap=Decimal("0.20000"),
        )
        score_record = DiscoveryScore.objects.get(
            BUSN_ID=self.business,
        )

        self.assertEqual(
            DiscoveryScore.objects.filter(
                BUSN_ID=self.business,
            ).count(),
            1,
        )
        self.assertEqual(
            score_record.DSC_S_SCORE,
            Decimal("0.70000"),
        )
        self.assertEqual(
            score_record.DSC_V_SCORE,
            Decimal("0.20000"),
        )
        self.assertEqual(
            score_record.DSC_D_SCORE,
            Decimal("0.60000"),
        )
        self.assertEqual(
            score_record.DSC_COMPUTED_AT,
            self.REFERENCE_TIME,
        )
        self.assertEqual(
            result.discovery_score_id,
            score_record.DSC_ID,
        )

    def test_second_recompute_updates_same_score_record(self):
        """Updates the same row instead of appending relational history."""

        first_result = self._recompute_with_results(
            specialty_score=Decimal("0.70000"),
            visibility_gap=Decimal("0.20000"),
        )
        second_result = self._recompute_with_results(
            specialty_score=Decimal("0.25000"),
            visibility_gap=Decimal("0.75000"),
        )
        score_record = DiscoveryScore.objects.get(
            BUSN_ID=self.business,
        )

        self.assertEqual(
            first_result.discovery_score_id,
            second_result.discovery_score_id,
        )
        self.assertEqual(
            DiscoveryScore.objects.filter(
                BUSN_ID=self.business,
            ).count(),
            1,
        )
        self.assertEqual(
            score_record.DSC_D_SCORE,
            Decimal("0.35000"),
        )

    def test_business_has_one_to_one_current_score(self):
        """Enforces one score row per business at the database level."""

        self._recompute_with_results(
            specialty_score=Decimal("0.10000"),
            visibility_gap=Decimal("0.90000"),
        )

        with self.assertRaises(IntegrityError), transaction.atomic():
            DiscoveryScore.objects.create(
                BUSN_ID=self.business,
                DSC_S_SCORE=Decimal("0.00000"),
                DSC_V_SCORE=Decimal("1.00000"),
                DSC_D_SCORE=Decimal("0.20000"),
                DSC_COMPUTED_AT=self.REFERENCE_TIME,
            )

        persisted_score = DiscoveryScore.objects.get(
            BUSN_ID=self.business,
        )

        self.assertEqual(
            persisted_score.DSC_D_SCORE,
            Decimal("0.26000"),
        )

    def test_model_has_final_precision_bounds_and_no_history_flag(self):
        """Uses five-decimal bounded fields without the legacy current flag."""

        field_names = {
            field.name
            for field in DiscoveryScore._meta.get_fields()
        }

        self.assertNotIn(
            "DSC_IS_CURRENT",
            field_names,
        )

        for field_name in (
            "DSC_S_SCORE",
            "DSC_V_SCORE",
            "DSC_D_SCORE",
        ):
            field = DiscoveryScore._meta.get_field(
                field_name,
            )
            self.assertEqual(
                field.max_digits,
                6,
            )
            self.assertEqual(
                field.decimal_places,
                5,
            )

        score_record = DiscoveryScore.objects.create(
            BUSN_ID=self.business,
            DSC_S_SCORE=Decimal("0.50000"),
            DSC_V_SCORE=Decimal("0.50000"),
            DSC_D_SCORE=Decimal("0.50000"),
            DSC_COMPUTED_AT=self.REFERENCE_TIME,
        )

        for field_name in (
            "DSC_S_SCORE",
            "DSC_V_SCORE",
            "DSC_D_SCORE",
        ):
            with self.subTest(
                field_name=field_name,
            ), self.assertRaises(IntegrityError), transaction.atomic():
                DiscoveryScore.objects.filter(
                    DSC_ID=score_record.DSC_ID,
                ).update(
                    **{
                        field_name: Decimal("1.00001"),
                    },
                )

    def test_combined_service_passes_one_configuration_and_reference_time(self):
        """Supplies the same settings object and time to both lower services."""

        specialty_result = self._specialty_result(
            Decimal("0.70000"),
        )
        visibility_result = self._visibility_result(
            Decimal("0.20000"),
        )

        with patch.object(
            DiscoveryAlgorithmConfigurationService,
            "get_current_configuration",
            return_value=self.configuration,
        ) as configuration_mock, patch.object(
            VisibilityGapService,
            "calculate_business_visibility_gap",
            return_value=visibility_result,
        ) as visibility_mock, patch.object(
            SpecialtyScoreService,
            "recompute_business_specialty_score",
            return_value=specialty_result,
        ) as specialty_mock:
            result = DiscoveryScoreService.recompute_business_score(
                business_id=self.business.BUSN_ID,
                reference_time=self.REFERENCE_TIME,
            )

        configuration_mock.assert_called_once_with()
        self.assertIs(
            visibility_mock.call_args.kwargs["configuration"],
            self.configuration,
        )
        self.assertIs(
            specialty_mock.call_args.kwargs["configuration"],
            self.configuration,
        )
        self.assertEqual(
            visibility_mock.call_args.kwargs["reference_time"],
            self.REFERENCE_TIME,
        )
        self.assertEqual(
            specialty_mock.call_args.kwargs["reference_time"],
            self.REFERENCE_TIME,
        )
        self.assertEqual(
            result.reference_time,
            self.REFERENCE_TIME,
        )

    def test_changed_configuration_weights_change_persisted_score(self):
        """Reads aggregate weights from the authoritative configuration."""

        self.configuration.DAC_SPECIALTY_SCORE_WEIGHT = Decimal("0.50")
        self.configuration.DAC_VISIBILITY_GAP_WEIGHT = Decimal("0.50")
        self.configuration.save(
            update_fields=[
                "DAC_SPECIALTY_SCORE_WEIGHT",
                "DAC_VISIBILITY_GAP_WEIGHT",
                "DAC_UPDATED_AT",
            ],
        )

        result = self._recompute_with_results(
            specialty_score=Decimal("0.80000"),
            visibility_gap=Decimal("0.20000"),
        )

        self.assertEqual(
            result.discovery_score,
            Decimal("0.50000"),
        )

    def test_real_recompute_uses_vouch_snapshot_and_stores_same_run(self):
        """Uses the immutable vouch snapshot and one time for TagScore and SC."""

        explorer = self._create_explorer(
            reputation=Decimal("0.90000"),
        )
        vouch = BusinessVouch.objects.create(
            BUSN_ID=self.business,
            USER_ID=explorer,
            TAG_ID=self.specialties[0].TAG_ID,
            VOUCH_REPUTATION_SNAPSHOT=Decimal("0.20000"),
        )
        BusinessVouch.objects.filter(
            VOUCH_ID=vouch.VOUCH_ID,
        ).update(
            VOUCH_CREATED_AT=self.REFERENCE_TIME,
        )

        with patch.object(
            VisibilityGapService,
            "calculate_business_visibility_gap",
            return_value=self._visibility_result(
                Decimal("1.00000"),
            ),
        ):
            result = DiscoveryScoreService.recompute_business_score(
                business_id=self.business.BUSN_ID,
                reference_time=self.REFERENCE_TIME,
            )

        expected_tag_score = Decimal("0.18127")
        expected_specialty_score = Decimal("0.06042")
        self.specialties[0].refresh_from_db()
        vouch.refresh_from_db()

        self.assertEqual(
            self.specialties[0].BST_TAG_SCORE,
            expected_tag_score,
        )
        self.assertEqual(
            self.specialties[0].BST_SCORE_UPDATED_AT,
            self.REFERENCE_TIME,
        )
        self.assertEqual(
            result.specialty_score,
            expected_specialty_score,
        )
        self.assertEqual(
            result.reference_time,
            self.REFERENCE_TIME,
        )
        self.assertEqual(
            vouch.VOUCH_REPUTATION_SNAPSHOT,
            Decimal("0.20000"),
        )
        self.assertEqual(
            explorer.USER_REPUTATION,
            Decimal("0.90000"),
        )
        self.assertFalse(
            ReputationEvent.objects.exists(),
        )

    def test_new_business_without_evidence_or_visibility_scores_point_two(self):
        """Stores SC zero, VG one, and DS point two for a new business."""

        with patch.object(
            VisibilityEventService,
            "get_recent_visibility_metrics",
            return_value={},
        ):
            result = DiscoveryScoreService.recompute_business_score(
                business_id=self.business.BUSN_ID,
                reference_time=self.REFERENCE_TIME,
            )

        self.assertEqual(
            result.specialty_score,
            Decimal("0.00000"),
        )
        self.assertEqual(
            result.visibility_gap,
            Decimal("1.00000"),
        )
        self.assertEqual(
            result.discovery_score,
            Decimal("0.20000"),
        )
        self.assertTrue(
            all(
                tag_score.tag_score == Decimal("0.00000")
                for tag_score in result.tag_scores
            ),
        )

    def test_result_surfaces_specialty_health_and_visibility_group(self):
        """Returns the count health and comparison details needed for audit."""

        BusinessSpecialtyTag.objects.filter(
            BST_ID=self.specialties[2].BST_ID,
        ).update(
            BST_IS_ACTIVE=False,
        )

        with patch.object(
            VisibilityEventService,
            "get_recent_visibility_metrics",
            return_value={},
        ):
            result = DiscoveryScoreService.recompute_business_score(
                business_id=self.business.BUSN_ID,
                reference_time=self.REFERENCE_TIME,
            )

        self.assertEqual(
            result.active_specialty_count,
            2,
        )
        self.assertEqual(
            result.expected_active_specialty_count,
            3,
        )
        self.assertFalse(
            result.has_expected_active_specialty_count,
        )
        self.assertEqual(
            result.visibility_comparison_level,
            VisibilityComparisonLevel.CATEGORY,
        )
        self.assertEqual(
            result.visibility_comparison_group_size,
            1,
        )

    def test_inactive_business_is_not_persisted_after_visibility_calculation(self):
        """Rechecks active status before writing a requested business score."""

        Business.objects.filter(
            BUSN_ID=self.business.BUSN_ID,
        ).update(
            BUSN_STATUS=Business.BusinessStatus.SUSPENDED,
        )

        with patch.object(
            VisibilityGapService,
            "calculate_business_visibility_gap",
            return_value=self._visibility_result(
                Decimal("1.00000"),
            ),
        ), self.assertRaises(NotFound):
            DiscoveryScoreService.recompute_business_score(
                business_id=self.business.BUSN_ID,
                reference_time=self.REFERENCE_TIME,
            )

        self.assertFalse(
            DiscoveryScore.objects.filter(
                BUSN_ID=self.business,
            ).exists(),
        )

    def test_visibility_failure_preserves_previous_score_and_tag_scores(self):
        """Leaves the last successful PostgreSQL score unchanged on VG failure."""

        existing_score = DiscoveryScore.objects.create(
            BUSN_ID=self.business,
            DSC_S_SCORE=Decimal("0.40000"),
            DSC_V_SCORE=Decimal("0.30000"),
            DSC_D_SCORE=Decimal("0.38000"),
            DSC_COMPUTED_AT=self.REFERENCE_TIME,
        )
        BusinessSpecialtyTag.objects.filter(
            BUSN_ID=self.business,
        ).update(
            BST_TAG_SCORE=Decimal("0.34567"),
        )

        with patch.object(
            VisibilityGapService,
            "calculate_business_visibility_gap",
            side_effect=VisibilityTrackingUnavailable(),
        ), patch.object(
            SpecialtyScoreService,
            "recompute_business_specialty_score",
        ) as specialty_mock, self.assertRaises(
            VisibilityTrackingUnavailable,
        ):
            DiscoveryScoreService.recompute_business_score(
                business_id=self.business.BUSN_ID,
                reference_time=self.REFERENCE_TIME,
            )

        existing_score.refresh_from_db()
        specialty_mock.assert_not_called()
        self.assertEqual(
            existing_score.DSC_D_SCORE,
            Decimal("0.38000"),
        )
        self.assertFalse(
            BusinessSpecialtyTag.objects.filter(
                BUSN_ID=self.business,
            ).exclude(
                BST_TAG_SCORE=Decimal("0.34567"),
            ).exists(),
        )

    def test_aggregate_failure_rolls_back_tag_score_updates(self):
        """Rolls back current TagScores when aggregate persistence fails."""

        explorer = self._create_explorer(
            reputation=Decimal("0.20000"),
        )
        BusinessVouch.objects.create(
            BUSN_ID=self.business,
            USER_ID=explorer,
            TAG_ID=self.specialties[0].TAG_ID,
            VOUCH_REPUTATION_SNAPSHOT=Decimal("0.20000"),
        )
        BusinessSpecialtyTag.objects.filter(
            BUSN_ID=self.business,
        ).update(
            BST_TAG_SCORE=Decimal("0.11111"),
            BST_SCORE_UPDATED_AT=None,
        )

        with patch.object(
            VisibilityGapService,
            "calculate_business_visibility_gap",
            return_value=self._visibility_result(
                Decimal("1.00000"),
            ),
        ), patch.object(
            DiscoveryScore.objects,
            "create",
            side_effect=RuntimeError(
                "aggregate write failed",
            ),
        ), self.assertRaisesRegex(
            RuntimeError,
            "aggregate write failed",
        ):
            DiscoveryScoreService.recompute_business_score(
                business_id=self.business.BUSN_ID,
                reference_time=self.REFERENCE_TIME,
            )

        self.assertFalse(
            DiscoveryScore.objects.filter(
                BUSN_ID=self.business,
            ).exists(),
        )
        self.assertFalse(
            BusinessSpecialtyTag.objects.filter(
                BUSN_ID=self.business,
            ).exclude(
                BST_TAG_SCORE=Decimal("0.11111"),
                BST_SCORE_UPDATED_AT=None,
            ).exists(),
        )

    def test_batch_reuses_one_time_configuration_and_visibility_batch(self):
        """Uses one settings snapshot and one VG batch for multiple businesses."""

        second_owner = User.objects.create_user(
            email="discovery-score-second-owner@example.com",
            password=None,
            USER_FNAME="Second",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        second_business = Business.objects.create(
            BUSN_NAME="Second Discovery Business",
            BUSN_DESCRIPTION="Second batch business.",
            BUSN_CONTACT_NUMBER="09171234568",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=second_owner,
            CTGRY_ID=self.category,
            LOCT_ID=self.location,
        )
        visibility_results = (
            self._visibility_result(
                Decimal("1.00000"),
            ),
            self._visibility_result(
                Decimal("0.50000"),
                business_id=second_business.BUSN_ID,
            ),
        )
        specialty_results = (
            self._specialty_result(
                Decimal("0.00000"),
            ),
            self._specialty_result(
                Decimal("0.25000"),
                business_id=second_business.BUSN_ID,
            ),
        )

        with patch.object(
            DiscoveryAlgorithmConfigurationService,
            "get_current_configuration",
            return_value=self.configuration,
        ) as configuration_mock, patch.object(
            VisibilityGapService,
            "calculate_visibility_gaps",
            return_value=visibility_results,
        ) as visibility_mock, patch.object(
            SpecialtyScoreService,
            "recompute_business_specialty_score",
            side_effect=specialty_results,
        ) as specialty_mock:
            batch_result = DiscoveryScoreService.recompute_business_scores(
                business_ids=[
                    self.business.BUSN_ID,
                    second_business.BUSN_ID,
                ],
                reference_time=self.REFERENCE_TIME,
            )

        configuration_mock.assert_called_once_with()
        visibility_mock.assert_called_once()
        self.assertEqual(
            specialty_mock.call_count,
            2,
        )
        self.assertTrue(
            all(
                call.kwargs["reference_time"]
                == self.REFERENCE_TIME
                for call in specialty_mock.call_args_list
            ),
        )
        self.assertTrue(
            all(
                call.kwargs["configuration"]
                is self.configuration
                for call in specialty_mock.call_args_list
            ),
        )
        self.assertEqual(
            batch_result.considered_count,
            2,
        )
        self.assertEqual(
            batch_result.updated_count,
            2,
        )
        self.assertEqual(
            batch_result.stale_count,
            0,
        )
        self.assertEqual(
            batch_result.failed_count,
            0,
        )
        self.assertEqual(
            DiscoveryScore.objects.filter(
                BUSN_ID_id__in=[
                    self.business.BUSN_ID,
                    second_business.BUSN_ID,
                ],
            ).count(),
            2,
        )

    def test_older_recompute_skips_aggregate_and_tag_score_writes(self):
        """Keeps newer aggregate and TagScores when an older run arrives."""

        newer_reference_time = self.REFERENCE_TIME
        older_reference_time = (
            newer_reference_time
            - timedelta(
                minutes=5,
            )
        )
        score_record = DiscoveryScore.objects.create(
            BUSN_ID=self.business,
            DSC_S_SCORE=Decimal("0.70000"),
            DSC_V_SCORE=Decimal("0.20000"),
            DSC_D_SCORE=Decimal("0.60000"),
            DSC_COMPUTED_AT=newer_reference_time,
        )
        BusinessSpecialtyTag.objects.filter(
            BUSN_ID=self.business,
        ).update(
            BST_TAG_SCORE=Decimal("0.45678"),
            BST_SCORE_UPDATED_AT=newer_reference_time,
        )

        with patch.object(
            VisibilityGapService,
            "calculate_business_visibility_gap",
            return_value=self._visibility_result(
                Decimal("1.00000"),
            ),
        ), patch.object(
            SpecialtyScoreService,
            "recompute_business_specialty_score",
        ) as specialty_mock:
            result = DiscoveryScoreService.recompute_business_score(
                business_id=self.business.BUSN_ID,
                reference_time=older_reference_time,
            )

        score_record.refresh_from_db()
        specialty_mock.assert_not_called()
        self.assertIsInstance(
            result,
            StaleDiscoveryScoreResult,
        )
        self.assertEqual(
            result.status,
            DiscoveryScoreRecomputeStatus.SKIPPED_STALE,
        )
        self.assertEqual(
            result.requested_reference_time,
            older_reference_time,
        )
        self.assertEqual(
            result.current_reference_time,
            newer_reference_time,
        )
        self.assertEqual(
            score_record.DSC_S_SCORE,
            Decimal("0.70000"),
        )
        self.assertEqual(
            score_record.DSC_V_SCORE,
            Decimal("0.20000"),
        )
        self.assertEqual(
            score_record.DSC_D_SCORE,
            Decimal("0.60000"),
        )
        self.assertFalse(
            BusinessSpecialtyTag.objects.filter(
                BUSN_ID=self.business,
            ).exclude(
                BST_TAG_SCORE=Decimal("0.45678"),
                BST_SCORE_UPDATED_AT=newer_reference_time,
            ).exists(),
        )

    def test_same_reference_time_recomputes_same_current_row(self):
        """Allows an equal reference time to update the existing current row."""

        score_record = DiscoveryScore.objects.create(
            BUSN_ID=self.business,
            DSC_S_SCORE=Decimal("0.10000"),
            DSC_V_SCORE=Decimal("0.10000"),
            DSC_D_SCORE=Decimal("0.10000"),
            DSC_COMPUTED_AT=self.REFERENCE_TIME,
        )

        result = self._recompute_with_results(
            specialty_score=Decimal("0.70000"),
            visibility_gap=Decimal("0.20000"),
        )
        score_record.refresh_from_db()

        self.assertEqual(
            result.status,
            DiscoveryScoreRecomputeStatus.UPDATED,
        )
        self.assertEqual(
            result.discovery_score_id,
            score_record.DSC_ID,
        )
        self.assertEqual(
            score_record.DSC_D_SCORE,
            Decimal("0.60000"),
        )
        self.assertEqual(
            DiscoveryScore.objects.filter(
                BUSN_ID=self.business,
            ).count(),
            1,
        )

    def test_newer_reference_time_updates_existing_current_row(self):
        """Lets a newer scoring run replace the current aggregate values."""

        older_reference_time = (
            self.REFERENCE_TIME
            - timedelta(
                minutes=5,
            )
        )
        score_record = DiscoveryScore.objects.create(
            BUSN_ID=self.business,
            DSC_S_SCORE=Decimal("0.10000"),
            DSC_V_SCORE=Decimal("0.10000"),
            DSC_D_SCORE=Decimal("0.10000"),
            DSC_COMPUTED_AT=older_reference_time,
        )

        result = self._recompute_with_results(
            specialty_score=Decimal("0.70000"),
            visibility_gap=Decimal("0.20000"),
        )
        score_record.refresh_from_db()

        self.assertEqual(
            result.status,
            DiscoveryScoreRecomputeStatus.UPDATED,
        )
        self.assertEqual(
            score_record.DSC_COMPUTED_AT,
            self.REFERENCE_TIME,
        )
        self.assertEqual(
            score_record.DSC_D_SCORE,
            Decimal("0.60000"),
        )

    def test_batch_surfaces_a_stale_business_skip(self):
        """Counts an older business result as stale in the batch summary."""

        older_reference_time = (
            self.REFERENCE_TIME
            - timedelta(
                minutes=5,
            )
        )
        DiscoveryScore.objects.create(
            BUSN_ID=self.business,
            DSC_S_SCORE=Decimal("0.70000"),
            DSC_V_SCORE=Decimal("0.20000"),
            DSC_D_SCORE=Decimal("0.60000"),
            DSC_COMPUTED_AT=self.REFERENCE_TIME,
        )

        with patch.object(
            VisibilityGapService,
            "calculate_visibility_gaps",
            return_value=(
                self._visibility_result(
                    Decimal("1.00000"),
                ),
            ),
        ), patch.object(
            SpecialtyScoreService,
            "recompute_business_specialty_score",
        ) as specialty_mock:
            batch_result = (
                DiscoveryScoreService.recompute_business_scores(
                    business_ids=[
                        self.business.BUSN_ID,
                    ],
                    reference_time=older_reference_time,
                )
            )

        specialty_mock.assert_not_called()
        self.assertEqual(
            batch_result.considered_count,
            1,
        )
        self.assertEqual(
            batch_result.updated_count,
            0,
        )
        self.assertEqual(
            batch_result.stale_count,
            1,
        )
        self.assertEqual(
            batch_result.failed_count,
            0,
        )

    def test_batch_isolates_known_business_domain_failures(self):
        """Continues after one business has a known service-layer failure."""

        visibility_results = (
            self._visibility_result(
                Decimal("1.00000"),
            ),
            self._visibility_result(
                Decimal("0.50000"),
                business_id=999,
            ),
        )

        with patch.object(
            VisibilityGapService,
            "calculate_visibility_gaps",
            return_value=visibility_results,
        ), patch.object(
            DiscoveryScoreService,
            "_persist_business_score",
            side_effect=(
                NotFound(
                    "The active business could not be found.",
                ),
                object(),
            ),
        ):
            batch_result = (
                DiscoveryScoreService.recompute_business_scores(
                    business_ids=[
                        self.business.BUSN_ID,
                        999,
                    ],
                    reference_time=self.REFERENCE_TIME,
                )
            )

        self.assertEqual(
            batch_result.considered_count,
            2,
        )
        self.assertEqual(
            batch_result.updated_count,
            1,
        )
        self.assertEqual(
            batch_result.failed_count,
            1,
        )
        self.assertEqual(
            batch_result.failures[0].business_id,
            self.business.BUSN_ID,
        )
        self.assertEqual(
            batch_result.failures[0].error_type,
            "NotFound",
        )

    def test_scoring_does_not_change_visibility_pocket_or_reputation_data(self):
        """Keeps source events, Pocket state, and reputation ledger read-only."""

        explorer = self._create_explorer(
            reputation=Decimal("0.30000"),
        )
        BusinessPocket.objects.create(
            USER_ID=explorer,
            BUSN_ID=self.business,
        )
        initial_pocket_count = BusinessPocket.objects.count()
        initial_reputation_event_count = ReputationEvent.objects.count()

        with patch.object(
            VisibilityEventService,
            "get_recent_visibility_metrics",
            return_value={},
        ) as metrics_mock:
            DiscoveryScoreService.recompute_business_score(
                business_id=self.business.BUSN_ID,
                reference_time=self.REFERENCE_TIME,
            )

        explorer.refresh_from_db()
        self.assertEqual(
            BusinessPocket.objects.count(),
            initial_pocket_count,
        )
        self.assertEqual(
            ReputationEvent.objects.count(),
            initial_reputation_event_count,
        )
        self.assertEqual(
            explorer.USER_REPUTATION,
            Decimal("0.30000"),
        )
        metrics_mock.assert_called_once()
