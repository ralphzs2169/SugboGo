from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.test import TestCase
from rest_framework.exceptions import ValidationError

from apps.admin_operations.system_configuration.models import (
    DiscoveryAlgorithmConfiguration,
)
from apps.admin_operations.system_configuration.serializers import (
    DiscoveryAlgorithmConfigurationSerializer,
)
from apps.admin_operations.system_configuration.services.discovery_algorithm_configuration_service import (
    DiscoveryAlgorithmConfigurationService,
)


class DiscoveryAlgorithmConfigurationTests(TestCase):
    def setUp(self):
        DiscoveryAlgorithmConfiguration.objects.all().delete()

        self.configuration = (
            DiscoveryAlgorithmConfigurationService
            .get_current_configuration()
        )

    def test_configuration_uses_defined_defaults(self):
        self.assertEqual(
            self.configuration.DAC_SPECIALTY_SCORE_WEIGHT,
            Decimal("0.80"),
        )
        self.assertEqual(
            self.configuration.DAC_VISIBILITY_GAP_WEIGHT,
            Decimal("0.20"),
        )
        self.assertEqual(
            self.configuration.DAC_DECAY_RATE,
            Decimal("0.10"),
        )
        self.assertEqual(
            self.configuration.DAC_VOUCH_ONLY_CONFIDENCE,
            Decimal("0.70"),
        )
        self.assertEqual(
            self.configuration.DAC_VOUCH_REVIEW_CONFIDENCE,
            Decimal("0.85"),
        )
        self.assertEqual(
            self.configuration.DAC_VOUCH_REVIEW_PHOTO_CONFIDENCE,
            Decimal("1.00"),
        )
        self.assertEqual(
            self.configuration.DAC_MIN_CATEGORY_COMPARISON_SIZE,
            5,
        )
        self.assertEqual(
            self.configuration.DAC_MIN_CLUSTER_COMPARISON_SIZE,
            5,
        )
        self.assertEqual(
            self.configuration.DAC_VISIBILITY_WINDOW_DAYS,
            30,
        )
        self.assertEqual(
            self.configuration.DAC_IMPRESSION_WEIGHT,
            Decimal("0.60"),
        )
        self.assertEqual(
            self.configuration.DAC_PROFILE_VISIT_WEIGHT,
            Decimal("0.20"),
        )
        self.assertEqual(
            self.configuration.DAC_SAVE_WEIGHT,
            Decimal("0.20"),
        )

    def test_vouch_only_reputation_cap_defaults_to_point_four(self):
        self.assertEqual(
            self.configuration.DAC_VOUCH_ONLY_REPUTATION_CAP,
            Decimal("0.40"),
        )

    def test_undecided_reputation_values_remain_unset(self):
        unresolved_values = (
            self.configuration.DAC_REPUTATION_BASELINE,
            self.configuration.DAC_VOUCH_REPUTATION_REWARD,
            self.configuration.DAC_REVIEW_REPUTATION_REWARD,
            self.configuration.DAC_REVIEW_PHOTO_REPUTATION_REWARD,
            self.configuration.DAC_APPROVED_REPORT_REPUTATION_REWARD,
            (
                self.configuration
                .DAC_CONFIRMED_VIOLATION_REPUTATION_PENALTY
            ),
        )

        self.assertEqual(
            unresolved_values,
            (
                None,
                None,
                None,
                None,
                None,
                None,
            ),
        )

    def test_discovery_weights_must_sum_to_one(self):
        self.configuration.DAC_SPECIALTY_SCORE_WEIGHT = Decimal("0.70")
        self.configuration.DAC_VISIBILITY_GAP_WEIGHT = Decimal("0.20")

        with self.assertRaisesMessage(
            DjangoValidationError,
            "Specialty Score and Visibility Gap weights must sum to 1.",
        ):
            self.configuration.full_clean()

    def test_visibility_weights_must_sum_to_one(self):
        self.configuration.DAC_IMPRESSION_WEIGHT = Decimal("0.50")
        self.configuration.DAC_PROFILE_VISIT_WEIGHT = Decimal("0.20")
        self.configuration.DAC_SAVE_WEIGHT = Decimal("0.20")

        with self.assertRaisesMessage(
            DjangoValidationError,
            "Impression, profile visit, and save weights must sum to 1.",
        ):
            self.configuration.full_clean()

    def test_bounded_values_reject_values_outside_zero_and_one(self):
        bounded_fields = (
            "DAC_SPECIALTY_SCORE_WEIGHT",
            "DAC_VISIBILITY_GAP_WEIGHT",
            "DAC_VOUCH_ONLY_CONFIDENCE",
            "DAC_VOUCH_REVIEW_CONFIDENCE",
            "DAC_VOUCH_REVIEW_PHOTO_CONFIDENCE",
            "DAC_REPUTATION_BASELINE",
            "DAC_VOUCH_REPUTATION_REWARD",
            "DAC_REVIEW_REPUTATION_REWARD",
            "DAC_REVIEW_PHOTO_REPUTATION_REWARD",
            "DAC_APPROVED_REPORT_REPUTATION_REWARD",
            "DAC_CONFIRMED_VIOLATION_REPUTATION_PENALTY",
            "DAC_VOUCH_ONLY_REPUTATION_CAP",
            "DAC_IMPRESSION_WEIGHT",
            "DAC_PROFILE_VISIT_WEIGHT",
            "DAC_SAVE_WEIGHT",
        )

        for field_name in bounded_fields:
            for invalid_value in (
                Decimal("-0.01"),
                Decimal("1.01"),
            ):
                with self.subTest(
                    field_name=field_name,
                    invalid_value=invalid_value,
                ):
                    self.configuration.refresh_from_db()

                    setattr(
                        self.configuration,
                        field_name,
                        invalid_value,
                    )

                    with self.assertRaises(DjangoValidationError):
                        self.configuration.full_clean()

    def test_decay_rate_must_be_positive(self):
        for invalid_value in (
            Decimal("0.00"),
            Decimal("-0.01"),
        ):
            with self.subTest(invalid_value=invalid_value):
                self.configuration.DAC_DECAY_RATE = invalid_value

                with self.assertRaises(DjangoValidationError):
                    self.configuration.full_clean()

    def test_comparison_minimums_must_be_positive(self):
        minimum_fields = (
            "DAC_MIN_CATEGORY_COMPARISON_SIZE",
            "DAC_MIN_CLUSTER_COMPARISON_SIZE",
        )

        for field_name in minimum_fields:
            with self.subTest(field_name=field_name):
                self.configuration.refresh_from_db()

                setattr(
                    self.configuration,
                    field_name,
                    0,
                )

                with self.assertRaises(DjangoValidationError):
                    self.configuration.full_clean()

    def test_visibility_window_must_be_positive(self):
        self.configuration.DAC_VISIBILITY_WINDOW_DAYS = 0

        with self.assertRaises(DjangoValidationError):
            self.configuration.full_clean()

    def test_serializer_uses_decimal_safe_cross_field_validation(self):
        serializer = DiscoveryAlgorithmConfigurationSerializer(
            self.configuration,
            data={
                "specialty_score_weight": "0.70",
                "visibility_gap_weight": "0.20",
            },
            partial=True,
        )

        self.assertFalse(
            serializer.is_valid(),
        )
        self.assertIn(
            "visibility_gap_weight",
            serializer.errors,
        )

    def test_configuration_service_returns_single_authoritative_row(self):
        first = (
            DiscoveryAlgorithmConfigurationService
            .get_current_configuration()
        )
        second = (
            DiscoveryAlgorithmConfigurationService
            .get_current_configuration()
        )

        self.assertEqual(
            first.DAC_ID,
            second.DAC_ID,
        )
        self.assertEqual(
            first.DAC_ID,
            DiscoveryAlgorithmConfigurationService.SINGLETON_ID,
        )
        self.assertEqual(
            DiscoveryAlgorithmConfiguration.objects.count(),
            1,
        )

    def test_service_reports_incomplete_reputation_configuration(self):
        status = (
            DiscoveryAlgorithmConfigurationService
            .get_reputation_configuration_status(
                self.configuration,
            )
        )

        self.assertFalse(
            status["is_complete"],
        )
        self.assertEqual(
            set(status["missing_fields"]),
            {
                "baseline_reputation",
                "vouch_reputation_reward",
                "review_reputation_reward",
                "review_with_photo_reputation_reward",
                "approved_report_reputation_reward",
                "confirmed_violation_reputation_penalty",
            },
        )

        with self.assertRaisesMessage(
            ValidationError,
            "Reputation configuration is incomplete.",
        ):
            (
                DiscoveryAlgorithmConfigurationService
                .require_complete_reputation_configuration()
            )
