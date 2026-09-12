from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase

from apps.admin_operations.system_configuration.models import (
    RecommendationAlgorithmConfiguration,
)
from apps.admin_operations.system_configuration.services import (
    RecommendationAlgorithmConfigurationService,
)


class RecommendationConfigurationTests(TestCase):
    def setUp(self):
        self.configuration = (
            RecommendationAlgorithmConfigurationService
            .get_current_configuration()
        )

    def test_defaults_and_singleton_service(self):
        second = (
            RecommendationAlgorithmConfigurationService
            .get_current_configuration()
        )

        self.assertEqual(self.configuration.RAC_ID, 1)
        self.assertEqual(second.RAC_ID, 1)
        self.assertEqual(
            self.configuration.RAC_CLUSTER_WEIGHT,
            Decimal("1.00000"),
        )
        self.assertEqual(
            self.configuration.RAC_CATEGORY_WEIGHT,
            Decimal("2.00000"),
        )
        self.assertEqual(
            self.configuration.RAC_SPECIALTY_TAG_WEIGHT,
            Decimal("3.00000"),
        )
        self.assertEqual(
            self.configuration.RAC_HIGH_MATCH_THRESHOLD,
            Decimal("0.70000"),
        )
        self.assertEqual(
            self.configuration.RAC_MODERATE_MATCH_THRESHOLD,
            Decimal("0.40000"),
        )

    def test_non_singleton_primary_key_is_rejected(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            RecommendationAlgorithmConfiguration.objects.create(RAC_ID=2)

    def test_feature_weights_must_be_positive(self):
        for field_name in (
            "RAC_CLUSTER_WEIGHT",
            "RAC_CATEGORY_WEIGHT",
            "RAC_SPECIALTY_TAG_WEIGHT",
        ):
            with self.subTest(field_name=field_name):
                setattr(self.configuration, field_name, Decimal("0.00000"))

                with self.assertRaises(ValidationError):
                    self.configuration.full_clean()

                self.configuration.refresh_from_db()

    def test_learned_strengths_allow_zero_but_reject_negative(self):
        for field_name in (
            "RAC_PROFILE_VISIT_STRENGTH",
            "RAC_POCKET_STRENGTH",
            "RAC_SPECIALTY_VOUCH_STRENGTH",
        ):
            with self.subTest(field_name=field_name):
                setattr(self.configuration, field_name, Decimal("0.00000"))
                self.configuration.full_clean()
                setattr(self.configuration, field_name, Decimal("-0.00001"))

                with self.assertRaises(ValidationError):
                    self.configuration.full_clean()

                self.configuration.refresh_from_db()

    def test_threshold_validation(self):
        invalid_pairs = (
            (Decimal("1.00001"), Decimal("0.40000")),
            (Decimal("0.70000"), Decimal("0.00000")),
            (Decimal("0.40000"), Decimal("0.40000")),
            (Decimal("0.30000"), Decimal("0.40000")),
        )

        for high, moderate in invalid_pairs:
            with self.subTest(high=high, moderate=moderate):
                self.configuration.RAC_HIGH_MATCH_THRESHOLD = high
                self.configuration.RAC_MODERATE_MATCH_THRESHOLD = moderate

                with self.assertRaises(ValidationError):
                    self.configuration.full_clean()
