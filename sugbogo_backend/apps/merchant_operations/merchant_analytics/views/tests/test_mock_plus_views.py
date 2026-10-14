from unittest.mock import patch

from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin

from ...models import DemoMerchantPlusEntitlement
from ...services.mock_plus_service import MockPlusService
from ...services.tests.fixtures import MerchantAnalyticsFixtures


@override_settings(MERCHANT_PLUS_ENFORCED=True, MERCHANT_PLUS_MOCK_ENABLED=True)
class MockPlusViewTests(MerchantAnalyticsFixtures, APIResponseAssertionsMixin, APITestCase):
    PREMIUM_NAMES = ("visibility", "pocket", "specialties", "review-insights", "review-performance", "peers", "report")

    def setUp(self):
        super().setUp()
        self.status_url = reverse("merchant-plus-status")
        self.activation_url = reverse("merchant-plus-mock-activation")
        self.reset_url = reverse("merchant-plus-mock-reset")
        self.client.force_authenticate(user=self.merchant_a)
        clock = patch("apps.shared.analytics.date_ranges.timezone.now", return_value=self.NOW)
        clock.start()
        self.addCleanup(clock.stop)

    def test_full_upgrade_and_reset_flow_controls_all_seven_premium_routes(self):
        for name in self.PREMIUM_NAMES:
            response = self.client.get(reverse(f"merchant-analytics-premium-{name}"))
            self.assertEqual(response.status_code, 403)
            self.assertEqual(response.data["code"], "PLUS_REQUIRED")
        self.assertEqual(self.client.get(reverse("merchant-analytics-standard")).status_code, 200)
        activated = self.client.post(self.activation_url, {"outcome": "success"}, format="json")
        self.assertEqual(activated.status_code, 200)
        self.assertTrue(activated.data["success"])
        self.assertTrue(activated.data["data"]["changed"])
        self.assertEqual(activated.data["data"]["status"]["access_source"], "mock")
        for name in self.PREMIUM_NAMES:
            response = self.client.get(reverse(f"merchant-analytics-premium-{name}"))
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["data"]["business"]["id"], self.business_a.pk)
        self.assertEqual(self.client.post(self.reset_url, {}, format="json").status_code, 200)
        for name in self.PREMIUM_NAMES:
            self.assertEqual(self.client.get(reverse(f"merchant-analytics-premium-{name}")).status_code, 403)
        self.assertEqual(self.client.get(reverse("merchant-analytics-standard")).status_code, 200)

    def test_failed_and_cancelled_simulations_are_processed_but_do_not_grant(self):
        for outcome in ("failure", "cancelled"):
            response = self.client.post(self.activation_url, {"outcome": outcome}, format="json")
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.data["success"])
            self.assertEqual(response.data["data"]["outcome"], outcome)
            self.assertFalse(response.data["data"]["changed"])
            self.assertFalse(response.data["data"]["status"]["has_plus_access"])
        self.assertFalse(DemoMerchantPlusEntitlement.objects.exists())

    def test_cross_merchant_access_and_mutation_are_isolated(self):
        self.client.post(self.activation_url, {"outcome": "success"}, format="json")
        self.client.force_authenticate(user=self.merchant_b)
        self.assertFalse(self.client.get(self.status_url).data["data"]["has_plus_access"])
        self.assertFalse(self.client.post(self.reset_url, {}, format="json").data["data"]["changed"])
        self.assertEqual(self.client.get(reverse("merchant-analytics-premium-report")).status_code, 403)
        self.client.force_authenticate(user=self.merchant_a)
        self.assertTrue(self.client.get(self.status_url).data["data"]["has_plus_access"])

    def test_status_rejects_query_overrides_and_creates_no_row(self):
        response = self.client.get(self.status_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["stored_demo_state"], "not_created")
        self.assertTrue(response.data["data"]["is_simulation"])
        self.assertFalse(DemoMerchantPlusEntitlement.objects.exists())
        self.assertValidationError(self.client.get(self.status_url, {"business_id": self.business_b.pk}), "business_id")

    def test_ownership_plan_payment_and_flag_overrides_are_rejected(self):
        for key, value in (
            ("business_id", self.business_b.pk), ("user_id", self.merchant_b.pk), ("has_plus_access", True),
            ("plan", "plus"), ("mock_enabled", True), ("card_number", "not-a-card"), ("amount", 1),
        ):
            response = self.client.post(self.activation_url, {"outcome": "success", key: value}, format="json")
            self.assertValidationError(response, key)
            self.assertValidationError(self.client.post(self.reset_url, {key: value}, format="json"), key)
        response = self.client.post(f"{self.activation_url}?business_id={self.business_b.pk}", {"outcome": "success"}, format="json")
        self.assertValidationError(response, "business_id")
        self.assertFalse(DemoMerchantPlusEntitlement.objects.exists())

    def test_outcome_is_required_and_only_simulation_outcomes_are_accepted(self):
        self.assertValidationError(self.client.post(self.activation_url, {}, format="json"), "outcome")
        self.assertValidationError(self.client.post(self.activation_url, {"outcome": "paid"}, format="json"), "outcome")
        self.assertEqual(self.client.get(self.activation_url).status_code, 405)
        self.assertEqual(self.client.get(self.reset_url).status_code, 405)

    @override_settings(MERCHANT_PLUS_MOCK_ENABLED=False)
    def test_disabled_mutations_fail_closed_while_status_remains_readable(self):
        with patch.object(MockPlusService, "locked_business", side_effect=AssertionError("Disabled mutation queried ownership")):
            for url in (self.activation_url, self.reset_url):
                response = self.client.post(url, {"outcome": "success"}, format="json")
                self.assertEqual(response.status_code, 403)
                self.assertEqual(response.data["code"], "MOCK_PLUS_DISABLED")
        status = self.client.get(self.status_url)
        self.assertEqual(status.status_code, 200)
        self.assertFalse(status.data["data"]["has_plus_access"])

    def test_switching_mock_off_ignores_persisted_grant_and_switching_back_restores_demo(self):
        self.client.post(self.activation_url, {"outcome": "success"}, format="json")
        with override_settings(MERCHANT_PLUS_MOCK_ENABLED=False):
            status = self.client.get(self.status_url).data["data"]
            self.assertEqual(status["stored_demo_state"], "active")
            self.assertFalse(status["has_plus_access"])
            self.assertEqual(self.client.get(reverse("merchant-analytics-premium-report")).status_code, 403)
        self.assertEqual(self.client.get(reverse("merchant-analytics-premium-report")).status_code, 200)

    def test_nonmerchant_roles_inactive_merchants_and_anonymous_are_rejected(self):
        for role, status in (
            (User.UserRole.EXPLORER, User.UserStatus.ACTIVE), (User.UserRole.ADMIN, User.UserStatus.ACTIVE),
            (User.UserRole.SUPER_ADMIN, User.UserStatus.ACTIVE), (User.UserRole.MERCHANT, User.UserStatus.SUSPENDED),
            (User.UserRole.MERCHANT, User.UserStatus.DISABLED),
        ):
            self.client.force_authenticate(user=User(USER_ID=900, USER_ROLE=role, USER_STATUS=status))
            self.assertEqual(self.client.get(self.status_url).status_code, 403)
            for url in (self.activation_url, self.reset_url):
                self.assertEqual(self.client.post(url, {"outcome": "success"}, format="json").status_code, 403)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(self.status_url).status_code, 401)
        for url in (self.activation_url, self.reset_url):
            self.assertEqual(self.client.post(url, {"outcome": "success"}, format="json").status_code, 401)

    def test_missing_owned_business_returns_not_found_on_enabled_routes(self):
        self.client.force_authenticate(user=self.user("mock-plus-no-business", User.UserRole.MERCHANT))
        self.assertEqual(self.client.get(self.status_url).status_code, 404)
        for url in (self.activation_url, self.reset_url):
            self.assertEqual(self.client.post(url, {"outcome": "success"} if url == self.activation_url else {}, format="json").status_code, 404)

    @override_settings(MERCHANT_PLUS_ENFORCED=False)
    def test_preview_bypass_is_explicit_even_after_reset(self):
        self.client.post(self.activation_url, {"outcome": "success"}, format="json")
        status = self.client.post(self.reset_url, {}, format="json").data["data"]["status"]
        self.assertEqual(status["stored_demo_state"], "inactive")
        self.assertTrue(status["has_plus_access"])
        self.assertEqual(status["access_source"], "preview")
