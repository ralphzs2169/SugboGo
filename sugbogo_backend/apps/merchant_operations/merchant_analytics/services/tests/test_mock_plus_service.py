from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.exceptions import ValidationError

from apps.business.models import Business

from ...entitlements import merchant_has_plus_access
from ...models import DemoMerchantPlusEntitlement
from ..mock_plus_service import MockPlusDisabled, MockPlusService
from .fixtures import MerchantAnalyticsFixtures


@override_settings(MERCHANT_PLUS_ENFORCED=True, MERCHANT_PLUS_MOCK_ENABLED=True)
class MockPlusServiceTests(MerchantAnalyticsFixtures, TestCase):
    def test_status_is_read_only_and_missing_grant_means_standard_under_enforcement(self):
        status = MockPlusService.get_status(self.merchant_a)
        self.assertEqual(status["stored_demo_state"], "not_created")
        self.assertEqual(status["effective_tier"], "standard")
        self.assertEqual(status["access_source"], "none")
        self.assertTrue(status["is_simulation"])
        self.assertFalse(DemoMerchantPlusEntitlement.objects.exists())

    def test_success_is_idempotent_and_preserves_original_activation_and_update_times(self):
        with patch("apps.merchant_operations.merchant_analytics.services.mock_plus_service.timezone.now", return_value=self.NOW):
            first = MockPlusService.activate(self.merchant_a, "success")
        with patch("apps.merchant_operations.merchant_analytics.services.mock_plus_service.timezone.now", return_value=self.NOW + timedelta(days=1)):
            second = MockPlusService.activate(self.merchant_a, "success")
        self.assertTrue(first["changed"])
        self.assertFalse(second["changed"])
        self.assertEqual(first["status"], second["status"])
        self.assertEqual(DemoMerchantPlusEntitlement.objects.count(), 1)
        self.assertTrue(merchant_has_plus_access(self.merchant_a))

    def test_failure_and_cancellation_never_create_or_revoke_grants(self):
        for outcome in ("failure", "cancelled"):
            result = MockPlusService.activate(self.merchant_a, outcome)
            self.assertFalse(result["changed"])
            self.assertFalse(DemoMerchantPlusEntitlement.objects.exists())
        activated = MockPlusService.activate(self.merchant_a, "success")["status"]
        for outcome in ("failure", "cancelled"):
            result = MockPlusService.activate(self.merchant_a, outcome)
            self.assertFalse(result["changed"])
            self.assertEqual(result["status"], activated)

    def test_reset_is_idempotent_and_absent_reset_does_not_create_a_row(self):
        self.assertFalse(MockPlusService.reset(self.merchant_a)["changed"])
        self.assertFalse(DemoMerchantPlusEntitlement.objects.exists())
        MockPlusService.activate(self.merchant_a, "success")
        first = MockPlusService.reset(self.merchant_a)
        second = MockPlusService.reset(self.merchant_a)
        self.assertTrue(first["changed"])
        self.assertFalse(second["changed"])
        self.assertEqual(first["status"], second["status"])
        self.assertEqual(first["status"]["stored_demo_state"], "inactive")
        self.assertIsNotNone(first["status"]["reset_at"])
        self.assertFalse(merchant_has_plus_access(self.merchant_a))

    def test_reactivation_reuses_row_with_new_activation_and_retains_last_reset_time(self):
        with patch("apps.merchant_operations.merchant_analytics.services.mock_plus_service.timezone.now", return_value=self.NOW):
            MockPlusService.activate(self.merchant_a, "success")
            reset = MockPlusService.reset(self.merchant_a)
        with patch("apps.merchant_operations.merchant_analytics.services.mock_plus_service.timezone.now", return_value=self.NOW + timedelta(days=1)):
            result = MockPlusService.activate(self.merchant_a, "success")
        self.assertEqual(DemoMerchantPlusEntitlement.objects.count(), 1)
        self.assertEqual(result["status"]["activated_at"], self.NOW + timedelta(days=1))
        self.assertEqual(result["status"]["reset_at"], reset["status"]["reset_at"])

    def test_flags_distinguish_stored_grant_and_effective_access(self):
        MockPlusService.activate(self.merchant_a, "success")
        for enforced, mock_enabled, access, source in (
            (False, False, True, "preview"), (False, True, True, "preview"),
            (True, False, False, "none"), (True, True, True, "mock"),
        ):
            with self.subTest(enforced=enforced, mock_enabled=mock_enabled), override_settings(
                MERCHANT_PLUS_ENFORCED=enforced, MERCHANT_PLUS_MOCK_ENABLED=mock_enabled,
            ):
                status = MockPlusService.get_status(self.merchant_a)
                self.assertEqual(status["stored_demo_state"], "active")
                self.assertEqual(status["has_plus_access"], access)
                self.assertEqual(status["access_source"], source)
                self.assertEqual(merchant_has_plus_access(self.merchant_a), access)

    def test_preview_remains_plus_after_reset_and_does_not_require_a_grant(self):
        with override_settings(MERCHANT_PLUS_ENFORCED=False):
            status = MockPlusService.reset(self.merchant_a)["status"]
            self.assertEqual(status["stored_demo_state"], "not_created")
            self.assertTrue(status["has_plus_access"])
            self.assertEqual(status["access_source"], "preview")

    def test_disabled_mock_mode_ignores_stored_grants_without_entitlement_query(self):
        MockPlusService.activate(self.merchant_a, "success")
        with override_settings(MERCHANT_PLUS_MOCK_ENABLED=False), self.assertNumQueries(0):
            self.assertFalse(merchant_has_plus_access(self.merchant_a))

    def test_disabled_mutations_fail_before_business_lookup(self):
        with override_settings(MERCHANT_PLUS_MOCK_ENABLED=False), patch.object(
            MockPlusService, "locked_business", side_effect=AssertionError("Disabled mutation queried ownership"),
        ):
            for action in (lambda: MockPlusService.activate(self.merchant_a, "success"),
                           lambda: MockPlusService.reset(self.merchant_a)):
                with self.assertRaises(MockPlusDisabled):
                    action()

    def test_grant_and_reset_are_scoped_to_owned_business_and_survive_user_refetch(self):
        MockPlusService.activate(self.merchant_a, "success")
        self.assertFalse(merchant_has_plus_access(self.merchant_b))
        self.assertEqual(MockPlusService.get_status(self.merchant_b)["stored_demo_state"], "not_created")
        self.assertFalse(MockPlusService.reset(self.merchant_b)["changed"])
        owner = type(self.merchant_a).objects.get(pk=self.merchant_a.pk)
        self.assertTrue(merchant_has_plus_access(owner))

    def test_suspended_listing_stays_suspended_and_does_not_become_verified(self):
        Business.objects.filter(pk=self.business_a.pk).update(BUSN_STATUS=Business.BusinessStatus.SUSPENDED)
        result = MockPlusService.activate(self.merchant_a, "success")
        self.business_a.refresh_from_db()
        self.assertEqual(result["status"]["business"]["status"], "suspended")
        self.assertFalse(self.business_a.BUSN_IS_VERIFIED)
        self.assertEqual(self.business_a.BUSN_STATUS, "suspended")

    def test_invalid_direct_service_outcome_is_rejected_without_grant(self):
        with self.assertRaises(ValidationError):
            MockPlusService.activate(self.merchant_a, "paid")
        self.assertFalse(DemoMerchantPlusEntitlement.objects.exists())
