"""Verify Premium boundaries, date-only refreshes, and side-effect-free recommendation reads."""

from unittest.mock import patch

from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin

from ...models import MerchantRecommendation
from ...services.recommendation_service import RecommendationService
from ...services.recommendation_provider_service import RecommendationProviderService
from ...services.tests.peer_fixtures import PeerAnalyticsFixtures


@override_settings(MERCHANT_PLUS_ENFORCED=False)
class RecommendationViewTests(PeerAnalyticsFixtures, APIResponseAssertionsMixin, APITestCase):
    def setUp(self):
        super().setUp()
        cache.clear()
        self.read_url = reverse("merchant-analytics-premium-recommendations")
        self.refresh_url = reverse("merchant-analytics-premium-recommendations-refresh")
        self.client.force_authenticate(user=self.merchant_a)
        clock = patch("django.utils.timezone.now", return_value=self.NOW)
        clock.start()
        self.addCleanup(clock.stop)
        queue = patch.object(RecommendationService, "_enqueue")
        self.queue = queue.start()
        self.addCleanup(queue.stop)

    def test_get_never_creates_job_or_enqueues_or_calls_provider(self):
        with patch("apps.merchant_operations.merchant_analytics.services.recommendation_provider_service.RecommendationProviderService.generate",
                   side_effect=AssertionError("Provider on GET")):
            response = self.client.get(self.read_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["state"], "not_requested")
        self.assertEqual(MerchantRecommendation.objects.count(), 0)
        self.queue.assert_not_called()

    def test_post_enqueues_once_and_get_returns_owned_original_period(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(self.refresh_url, {}, format="json")
        self.assertEqual(response.status_code, 202)
        self.queue.assert_called_once()
        self.assertEqual(response.data["data"]["state"], "pending")
        self.assertTrue(response.data["data"]["created"])
        repeated = self.client.post(self.refresh_url, {}, format="json")
        self.assertFalse(repeated.data["data"]["created"])
        self.assertEqual(repeated.data["data"]["request_id"], response.data["data"]["request_id"])
        read = self.client.get(self.read_url).data["data"]
        self.assertEqual(read["source_period"], response.data["data"]["source_period"])
        self.assertEqual(read["business"]["id"], self.business_a.pk)

    def test_client_business_prompt_provider_policy_and_entitlement_overrides_rejected(self):
        for key in ("business_id", "user_id", "prompt", "model", "minimum_reviews", "plus", "request_id"):
            self.assertValidationError(self.client.get(self.read_url, {key: "1"}), key)
            # Request validation is independent of the quota mechanism.
            with patch("apps.merchant_operations.merchant_analytics.views.recommendation_views.RecommendationRefreshThrottle.allow_request", return_value=True):
                self.assertValidationError(self.client.post(self.refresh_url, {key: "1"}, format="json"), key)

    def test_custom_selection_uses_manila_boundaries_and_rejects_future_or_reversed_dates(self):
        response = self.client.post(self.refresh_url, {
            "period": "custom", "start_date": "2026-10-01", "end_date": "2026-10-02",
        }, format="json")
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data["data"]["source_period"]["start"], "2026-09-30T16:00:00+00:00")
        for start, end in (("2026-10-02", "2026-10-01"), ("2026-10-15", "2026-10-16")):
            response = self.client.post(self.refresh_url, {
                "period": "custom", "start_date": start, "end_date": end,
            }, format="json")
            self.assertEqual(response.status_code, 400)

    def test_refresh_only_accepts_post_body_and_read_only_accepts_get(self):
        self.assertEqual(self.client.get(self.refresh_url).status_code, 405)
        self.assertEqual(self.client.post(self.read_url, {}, format="json").status_code, 405)
        self.assertEqual(self.client.post(self.refresh_url + "?period=30", {}, format="json").status_code, 400)

    @override_settings(MERCHANT_PLUS_ENFORCED=True)
    def test_enforced_premium_denies_both_and_standard_remains_accessible(self):
        self.assertEqual(self.client.get(self.read_url).data["code"], "PLUS_REQUIRED")
        self.assertEqual(self.client.post(self.refresh_url, {}, format="json").data["code"], "PLUS_REQUIRED")
        response = self.client.get(reverse("merchant-analytics-standard"))
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("ai_recommendations", str(response.data))

    def test_nonmerchant_inactive_and_anonymous_are_denied(self):
        for role, status in (
            (User.UserRole.EXPLORER, User.UserStatus.ACTIVE),
            (User.UserRole.ADMIN, User.UserStatus.ACTIVE),
            (User.UserRole.SUPER_ADMIN, User.UserStatus.ACTIVE),
            (User.UserRole.MERCHANT, User.UserStatus.SUSPENDED),
        ):
            self.client.force_authenticate(user=User(USER_ID=999, USER_ROLE=role, USER_STATUS=status))
            self.assertEqual(self.client.get(self.read_url).status_code, 403)
            self.assertEqual(self.client.post(self.refresh_url, {}, format="json").status_code, 403)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(self.read_url).status_code, 401)
        self.assertEqual(self.client.post(self.refresh_url, {}, format="json").status_code, 401)

    def test_second_owner_never_gets_first_owner_job_and_suspended_listing_stays_readable(self):
        self.client.post(self.refresh_url, {}, format="json")
        self.client.force_authenticate(user=self.merchant_b)
        data = self.client.get(self.read_url).data["data"]
        self.assertEqual(data["state"], "not_requested")
        self.assertIsNone(data["request_id"])
        self.assertEqual(data["business"]["id"], self.business_b.pk)
        from apps.business.models import Business

        Business.objects.filter(pk=self.business_b.pk).update(BUSN_STATUS=Business.BusinessStatus.SUSPENDED)
        data = self.client.get(self.read_url).data["data"]
        self.assertEqual(data["business"]["status"], Business.BusinessStatus.SUSPENDED)

    def test_refresh_throttle_limits_provider_requests_without_throttling_polling(self):
        for _ in range(3):
            self.assertEqual(self.client.post(self.refresh_url, {}, format="json").status_code, 202)
        self.assertEqual(self.client.post(self.refresh_url, {}, format="json").status_code, 429)
        self.assertEqual(self.client.get(self.read_url).status_code, 200)

    def test_no_owned_business_returns_existing_not_found_contract(self):
        self.client.force_authenticate(user=self.user("no-recommendation-business", User.UserRole.MERCHANT))
        self.assertEqual(self.client.get(self.read_url).status_code, 404)
        self.assertEqual(self.client.post(self.refresh_url, {}, format="json").status_code, 404)

    @override_settings(MERCHANT_PLUS_ENFORCED=True, MERCHANT_PLUS_MOCK_ENABLED=True)
    def test_real_demo_activation_allows_generation_and_reset_revokes_recommendation_access(self):
        self.assertEqual(self.client.get(self.read_url).status_code, 403)
        activation = self.client.post(reverse("merchant-plus-mock-activation"), {"outcome": "success"}, format="json")
        self.assertEqual(activation.status_code, 200)
        response = self.client.post(self.refresh_url, {}, format="json")
        self.assertEqual(response.status_code, 202)

        def output(snapshot):
            candidate = snapshot["candidates"][0]
            choices = {"recommendations": [{
                "action_code": candidate["action_code"], "evidence_codes": candidate["evidence_codes"],
                "explanation_code": next(iter(candidate["explanations"])),
            }]}
            return RecommendationProviderService.validate(choices, snapshot), {"total_tokens": 20}

        with patch.object(RecommendationProviderService, "generate", side_effect=output):
            self.assertEqual(RecommendationService.generate(response.data["data"]["request_id"]), "ready")
        self.assertTrue(self.client.get(self.read_url).data["data"]["content_available"])
        self.assertEqual(self.client.post(reverse("merchant-plus-mock-reset"), {}, format="json").status_code, 200)
        self.assertEqual(self.client.get(self.read_url).status_code, 403)
        self.assertEqual(self.client.post(self.refresh_url, {}, format="json").status_code, 403)
        self.assertEqual(self.client.get(reverse("merchant-analytics-standard")).status_code, 200)

    @override_settings(MERCHANT_PLUS_ENFORCED=True, MERCHANT_PLUS_MOCK_ENABLED=True)
    def test_demo_reset_before_worker_prevents_provider_request(self):
        self.client.post(reverse("merchant-plus-mock-activation"), {"outcome": "success"}, format="json")
        response = self.client.post(self.refresh_url, {}, format="json")
        self.assertEqual(response.status_code, 202)
        self.client.post(reverse("merchant-plus-mock-reset"), {}, format="json")
        with patch.object(RecommendationProviderService, "generate") as provider:
            self.assertEqual(RecommendationService.generate(response.data["data"]["request_id"]), "invalidated")
        provider.assert_not_called()
