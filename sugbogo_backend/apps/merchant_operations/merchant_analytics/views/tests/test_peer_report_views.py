from unittest.mock import patch

from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin

from ...services.tests.peer_fixtures import PeerAnalyticsFixtures


class PeerReportViewTests(PeerAnalyticsFixtures, APIResponseAssertionsMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.urls = [reverse("merchant-analytics-premium-peers"), reverse("merchant-analytics-premium-report")]
        self.client.force_authenticate(user=self.merchant_a)
        clock = patch("apps.shared.analytics.date_ranges.timezone.now", return_value=self.NOW)
        clock.start()
        self.addCleanup(clock.stop)

    @override_settings(MERCHANT_PLUS_ENFORCED=False)
    def test_gate_off_returns_composed_owned_data_but_standard_still_has_no_premium_fields(self):
        for url in self.urls:
            response = self.client.get(url)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["data"]["business"]["id"], self.business_a.pk)
        response = self.client.get(reverse("merchant-analytics-standard"))
        for key in ("results", "peers", "changes", "key_findings", "recommended_actions", "peer_median"):
            self.assertNotIn(key, str(response.data["data"]))

    @override_settings(MERCHANT_PLUS_ENFORCED=True)
    def test_gate_on_denies_both_before_ownership_lookup_and_leaves_standard_accessible(self):
        with patch("apps.merchant_operations.business_profile.services.business_profile_service.BusinessProfileService.get_business_for_merchant",
                   side_effect=AssertionError("Denied request queried ownership")):
            for url in self.urls:
                response = self.client.get(url)
                self.assertEqual(response.status_code, 403)
                self.assertEqual(response.data["code"], "PLUS_REQUIRED")
        self.assertEqual(self.client.get(reverse("merchant-analytics-standard")).status_code, 200)

    @override_settings(MERCHANT_PLUS_ENFORCED=True)
    def test_future_server_entitlement_grant_allows_both_routes(self):
        with patch("apps.merchant_operations.merchant_analytics.entitlements.merchant_has_plus_access", return_value=True):
            for url in self.urls:
                self.assertEqual(self.client.get(url).status_code, 200)

    @override_settings(MERCHANT_PLUS_ENFORCED=False)
    def test_ownership_is_server_derived_and_business_or_policy_overrides_are_rejected(self):
        for url in self.urls:
            for key, value in (("business_id", self.business_b.pk), ("user_id", self.merchant_b.pk),
                               ("plus", "true"), ("minimum_group_size", "1"), ("category", self.business_a.CTGRY_ID_id)):
                self.assertValidationError(self.client.get(url, {key: value}), key)
        self.client.force_authenticate(user=self.merchant_b)
        for url in self.urls:
            self.assertEqual(self.client.get(url).data["data"]["business"]["id"], self.business_b.pk)

    def test_nonmerchant_inactive_and_anonymous_accounts_are_rejected(self):
        for role, status in (
            (User.UserRole.EXPLORER, User.UserStatus.ACTIVE), (User.UserRole.ADMIN, User.UserStatus.ACTIVE),
            (User.UserRole.SUPER_ADMIN, User.UserStatus.ACTIVE), (User.UserRole.MERCHANT, User.UserStatus.SUSPENDED),
            (User.UserRole.MERCHANT, User.UserStatus.DISABLED),
        ):
            self.client.force_authenticate(user=User(USER_ID=900, USER_ROLE=role, USER_STATUS=status))
            for url in self.urls:
                self.assertEqual(self.client.get(url).status_code, 403)
        self.client.force_authenticate(user=None)
        for url in self.urls:
            self.assertEqual(self.client.get(url).status_code, 401)

    @override_settings(MERCHANT_PLUS_ENFORCED=False)
    def test_custom_period_report_interval_and_no_owned_business(self):
        response = self.client.get(self.urls[1], {
            "period": "custom", "start_date": "2026-10-01", "end_date": "2026-10-02", "interval": "weekly",
        })
        self.assertEqual(response.status_code, 200)
        report = response.data["data"]
        self.assertEqual(report["meta"]["period"]["start"], "2026-09-30T16:00:00+00:00")
        self.assertEqual(report["results"]["premium"]["visibility"]["interval"], "weekly")
        self.assertValidationError(self.client.get(self.urls[0], {"interval": "weekly"}), "interval")
        self.client.force_authenticate(user=self.user("peer-report-no-business", User.UserRole.MERCHANT))
        for url in self.urls:
            self.assertEqual(self.client.get(url).status_code, 404)

    @override_settings(MERCHANT_PLUS_ENFORCED=False)
    def test_serialized_payload_never_contains_peer_or_explorer_identity_fields(self):
        peers = self.five_peers()
        self.sentiment(self.business_a, 4, 5)
        for business in peers:
            self.sentiment(business, 3, 5)
        for url in self.urls:
            response = self.client.get(url)
            self.assertEqual(response.status_code, 200)
            text = str(response.data["data"])
            for business in peers:
                self.assertNotIn(business.BUSN_NAME, text)
            for key in ("peer_ids", "explorer_id", "USER_ID", "review_ids", "installation_id"):
                self.assertNotIn(key, text)
