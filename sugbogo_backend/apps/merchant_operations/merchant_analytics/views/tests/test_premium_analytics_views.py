from unittest.mock import patch

from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin

from ...services.tests.fixtures import MerchantAnalyticsFixtures


class PremiumAnalyticsViewTests(MerchantAnalyticsFixtures, APIResponseAssertionsMixin, APITestCase):
    NAMES = ("visibility", "pocket", "specialties", "review-insights", "review-performance")

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.merchant_a)
        clock = patch("apps.shared.analytics.date_ranges.timezone.now", return_value=self.NOW)
        clock.start()
        self.addCleanup(clock.stop)

    def url(self, name):
        return reverse(f"merchant-analytics-premium-{name}")

    @override_settings(MERCHANT_PLUS_ENFORCED=False)
    def test_every_premium_endpoint_is_available_when_enforcement_is_off(self):
        for name in self.NAMES:
            with self.subTest(name=name):
                response = self.client.get(self.url(name))
                self.assertEqual(response.status_code, 200)
                self.assertTrue(response.data["success"])
                self.assertEqual(response.data["data"]["business"]["id"], self.business_a.pk)

    @override_settings(MERCHANT_PLUS_ENFORCED=True)
    def test_every_premium_endpoint_fails_closed_before_service_reads(self):
        with patch(
            "apps.merchant_operations.business_profile.services.business_profile_service.BusinessProfileService.get_business_for_merchant",
            side_effect=AssertionError("Denied request reached ownership lookup"),
        ):
            for name in self.NAMES:
                response = self.client.get(self.url(name))
                self.assertEqual(response.status_code, 403)
                self.assertEqual(response.data["code"], "PLUS_REQUIRED")

    @override_settings(MERCHANT_PLUS_ENFORCED=True)
    def test_server_entitlement_approval_allows_owned_business_only(self):
        with patch("apps.merchant_operations.merchant_analytics.entitlements.merchant_has_plus_access", return_value=True):
            for name in self.NAMES:
                response = self.client.get(self.url(name))
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data["data"]["business"]["id"], self.business_a.pk)

    @override_settings(MERCHANT_PLUS_ENFORCED=False)
    def test_ownership_is_derived_for_each_route_and_client_override_is_rejected(self):
        self.event("PROFILE_VISIT", 1, self.period.start)
        self.event("SAVE", 2, self.period.start, self.business_b)
        for name in self.NAMES:
            self.assertValidationError(self.client.get(self.url(name), {"business_id": self.business_b.pk}), "business_id")
            self.assertValidationError(self.client.get(self.url(name), {"plus": "true"}), "plus")
        self.client.force_authenticate(user=self.merchant_b)
        for name in self.NAMES:
            response = self.client.get(self.url(name))
            self.assertEqual(response.data["data"]["business"]["id"], self.business_b.pk)
        self.assertEqual(self.client.get(self.url("visibility")).data["data"]["metrics"]["profile_visits"]["value"], 0)
        self.assertEqual(self.client.get(self.url("pocket")).data["data"]["metrics"]["saves"]["value"], 1)

    def test_all_routes_reject_nonmerchants_inactive_accounts_and_anonymous(self):
        for role, status in (
            (User.UserRole.EXPLORER, User.UserStatus.ACTIVE), (User.UserRole.ADMIN, User.UserStatus.ACTIVE),
            (User.UserRole.SUPER_ADMIN, User.UserStatus.ACTIVE), (User.UserRole.MERCHANT, User.UserStatus.SUSPENDED),
            (User.UserRole.MERCHANT, User.UserStatus.DISABLED),
        ):
            self.client.force_authenticate(user=User(USER_ID=900, USER_ROLE=role, USER_STATUS=status))
            for name in self.NAMES:
                self.assertEqual(self.client.get(self.url(name)).status_code, 403)
        self.client.force_authenticate(user=None)
        for name in self.NAMES:
            self.assertEqual(self.client.get(self.url(name)).status_code, 401)

    @override_settings(MERCHANT_PLUS_ENFORCED=False)
    def test_missing_owned_business_is_not_found_for_all_routes(self):
        self.client.force_authenticate(user=self.user("premium-missing-business", User.UserRole.MERCHANT))
        for name in self.NAMES:
            self.assertEqual(self.client.get(self.url(name)).status_code, 404)

    @override_settings(MERCHANT_PLUS_ENFORCED=False)
    def test_period_and_interval_validation_and_no_private_tracking_fields(self):
        for name in self.NAMES:
            self.assertValidationError(self.client.get(self.url(name), {"period": "14"}), "period")
        self.assertValidationError(self.client.get(self.url("visibility"), {"interval": "monthly"}), "interval")
        response = self.client.get(self.url("visibility"), {"interval": "weekly", "period": "7"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["interval"], "weekly")
        for name in self.NAMES:
            text = str(self.client.get(self.url(name)).data)
            for field in ("explorer_id", "installation_id", "supporting_review_references", "KEYWORDS_FINGERPRINT"):
                self.assertNotIn(field, text)
