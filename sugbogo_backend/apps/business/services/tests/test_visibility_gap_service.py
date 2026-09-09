from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.gis.geos import Point
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
from apps.business.services.visibility_event_service import (
    VisibilityEventService,
)
from apps.business.services.visibility_gap_service import (
    VisibilityComparisonLevel,
    VisibilityGapService,
)
from apps.users.models import ReputationEvent, User


class VisibilityGapServiceTests(TestCase):
    REFERENCE_TIME = datetime(
        2026,
        9,
        15,
        12,
        0,
        tzinfo=UTC,
    )

    @classmethod
    def setUpTestData(cls):
        """Creates the shared target business and taxonomy."""

        cls.explorer = User.objects.create_user(
            email="vg-explorer@example.com",
            password=None,
            USER_FNAME="Visibility",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        cls.target_owner = User.objects.create_user(
            email="vg-target-owner@example.com",
            password=None,
            USER_FNAME="Target",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        cls.target_cluster = Cluster.objects.create(
            CLUS_NAME="VG Target Cluster",
            CLUS_DESCRIPTION="Visibility Gap target cluster.",
        )
        cls.target_category = Category.objects.create(
            CTGRY_NAME="VG Target Category",
            CTGRY_DESCRIPTION="Visibility Gap target category.",
            CLUS_ID=cls.target_cluster,
        )
        cls.target_location = Location.objects.create(
            LOCT_POINT=Point(
                123.8854,
                10.3157,
                srid=4326,
            ),
            LOCT_ADDRESS="VG Target Street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        cls.target_business = Business.objects.create(
            BUSN_NAME="VG Target Business",
            BUSN_DESCRIPTION="Visibility Gap target business.",
            BUSN_CONTACT_NUMBER="09171234567",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=cls.target_owner,
            CTGRY_ID=cls.target_category,
            LOCT_ID=cls.target_location,
        )
        cls.specialty = SpecialtyTag.objects.create(
            TAG_NAME="VG Regression Specialty",
            TAG_COLOR="blue",
        )
        cls.business_specialty = BusinessSpecialtyTag.objects.create(
            BUSN_ID=cls.target_business,
            TAG_ID=cls.specialty,
            BST_TAG_SCORE=Decimal("0.45678"),
        )

    def setUp(self):
        """Restores default visibility configuration before each test."""

        self.business_counter = 0
        self.category_counter = 0
        self.cluster_counter = 0

        configuration = (
            DiscoveryAlgorithmConfigurationService
            .get_current_configuration()
        )
        configuration.DAC_MIN_CATEGORY_COMPARISON_SIZE = 5
        configuration.DAC_MIN_CLUSTER_COMPARISON_SIZE = 5
        configuration.DAC_VISIBILITY_WINDOW_DAYS = 30
        configuration.DAC_IMPRESSION_WEIGHT = Decimal("0.60")
        configuration.DAC_PROFILE_VISIT_WEIGHT = Decimal("0.20")
        configuration.DAC_SAVE_WEIGHT = Decimal("0.20")
        configuration.save(
            update_fields=[
                "DAC_MIN_CATEGORY_COMPARISON_SIZE",
                "DAC_MIN_CLUSTER_COMPARISON_SIZE",
                "DAC_VISIBILITY_WINDOW_DAYS",
                "DAC_IMPRESSION_WEIGHT",
                "DAC_PROFILE_VISIT_WEIGHT",
                "DAC_SAVE_WEIGHT",
                "DAC_UPDATED_AT",
            ],
        )

        Business.objects.filter(
            BUSN_ID=self.target_business.BUSN_ID,
        ).update(
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            BUSN_POCKET_COUNT=0,
        )
        BusinessSpecialtyTag.objects.filter(
            BST_ID=self.business_specialty.BST_ID,
        ).update(
            BST_TAG_SCORE=Decimal("0.45678"),
        )

    def _update_configuration(
        self,
        **values,
    ):
        """Updates selected Discovery Algorithm configuration values."""

        configuration = (
            DiscoveryAlgorithmConfigurationService
            .get_current_configuration()
        )

        for field_name, value in values.items():
            setattr(
                configuration,
                field_name,
                value,
            )

        configuration.save(
            update_fields=[
                *values,
                "DAC_UPDATED_AT",
            ],
        )

        return configuration

    def _create_cluster(self) -> Cluster:
        """Creates another cluster for comparison tests."""

        self.cluster_counter += 1

        return Cluster.objects.create(
            CLUS_NAME=(
                f"VG Test Cluster {self.cluster_counter}"
            ),
            CLUS_DESCRIPTION="Visibility Gap test cluster.",
        )

    def _create_category(
        self,
        cluster=None,
    ) -> Category:
        """Creates another category in the requested cluster."""

        if cluster is None:
            cluster = self.target_cluster

        self.category_counter += 1

        return Category.objects.create(
            CTGRY_NAME=(
                f"VG Test Category {self.category_counter}"
            ),
            CTGRY_DESCRIPTION="Visibility Gap test category.",
            CLUS_ID=cluster,
        )

    def _create_business(
        self,
        category=None,
        status=Business.BusinessStatus.ACTIVE,
    ) -> Business:
        """Creates another business for group-selection tests."""

        if category is None:
            category = self.target_category

        self.business_counter += 1
        owner = User.objects.create(
            USER_EMAIL=(
                f"vg-owner-{self.business_counter}@example.com"
            ),
            password="!",
            USER_FNAME="VG",
            USER_LNAME=f"Owner {self.business_counter}",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
            USER_REPUTATION=Decimal("0.20"),
        )
        location = Location.objects.create(
            LOCT_POINT=Point(
                123.8854 + (self.business_counter / 1000),
                10.3157 + (self.business_counter / 1000),
                srid=4326,
            ),
            LOCT_ADDRESS=(
                f"VG Test Street {self.business_counter}"
            ),
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )

        return Business.objects.create(
            BUSN_NAME=(
                f"VG Test Business {self.business_counter}"
            ),
            BUSN_DESCRIPTION="Visibility Gap comparison business.",
            BUSN_CONTACT_NUMBER=(
                f"0917{self.business_counter:07d}"
            ),
            BUSN_STATUS=status,
            USER_ID=owner,
            CTGRY_ID=category,
            LOCT_ID=location,
        )

    @staticmethod
    def _zero_metrics(
        business_ids,
        start_time,
        end_time,
    ):
        """Returns zero visibility metrics for requested businesses."""

        del start_time
        del end_time

        return {
            business_id: {
                "impression_count": 0,
                "profile_visit_count": 0,
                "save_event_count": 0,
                "unique_saver_count": 0,
            }
            for business_id in business_ids
        }

    def _calculate_target(
        self,
        metrics=None,
    ):
        """Calculates VG for the shared target with mocked metrics."""

        if metrics is None:
            metrics_side_effect = self._zero_metrics
            metrics_return_value = None
        else:
            metrics_side_effect = None
            metrics_return_value = metrics

        with patch.object(
            VisibilityEventService,
            "get_recent_visibility_metrics",
            side_effect=metrics_side_effect,
            return_value=metrics_return_value,
        ) as get_metrics:
            result = VisibilityGapService.calculate_business_visibility_gap(
                business_id=self.target_business.BUSN_ID,
                reference_time=self.REFERENCE_TIME,
            )

        return result, get_metrics

    def test_category_meeting_minimum_uses_category(self):
        for _ in range(4):
            self._create_business()

        result, get_metrics = self._calculate_target()

        self.assertEqual(
            result.comparison_group_level,
            VisibilityComparisonLevel.CATEGORY,
        )
        self.assertEqual(
            result.comparison_group_size,
            5,
        )
        self.assertEqual(
            get_metrics.call_count,
            1,
        )

    def test_small_category_falls_back_to_cluster(self):
        other_category = self._create_category()

        for _ in range(4):
            self._create_business(
                category=other_category,
            )

        result, _ = self._calculate_target()

        self.assertEqual(
            result.comparison_group_level,
            VisibilityComparisonLevel.CLUSTER,
        )
        self.assertEqual(
            result.comparison_group_size,
            5,
        )

    def test_small_category_and_cluster_fall_back_to_platform(self):
        other_cluster = self._create_cluster()
        other_category = self._create_category(
            cluster=other_cluster,
        )
        self._create_business(
            category=other_category,
        )

        result, _ = self._calculate_target()

        self.assertEqual(
            result.comparison_group_level,
            VisibilityComparisonLevel.PLATFORM,
        )
        self.assertEqual(
            result.comparison_group_size,
            2,
        )

    def test_category_exactly_at_configured_minimum_qualifies(self):
        self._update_configuration(
            DAC_MIN_CATEGORY_COMPARISON_SIZE=3,
        )
        self._create_business()
        self._create_business()

        result, _ = self._calculate_target()

        self.assertEqual(
            result.comparison_group_level,
            VisibilityComparisonLevel.CATEGORY,
        )
        self.assertEqual(
            result.comparison_group_size,
            3,
        )

    def test_cluster_exactly_at_configured_minimum_qualifies(self):
        self._update_configuration(
            DAC_MIN_CLUSTER_COMPARISON_SIZE=3,
        )
        other_category = self._create_category()
        self._create_business(
            category=other_category,
        )
        self._create_business(
            category=other_category,
        )

        result, _ = self._calculate_target()

        self.assertEqual(
            result.comparison_group_level,
            VisibilityComparisonLevel.CLUSTER,
        )
        self.assertEqual(
            result.comparison_group_size,
            3,
        )

    def test_inactive_businesses_do_not_count_toward_group_size(self):
        self._update_configuration(
            DAC_MIN_CATEGORY_COMPARISON_SIZE=2,
            DAC_MIN_CLUSTER_COMPARISON_SIZE=2,
        )
        self._create_business(
            status=Business.BusinessStatus.SUSPENDED,
        )

        result, _ = self._calculate_target()

        self.assertEqual(
            result.comparison_group_level,
            VisibilityComparisonLevel.PLATFORM,
        )
        self.assertEqual(
            result.comparison_group_size,
            1,
        )

    def test_target_business_participates_in_its_group(self):
        self._update_configuration(
            DAC_MIN_CATEGORY_COMPARISON_SIZE=1,
        )

        result, get_metrics = self._calculate_target()
        requested_business_ids = get_metrics.call_args.kwargs[
            "business_ids"
        ]

        self.assertEqual(
            result.comparison_group_size,
            1,
        )
        self.assertIn(
            self.target_business.BUSN_ID,
            requested_business_ids,
        )

    def test_changed_group_minimum_is_used_without_code_changes(self):
        self._create_business()
        self._update_configuration(
            DAC_MIN_CATEGORY_COMPARISON_SIZE=2,
        )

        result, _ = self._calculate_target()

        self.assertEqual(
            result.comparison_group_level,
            VisibilityComparisonLevel.CATEGORY,
        )

    def test_inactive_target_business_is_rejected(self):
        Business.objects.filter(
            BUSN_ID=self.target_business.BUSN_ID,
        ).update(
            BUSN_STATUS=Business.BusinessStatus.SUSPENDED,
        )

        with patch.object(
            VisibilityEventService,
            "get_recent_visibility_metrics",
        ):
            with self.assertRaisesMessage(
                NotFound,
                "One or more active businesses could not be found.",
            ):
                VisibilityGapService.calculate_business_visibility_gap(
                    business_id=self.target_business.BUSN_ID,
                    reference_time=self.REFERENCE_TIME,
                )

    def test_missing_target_metrics_default_to_zero(self):
        self._update_configuration(
            DAC_MIN_CATEGORY_COMPARISON_SIZE=2,
        )
        competitor = self._create_business()
        metrics = {
            competitor.BUSN_ID: {
                "impression_count": 10,
                "profile_visit_count": 5,
                "save_event_count": 2,
                "unique_saver_count": 2,
            },
        }

        result, _ = self._calculate_target(
            metrics=metrics,
        )

        self.assertEqual(
            result.impression_count,
            0,
        )
        self.assertEqual(
            result.profile_visit_count,
            0,
        )
        self.assertEqual(
            result.unique_saver_count,
            0,
        )
        self.assertEqual(
            result.traction,
            Decimal("0.00000"),
        )
        self.assertEqual(
            result.visibility_gap,
            Decimal("1.00000"),
        )

    def test_raw_visibility_metrics_are_consumed_correctly(self):
        self._update_configuration(
            DAC_MIN_CATEGORY_COMPARISON_SIZE=1,
        )
        metrics = {
            self.target_business.BUSN_ID: {
                "impression_count": 12,
                "profile_visit_count": 7,
                "save_event_count": 5,
                "unique_saver_count": 3,
            },
        }

        result, _ = self._calculate_target(
            metrics=metrics,
        )

        self.assertEqual(
            result.impression_count,
            12,
        )
        self.assertEqual(
            result.profile_visit_count,
            7,
        )
        self.assertEqual(
            result.unique_saver_count,
            3,
        )

    def test_unique_saver_count_is_used_instead_of_save_event_count(self):
        self._update_configuration(
            DAC_MIN_CATEGORY_COMPARISON_SIZE=1,
        )
        metrics = {
            self.target_business.BUSN_ID: {
                "impression_count": 0,
                "profile_visit_count": 0,
                "save_event_count": 99,
                "unique_saver_count": 2,
            },
        }

        result, _ = self._calculate_target(
            metrics=metrics,
        )

        self.assertEqual(
            result.unique_saver_count,
            2,
        )
        self.assertEqual(
            result.normalized_saves,
            Decimal("1.00000"),
        )
        self.assertEqual(
            result.traction,
            Decimal("0.20000"),
        )

    def test_current_pocket_count_is_not_used_as_save_signal(self):
        self._update_configuration(
            DAC_MIN_CATEGORY_COMPARISON_SIZE=1,
        )
        Business.objects.filter(
            BUSN_ID=self.target_business.BUSN_ID,
        ).update(
            BUSN_POCKET_COUNT=999,
        )

        result, _ = self._calculate_target()

        self.assertEqual(
            result.unique_saver_count,
            0,
        )
        self.assertEqual(
            result.normalized_saves,
            Decimal("0.00000"),
        )

    def test_target_equal_to_maximum_normalizes_to_one(self):
        normalized = VisibilityGapService.normalize_signal(
            business_value=10,
            maximum_value=10,
        )

        self.assertEqual(
            normalized,
            Decimal("1"),
        )

    def test_target_half_of_maximum_normalizes_to_half(self):
        normalized = VisibilityGapService.normalize_signal(
            business_value=5,
            maximum_value=10,
        )

        self.assertEqual(
            normalized,
            Decimal("0.5"),
        )

    def test_zero_target_with_nonzero_maximum_normalizes_to_zero(self):
        normalized = VisibilityGapService.normalize_signal(
            business_value=0,
            maximum_value=10,
        )

        self.assertEqual(
            normalized,
            Decimal("0"),
        )

    def test_zero_comparison_maximum_normalizes_to_zero(self):
        normalized = VisibilityGapService.normalize_signal(
            business_value=0,
            maximum_value=0,
        )

        self.assertEqual(
            normalized,
            Decimal("0"),
        )

    def test_normalized_values_are_clamped(self):
        high = VisibilityGapService.normalize_signal(
            business_value=20,
            maximum_value=10,
        )
        low = VisibilityGapService.normalize_signal(
            business_value=-5,
            maximum_value=10,
        )

        self.assertEqual(
            high,
            Decimal("1"),
        )
        self.assertEqual(
            low,
            Decimal("0"),
        )

    def test_each_signal_uses_its_own_maximum(self):
        self._update_configuration(
            DAC_MIN_CATEGORY_COMPARISON_SIZE=2,
        )
        competitor = self._create_business()
        metrics = {
            self.target_business.BUSN_ID: {
                "impression_count": 50,
                "profile_visit_count": 20,
                "save_event_count": 50,
                "unique_saver_count": 2,
            },
            competitor.BUSN_ID: {
                "impression_count": 100,
                "profile_visit_count": 80,
                "save_event_count": 1,
                "unique_saver_count": 8,
            },
        }

        result, _ = self._calculate_target(
            metrics=metrics,
        )

        self.assertEqual(
            result.normalized_impressions,
            Decimal("0.50000"),
        )
        self.assertEqual(
            result.normalized_profile_visits,
            Decimal("0.25000"),
        )
        self.assertEqual(
            result.normalized_saves,
            Decimal("0.25000"),
        )

    def test_default_weights_calculate_expected_traction(self):
        traction = VisibilityGapService.calculate_traction(
            normalized_impressions=Decimal("0.40"),
            normalized_profile_visits=Decimal("0.60"),
            normalized_saves=Decimal("0.10"),
            impression_weight=Decimal("0.60"),
            profile_visit_weight=Decimal("0.20"),
            save_weight=Decimal("0.20"),
        )

        self.assertEqual(
            traction,
            Decimal("0.3800"),
        )

    def test_changed_configured_weights_change_traction(self):
        self._update_configuration(
            DAC_MIN_CATEGORY_COMPARISON_SIZE=2,
            DAC_IMPRESSION_WEIGHT=Decimal("0.20"),
            DAC_PROFILE_VISIT_WEIGHT=Decimal("0.30"),
            DAC_SAVE_WEIGHT=Decimal("0.50"),
        )
        competitor = self._create_business()
        metrics = {
            self.target_business.BUSN_ID: {
                "impression_count": 5,
                "profile_visit_count": 10,
                "save_event_count": 0,
                "unique_saver_count": 0,
            },
            competitor.BUSN_ID: {
                "impression_count": 10,
                "profile_visit_count": 10,
                "save_event_count": 10,
                "unique_saver_count": 10,
            },
        }

        result, _ = self._calculate_target(
            metrics=metrics,
        )

        self.assertEqual(
            result.traction,
            Decimal("0.40000"),
        )

    def test_zero_traction_produces_full_visibility_gap(self):
        visibility_gap = VisibilityGapService.calculate_visibility_gap(
            traction=Decimal("0"),
        )

        self.assertEqual(
            visibility_gap,
            Decimal("1"),
        )

    def test_full_traction_produces_zero_visibility_gap(self):
        visibility_gap = VisibilityGapService.calculate_visibility_gap(
            traction=Decimal("1"),
        )

        self.assertEqual(
            visibility_gap,
            Decimal("0"),
        )

    def test_intermediate_traction_produces_inverse_gap(self):
        visibility_gap = VisibilityGapService.calculate_visibility_gap(
            traction=Decimal("0.38"),
        )

        self.assertEqual(
            visibility_gap,
            Decimal("0.62"),
        )

    def test_visibility_gap_is_clamped_to_bounds(self):
        low = VisibilityGapService.calculate_visibility_gap(
            traction=Decimal("2"),
        )
        high = VisibilityGapService.calculate_visibility_gap(
            traction=Decimal("-1"),
        )

        self.assertEqual(
            low,
            Decimal("0"),
        )
        self.assertEqual(
            high,
            Decimal("1"),
        )

    def test_configured_rolling_window_is_used(self):
        self._update_configuration(
            DAC_MIN_CATEGORY_COMPARISON_SIZE=1,
            DAC_VISIBILITY_WINDOW_DAYS=14,
        )

        result, get_metrics = self._calculate_target()

        self.assertEqual(
            result.window_start,
            self.REFERENCE_TIME - timedelta(days=14),
        )
        self.assertEqual(
            get_metrics.call_args.kwargs["start_time"],
            self.REFERENCE_TIME - timedelta(days=14),
        )

    def test_one_reference_time_is_shared_across_batch(self):
        self._update_configuration(
            DAC_MIN_CATEGORY_COMPARISON_SIZE=2,
        )
        second_business = self._create_business()

        with patch.object(
            VisibilityEventService,
            "get_recent_visibility_metrics",
            side_effect=self._zero_metrics,
        ) as get_metrics:
            results = VisibilityGapService.calculate_visibility_gaps(
                business_ids=[
                    self.target_business.BUSN_ID,
                    second_business.BUSN_ID,
                ],
                reference_time=self.REFERENCE_TIME,
            )

        self.assertEqual(
            get_metrics.call_count,
            1,
        )

        for result in results:
            self.assertEqual(
                result.window_end,
                self.REFERENCE_TIME,
            )
            self.assertEqual(
                result.window_start,
                self.REFERENCE_TIME - timedelta(days=30),
            )

    def test_explicit_reference_time_is_deterministic(self):
        self._update_configuration(
            DAC_MIN_CATEGORY_COMPARISON_SIZE=1,
        )

        first, _ = self._calculate_target()
        second, _ = self._calculate_target()

        self.assertEqual(
            first,
            second,
        )

    def test_worked_visibility_gap_example(self):
        self._update_configuration(
            DAC_MIN_CATEGORY_COMPARISON_SIZE=2,
        )
        competitor = self._create_business()
        metrics = {
            self.target_business.BUSN_ID: {
                "impression_count": 400,
                "profile_visit_count": 60,
                "save_event_count": 20,
                "unique_saver_count": 5,
            },
            competitor.BUSN_ID: {
                "impression_count": 1000,
                "profile_visit_count": 100,
                "save_event_count": 80,
                "unique_saver_count": 50,
            },
        }

        result, _ = self._calculate_target(
            metrics=metrics,
        )

        self.assertEqual(
            result.normalized_impressions,
            Decimal("0.40000"),
        )
        self.assertEqual(
            result.normalized_profile_visits,
            Decimal("0.60000"),
        )
        self.assertEqual(
            result.normalized_saves,
            Decimal("0.10000"),
        )
        self.assertEqual(
            result.traction,
            Decimal("0.38000"),
        )
        self.assertEqual(
            result.visibility_gap,
            Decimal("0.62000"),
        )

    def test_calculation_is_read_only_across_existing_domains(self):
        self._update_configuration(
            DAC_MIN_CATEGORY_COMPARISON_SIZE=1,
        )
        BusinessPocket.objects.create(
            USER_ID=self.explorer,
            BUSN_ID=self.target_business,
        )
        Business.objects.filter(
            BUSN_ID=self.target_business.BUSN_ID,
        ).update(
            BUSN_POCKET_COUNT=1,
        )
        vouch = BusinessVouch.objects.create(
            USER_ID=self.explorer,
            BUSN_ID=self.target_business,
            TAG_ID=self.specialty,
            VOUCH_REPUTATION_SNAPSHOT=Decimal("0.20"),
        )
        pocket_count = BusinessPocket.objects.count()
        reputation = self.explorer.USER_REPUTATION
        reputation_event_count = ReputationEvent.objects.count()

        with patch.object(
            VisibilityEventService,
            "get_recent_visibility_metrics",
            side_effect=self._zero_metrics,
        ) as get_metrics:
            with patch.object(
                VisibilityEventService,
                "record_impressions",
            ) as record_impressions:
                with patch.object(
                    VisibilityEventService,
                    "record_profile_visit",
                ) as record_profile_visit:
                    with patch.object(
                        VisibilityEventService,
                        "record_save",
                    ) as record_save:
                        result = (
                            VisibilityGapService
                            .calculate_business_visibility_gap(
                                business_id=(
                                    self.target_business.BUSN_ID
                                ),
                                reference_time=self.REFERENCE_TIME,
                            )
                        )

        self.target_business.refresh_from_db()
        self.business_specialty.refresh_from_db()
        self.explorer.refresh_from_db()
        vouch.refresh_from_db()

        self.assertEqual(
            get_metrics.call_count,
            1,
        )
        record_impressions.assert_not_called()
        record_profile_visit.assert_not_called()
        record_save.assert_not_called()
        self.assertEqual(
            BusinessPocket.objects.count(),
            pocket_count,
        )
        self.assertEqual(
            self.target_business.BUSN_POCKET_COUNT,
            1,
        )
        self.assertEqual(
            self.explorer.USER_REPUTATION,
            reputation,
        )
        self.assertEqual(
            ReputationEvent.objects.count(),
            reputation_event_count,
        )
        self.assertEqual(
            vouch.VOUCH_REPUTATION_SNAPSHOT,
            Decimal("0.20"),
        )
        self.assertTrue(
            vouch.VOUCH_EVIDENCE_IS_VALID,
        )
        self.assertEqual(
            self.business_specialty.BST_TAG_SCORE,
            Decimal("0.45678"),
        )
        self.assertEqual(
            result.visibility_gap,
            Decimal("1.00000"),
        )
        self.assertFalse(
            DiscoveryScore.objects.filter(
                BUSN_ID=self.target_business,
            ).exists(),
        )

    def test_calculating_all_businesses_reuses_identical_group_metrics(self):
        self._update_configuration(
            DAC_MIN_CATEGORY_COMPARISON_SIZE=2,
        )
        self._create_business()

        with patch.object(
            VisibilityEventService,
            "get_recent_visibility_metrics",
            side_effect=self._zero_metrics,
        ) as get_metrics:
            results = VisibilityGapService.calculate_visibility_gaps(
                reference_time=self.REFERENCE_TIME,
            )

        self.assertEqual(
            len(results),
            2,
        )
        self.assertEqual(
            get_metrics.call_count,
            1,
        )
