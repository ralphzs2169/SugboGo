from decimal import Decimal
from unittest.mock import patch

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework.exceptions import NotFound

from apps.admin_operations.system_configuration.services import (
    DiscoveryAlgorithmConfigurationService,
)
from apps.users.models import ReputationEvent, User
from apps.users.services.reputation_service import ReputationService


class UserReputationTests(TestCase):
    def _create_user(
        self,
        email="explorer@example.com",
    ):
        return User.objects.create_user(
            email=email,
            password="StrongPassword123!",
            USER_FNAME="Explorer",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

    def test_new_users_begin_at_configured_baseline(self):
        user = self._create_user()

        self.assertEqual(
            user.USER_REPUTATION,
            Decimal("0.20"),
        )

    def test_user_manager_reads_current_configured_baseline(self):
        configuration = (
            DiscoveryAlgorithmConfigurationService
            .get_current_configuration()
        )
        configuration.DAC_REPUTATION_BASELINE = Decimal("0.30")
        configuration.save(
            update_fields=[
                "DAC_REPUTATION_BASELINE",
                "DAC_UPDATED_AT",
            ],
        )

        user = self._create_user()

        self.assertEqual(
            user.USER_REPUTATION,
            Decimal("0.30"),
        )

    def test_reputation_can_represent_zero_and_one(self):
        user = self._create_user()

        for valid_reputation in (
            Decimal("0.00"),
            Decimal("1.00"),
        ):
            with self.subTest(reputation=valid_reputation):
                user.USER_REPUTATION = valid_reputation
                user.full_clean()

    def test_reputation_rejects_values_outside_zero_and_one(self):
        user = self._create_user()

        for invalid_reputation in (
            Decimal("-0.01"),
            Decimal("1.01"),
        ):
            with self.subTest(reputation=invalid_reputation):
                user.USER_REPUTATION = invalid_reputation

                with self.assertRaises(DjangoValidationError):
                    user.full_clean()


class ReputationServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="explorer@example.com",
            password="StrongPassword123!",
            USER_FNAME="Explorer",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

    def _set_reputation(
        self,
        value: str,
    ):
        self.user.USER_REPUTATION = Decimal(value)
        self.user.save(
            update_fields=[
                "USER_REPUTATION",
                "USER_UPDATED_AT",
            ],
        )

    def _apply_vouch_reward(
        self,
        user_id: int,
        source_id: int,
    ):
        return ReputationService.apply_vouch_reward(
            user_id=user_id,
            source_id=source_id,
            business_id=1,
            specialty_tag_id=source_id,
        )

    def _apply_review_reward(
        self,
        user_id: int,
        source_id: int,
    ):
        return ReputationService.apply_review_reward(
            user_id=user_id,
            source_id=source_id,
            business_id=source_id,
        )

    def _apply_review_with_photo_reward(
        self,
        user_id: int,
        source_id: int,
    ):
        return ReputationService.apply_review_with_photo_reward(
            user_id=user_id,
            source_id=source_id,
            business_id=source_id,
        )

    def test_vouch_reward_applies_configured_change(self):
        event = self._apply_vouch_reward(
            user_id=self.user.USER_ID,
            source_id=1,
        )

        self.user.refresh_from_db()

        self.assertEqual(
            self.user.USER_REPUTATION,
            Decimal("0.21"),
        )
        self.assertEqual(
            event.REVT_APPLIED_CHANGE,
            Decimal("0.01"),
        )

    def test_vouch_reward_cannot_exceed_vouch_only_cap(self):
        self._set_reputation("0.39500")

        event = self._apply_vouch_reward(
            user_id=self.user.USER_ID,
            source_id=1,
        )

        self.user.refresh_from_db()

        self.assertEqual(
            self.user.USER_REPUTATION,
            Decimal("0.40"),
        )
        self.assertEqual(
            event.REVT_APPLIED_CHANGE,
            Decimal("0.00500"),
        )

    def test_vouch_reward_does_not_lower_user_above_cap(self):
        self._set_reputation("0.70")

        event = self._apply_vouch_reward(
            user_id=self.user.USER_ID,
            source_id=1,
        )

        self.user.refresh_from_db()

        self.assertEqual(
            self.user.USER_REPUTATION,
            Decimal("0.70"),
        )
        self.assertEqual(
            event.REVT_APPLIED_CHANGE,
            Decimal("0.00"),
        )

    def test_user_below_vouch_cap_can_rebuild_to_cap(self):
        self._set_reputation("0.35")

        for source_id in range(1, 7):
            self._apply_vouch_reward(
                user_id=self.user.USER_ID,
                source_id=source_id,
            )

        self.user.refresh_from_db()

        self.assertEqual(
            self.user.USER_REPUTATION,
            Decimal("0.40"),
        )

    def test_review_reward_applies_review_tier_only(self):
        event = self._apply_review_reward(
            user_id=self.user.USER_ID,
            source_id=1,
        )

        self.user.refresh_from_db()

        self.assertEqual(
            self.user.USER_REPUTATION,
            Decimal("0.23"),
        )
        self.assertEqual(
            event.REVT_APPLIED_CHANGE,
            Decimal("0.03"),
        )

    def test_review_with_photo_reward_applies_alternative_photo_tier(self):
        event = self._apply_review_with_photo_reward(
            user_id=self.user.USER_ID,
            source_id=1,
        )

        self.user.refresh_from_db()

        self.assertEqual(
            self.user.USER_REPUTATION,
            Decimal("0.25"),
        )
        self.assertEqual(
            event.REVT_APPLIED_CHANGE,
            Decimal("0.05"),
        )

    def test_review_photo_tier_applies_only_missing_difference(self):
        self._apply_review_reward(
            user_id=self.user.USER_ID,
            source_id=1,
        )

        event = self._apply_review_with_photo_reward(
            user_id=self.user.USER_ID,
            source_id=1,
        )

        self.user.refresh_from_db()

        self.assertEqual(
            self.user.USER_REPUTATION,
            Decimal("0.25"),
        )
        self.assertEqual(
            ReputationEvent.objects.count(),
            2,
        )
        self.assertEqual(
            event.REVT_APPLIED_CHANGE,
            Decimal("0.02"),
        )

    def test_approved_report_reward_applies_configured_change(self):
        event = ReputationService.apply_approved_report_reward(
            user_id=self.user.USER_ID,
            source_id=1,
        )

        self.user.refresh_from_db()

        self.assertEqual(
            self.user.USER_REPUTATION,
            Decimal("0.22"),
        )
        self.assertEqual(
            event.REVT_APPLIED_CHANGE,
            Decimal("0.02"),
        )

    def test_confirmed_violation_applies_configured_penalty(self):
        event = ReputationService.apply_confirmed_violation_penalty(
            user_id=self.user.USER_ID,
            review_id=1,
        )

        self.user.refresh_from_db()

        self.assertEqual(
            self.user.USER_REPUTATION,
            Decimal("0.10"),
        )
        self.assertEqual(
            event.REVT_APPLIED_CHANGE,
            Decimal("-0.10"),
        )

    def test_positive_reward_clamps_at_one_and_records_actual_change(self):
        self._set_reputation("0.98")

        event = self._apply_review_reward(
            user_id=self.user.USER_ID,
            source_id=1,
        )

        self.user.refresh_from_db()

        self.assertEqual(
            self.user.USER_REPUTATION,
            Decimal("1.00"),
        )
        self.assertEqual(
            event.REVT_APPLIED_CHANGE,
            Decimal("0.02"),
        )
        self.assertEqual(
            event.REVT_RESULTING_REPUTATION,
            Decimal("1.00"),
        )

    def test_penalty_clamps_at_zero_and_records_actual_change(self):
        self._set_reputation("0.04")

        event = ReputationService.apply_confirmed_violation_penalty(
            user_id=self.user.USER_ID,
            review_id=1,
        )

        self.user.refresh_from_db()

        self.assertEqual(
            self.user.USER_REPUTATION,
            Decimal("0.00"),
        )
        self.assertEqual(
            event.REVT_APPLIED_CHANGE,
            Decimal("-0.04"),
        )
        self.assertEqual(
            event.REVT_RESULTING_REPUTATION,
            Decimal("0.00"),
        )

    def test_duplicate_logical_event_does_not_change_reputation_twice(self):
        first_event = self._apply_review_reward(
            user_id=self.user.USER_ID,
            source_id=1,
        )
        duplicate_event = self._apply_review_reward(
            user_id=self.user.USER_ID,
            source_id=1,
        )

        self.user.refresh_from_db()

        self.assertEqual(
            duplicate_event.REVT_ID,
            first_event.REVT_ID,
        )
        self.assertEqual(
            self.user.USER_REPUTATION,
            Decimal("0.23"),
        )
        self.assertEqual(
            ReputationEvent.objects.count(),
            1,
        )

    def test_duplicate_confirmed_violation_does_not_apply_twice(self):
        first_event = (
            ReputationService
            .apply_confirmed_violation_penalty(
                user_id=self.user.USER_ID,
                review_id=42,
            )
        )
        duplicate_event = (
            ReputationService
            .apply_confirmed_violation_penalty(
                user_id=self.user.USER_ID,
                review_id=42,
            )
        )

        self.user.refresh_from_db()

        self.assertEqual(
            duplicate_event.REVT_ID,
            first_event.REVT_ID,
        )
        self.assertEqual(
            self.user.USER_REPUTATION,
            Decimal("0.10"),
        )
        self.assertEqual(
            ReputationEvent.objects.count(),
            1,
        )

    def test_separate_sources_each_affect_reputation(self):
        self._apply_review_reward(
            user_id=self.user.USER_ID,
            source_id=1,
        )
        self._apply_review_reward(
            user_id=self.user.USER_ID,
            source_id=2,
        )

        self.user.refresh_from_db()

        self.assertEqual(
            self.user.USER_REPUTATION,
            Decimal("0.26"),
        )
        self.assertEqual(
            ReputationEvent.objects.count(),
            2,
        )

    def test_database_rejects_duplicate_source_identity(self):
        event = self._apply_vouch_reward(
            user_id=self.user.USER_ID,
            source_id=1,
        )

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                ReputationEvent.objects.create(
                    USER_ID=self.user,
                    REVT_EVENT_TYPE=event.REVT_EVENT_TYPE,
                    REVT_APPLIED_CHANGE=event.REVT_APPLIED_CHANGE,
                    REVT_RESULTING_REPUTATION=(
                        event.REVT_RESULTING_REPUTATION
                    ),
                    REVT_SOURCE_TYPE=event.REVT_SOURCE_TYPE,
                    REVT_SOURCE_ID=event.REVT_SOURCE_ID,
                    REVT_SOURCE_KEY=event.REVT_SOURCE_KEY,
                )

    def test_event_and_user_update_are_atomic(self):
        with patch.object(
            User,
            "save",
            side_effect=RuntimeError("User update failed."),
        ):
            with self.assertRaises(RuntimeError):
                self._apply_review_reward(
                    user_id=self.user.USER_ID,
                    source_id=1,
                )

        self.user.refresh_from_db()

        self.assertEqual(
            self.user.USER_REPUTATION,
            Decimal("0.20"),
        )
        self.assertFalse(
            ReputationEvent.objects.exists(),
        )

    def test_missing_user_uses_service_not_found_exception(self):
        with self.assertRaises(NotFound):
            self._apply_vouch_reward(
                user_id=999999,
                source_id=1,
            )
