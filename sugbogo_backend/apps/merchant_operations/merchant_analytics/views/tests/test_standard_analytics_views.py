from unittest.mock import patch

from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.business.services.visibility_event_service import VisibilityEventService, VisibilityTrackingUnavailable
from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin

from ...services.tests.fixtures import MerchantAnalyticsFixtures


class StandardAnalyticsViewTests(MerchantAnalyticsFixtures, APIResponseAssertionsMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.url = reverse("merchant-analytics-standard")
        self.client.force_authenticate(user=self.merchant_a)
        clock = patch("apps.shared.analytics.date_ranges.timezone.now", return_value=self.NOW)
        clock.start()
        self.addCleanup(clock.stop)

    def test_each_merchant_only_receives_their_owned_business_metrics(self):
        self.event("PROFILE_VISIT", 1, self.period.start)
        self.event("SAVE", 2, self.period.start, self.business_b)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["business"]["id"], self.business_a.pk)
        self.assertEqual(response.data["data"]["saves_in_period"], 0)
        self.client.force_authenticate(user=self.merchant_b)
        response = self.client.get(self.url)
        self.assertEqual(response.data["data"]["business"]["id"], self.business_b.pk)
        self.assertEqual(response.data["data"]["profile_visits"], 0)
        self.assertEqual(response.data["data"]["saves_in_period"], 1)

    def test_client_cannot_select_another_business_or_claim_plus_access(self):
        for key, value in (("business_id", self.business_b.pk), ("BUSN_ID", self.business_b.pk),
                           ("user_id", self.merchant_b.pk), ("plus", "true"), ("metric", "impressions")):
            self.assertValidationError(self.client.get(self.url, {key: value}), key)

    def test_nonmerchant_roles_inactive_merchants_and_anonymous_are_rejected(self):
        for role, status in (
            (User.UserRole.EXPLORER, User.UserStatus.ACTIVE),
            (User.UserRole.ADMIN, User.UserStatus.ACTIVE),
            (User.UserRole.SUPER_ADMIN, User.UserStatus.ACTIVE),
            (User.UserRole.MERCHANT, User.UserStatus.SUSPENDED),
            (User.UserRole.MERCHANT, User.UserStatus.DISABLED),
        ):
            self.client.force_authenticate(user=User(USER_ID=900, USER_ROLE=role, USER_STATUS=status))
            self.assertEqual(self.client.get(self.url).status_code, 403)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(self.url).status_code, 401)

    def test_no_business_is_not_found_not_a_fabricated_empty_report(self):
        self.client.force_authenticate(user=self.user("missing-business", User.UserRole.MERCHANT))
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data["code"], "NOT_FOUND")

    def test_standard_remains_accessible_with_enforcement_both_on_and_off(self):
        for enabled in (False, True):
            with override_settings(MERCHANT_PLUS_ENFORCED=enabled):
                response = self.client.get(self.url)
                self.assertEqual(response.status_code, 200)
                self.assertTrue(response.data["success"])

    def test_no_comparison_premium_or_personal_fields_exist_even_when_gate_is_off(self):
        forbidden = {
            "previous_value", "previous_start", "previous_end_exclusive", "change", "comparison",
            "impressions", "series", "distinct_savers", "positive_share", "sentiment", "peer_comparison",
            "median_first_reply_time", "discovery_score", "explorer_id", "USER_ID", "location", "has_plus_access",
        }

        def inspect(value):
            if isinstance(value, dict):
                self.assertFalse(set(value) & forbidden)
                for nested in value.values():
                    inspect(nested)
            elif isinstance(value, list):
                for nested in value:
                    inspect(nested)

        with override_settings(MERCHANT_PLUS_ENFORCED=False):
            response = self.client.get(self.url)
        inspect(response.data["data"])

    def test_custom_manila_period_validates_and_returns_no_prior_boundaries(self):
        response = self.client.get(self.url, {"period": "custom", "start_date": "2026-10-01", "end_date": "2026-10-02"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["meta"]["period"]["start"], "2026-09-30T16:00:00+00:00")
        self.assertEqual(response.data["data"]["reviews"]["reply_cutoff"], self.NOW.isoformat())
        self.assertValidationError(self.client.get(self.url, {"period": "14"}), "period")

    def test_tracking_failure_is_successful_partial_domain_report_not_zero(self):
        with patch.object(VisibilityEventService, "get_analytics_totals", side_effect=VisibilityTrackingUnavailable()), patch.object(
            VisibilityEventService, "count_analytics_explorers", side_effect=VisibilityTrackingUnavailable(),
        ):
            response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        report = response.data["data"]
        self.assertIsNone(report["profile_visits"])
        self.assertEqual(report["reviews"]["current_published_total"], 0)
        self.assertEqual(report["sources"]["visibility"]["availability"], "unavailable")
