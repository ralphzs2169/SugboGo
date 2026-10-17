"""Premium access, owned-business scope and merchant timing response contracts."""

import json
from unittest.mock import patch

from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.business.services.visibility_event_service import VisibilityEventService, VisibilityTrackingUnavailable
from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin

from ...services.tests.fixtures import MerchantAnalyticsFixtures


class EngagementHeatmapViewTests(MerchantAnalyticsFixtures, APIResponseAssertionsMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.url = reverse("merchant-analytics-premium-engagement-heatmap")
        self.client.force_authenticate(user=self.merchant_a)
        patcher = patch("apps.shared.analytics.date_ranges.timezone.now", return_value=self.NOW)
        patcher.start()
        self.addCleanup(patcher.stop)

    @override_settings(MERCHANT_PLUS_ENFORCED=False)
    def test_preview_access_returns_owned_heatmap_with_standard_envelope(self):
        self.assertEqual(self.url, "/api/merchant/analytics/premium/engagement-heatmap/")
        self.event("PROFILE_VISIT", 1, self.period.start)
        response = self.client.get(self.url)
        self.assertSuccessResponse(response, message="Merchant Premium analytics retrieved successfully.")
        data = response.data["data"]
        self.assertEqual(data["business"]["id"], self.business_a.pk)
        self.assertEqual(data["total_profile_visits"], 1)
        self.assertEqual(len(data["cells"]), 168)
        self.assertEqual(data["timezone"], "Asia/Manila")

    @override_settings(MERCHANT_PLUS_ENFORCED=True, MERCHANT_PLUS_MOCK_ENABLED=False)
    def test_enforcement_denies_before_ownership_or_event_reads(self):
        with patch("apps.merchant_operations.business_profile.services.business_profile_service.BusinessProfileService.get_business_for_merchant") as owner, \
             patch.object(VisibilityEventService, "get_profile_visit_timing") as timing:
            response = self.client.get(self.url)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["code"], "PLUS_REQUIRED")
        owner.assert_not_called()
        timing.assert_not_called()

    @override_settings(MERCHANT_PLUS_ENFORCED=True)
    def test_approved_entitlement_scopes_to_each_callers_owned_business(self):
        self.event("PROFILE_VISIT", 1, self.period.start, self.business_b)
        with patch("apps.merchant_operations.merchant_analytics.entitlements.merchant_has_plus_access", return_value=True):
            first = self.client.get(self.url).data["data"]
            self.client.force_authenticate(user=self.merchant_b)
            second = self.client.get(self.url).data["data"]
        self.assertEqual(first["total_profile_visits"], 0)
        self.assertEqual(second["total_profile_visits"], 1)
        self.assertEqual(second["business"]["id"], self.business_b.pk)

    @override_settings(MERCHANT_PLUS_ENFORCED=False)
    def test_nonmerchants_inactive_and_anonymous_are_rejected(self):
        with patch.object(VisibilityEventService, "get_profile_visit_timing") as timing:
            for role, status in (
                (User.UserRole.ADMIN, User.UserStatus.ACTIVE),
                (User.UserRole.SUPER_ADMIN, User.UserStatus.ACTIVE),
                (User.UserRole.EXPLORER, User.UserStatus.ACTIVE),
                (User.UserRole.MERCHANT, User.UserStatus.SUSPENDED),
                (User.UserRole.MERCHANT, User.UserStatus.DISABLED),
            ):
                self.client.force_authenticate(user=User(USER_ID=999, USER_ROLE=role, USER_STATUS=status))
                self.assertEqual(self.client.get(self.url).status_code, 403)
            self.client.force_authenticate(user=None)
            self.assertEqual(self.client.get(self.url).status_code, 401)
            timing.assert_not_called()

    @override_settings(MERCHANT_PLUS_ENFORCED=False)
    def test_dates_metrics_and_ownership_overrides_are_strictly_validated(self):
        for query, field in (
            ({"period": "14"}, "period"), ({"period": "custom"}, "start_date"),
            ({"period": "custom", "start_date": "2026-10-13", "end_date": "2026-10-01"}, "period"),
            ({"period": "custom", "start_date": "2026-10-01", "end_date": "2026-10-20"}, "period"),
            ({"business_id": self.business_b.pk}, "business_id"), ({"user_id": self.merchant_b.pk}, "user_id"),
            ({"plus": "true"}, "plus"), ({"metric": "saves"}, "metric"),
            ({"timezone": "UTC"}, "timezone"), ({"interval": "hourly"}, "interval"),
        ):
            with self.subTest(query=query):
                self.assertValidationError(self.client.get(self.url, query), field)
        self.assertValidationError(self.client.get(self.url + "?period=7&period=30"), "period")

    @override_settings(MERCHANT_PLUS_ENFORCED=False)
    def test_custom_period_preserves_half_open_manila_bounds_and_outside_slots(self):
        response = self.client.get(self.url, {"period": "custom", "start_date": "2026-10-12", "end_date": "2026-10-12"})
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertEqual(data["meta"]["period"]["start"], "2026-10-11T16:00:00+00:00")
        self.assertEqual(data["meta"]["period"]["end_exclusive"], "2026-10-12T16:00:00+00:00")
        self.assertEqual(data["sample"]["in_period_cells"], 24)
        self.assertEqual(data["sample"]["outside_period_cells"], 144)

    @override_settings(MERCHANT_PLUS_ENFORCED=False)
    def test_failed_source_is_null_not_zero_and_output_does_not_leak_event_identities(self):
        with patch.object(VisibilityEventService, "get_profile_visit_timing", side_effect=VisibilityTrackingUnavailable()):
            data = self.client.get(self.url).data["data"]
        self.assertIsNone(data["total_profile_visits"])
        self.assertEqual(data["display_state"], "visibility_unavailable")
        self.assertTrue(all(cell["profile_visits"] is None for cell in data["cells"]))
        self.assertFalse(data["sample"]["conclusions_available"])
        encoded = json.dumps(data)
        for field in ("explorer_id", "occurred_at", "dedupe_key", "installation_id", "latitude", "longitude"):
            self.assertNotIn(f'"{field}"', encoded)

    @override_settings(MERCHANT_PLUS_ENFORCED=False)
    def test_missing_owned_business_is_not_found_and_writes_are_unsupported(self):
        for method in (self.client.post, self.client.put, self.client.patch, self.client.delete):
            self.assertEqual(method(self.url, {}, format="json").status_code, 405)
        self.client.force_authenticate(user=self.user("heatmap-no-business", User.UserRole.MERCHANT))
        self.assertEqual(self.client.get(self.url).status_code, 404)
