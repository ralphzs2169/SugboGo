from unittest.mock import patch

from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.business.services.discovery_source import DiscoverySource
from apps.business.services.tests.discovery_source_fixtures import DiscoverySourceCollection
from apps.business.services.visibility_event_service import VisibilityEventService
from apps.users.models import User
from ...services.tests.fixtures import MerchantAnalyticsFixtures


@override_settings(MERCHANT_PLUS_ENFORCED=True, MERCHANT_PLUS_MOCK_ENABLED=False)
class DiscoverySourcesApiTests(MerchantAnalyticsFixtures, APITestCase):
    def setUp(self):
        super().setUp()
        self.source = DiscoverySourceCollection()
        target = patch.object(
            VisibilityEventService,
            "_get_collection",
            return_value=self.source,
        )
        target.start()
        self.addCleanup(target.stop)
        clock = patch("django.utils.timezone.now", return_value=self.NOW)
        clock.start()
        self.addCleanup(clock.stop)
        self.url = reverse("merchant-analytics-discovery-sources")
        self.ingest = reverse("business-profile-visit", args=[self.business_a.pk])
        self.client.force_authenticate(user=self.merchant_a)

    def test_standard_access_without_plus_and_owned_business_scope(self):
        self.source.documents.append({
            "business_id": self.business_b.pk,
            "explorer_id": self.supporter_a.pk,
            "occurred_at": self.NOW,
            "event_type": "PROFILE_VISIT",
            "discovery_source": "MAP",
        })
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        report = response.data["data"]
        self.assertEqual(report["business"]["id"], self.business_a.pk)
        self.assertEqual(report["profile_visits"], 0)
        self.assertEqual({row["source"] for row in report["sources"]}, set(DiscoverySource))
        self.assertNotIn("previous_start", report["meta"]["period"])
        self.assertEqual(self.source.index_calls, [])

    def test_empty_legacy_bodies_and_malformed_values_preserve_visits_and_identity(self):
        self.client.force_authenticate(user=self.supporter_a)
        payloads = [
            {},
            {"discovery_source": None},
            {"discovery_source": []},
            {"discovery_source": {}},
            {"discovery_source": "MY_REVIEWS"},
            {"discovery_source": "VOUCH_HISTORY"},
            {"discovery_source": 1},
        ]
        for payload in payloads:
            self.source.documents.clear()
            with patch.object(VisibilityEventService, "ensure_indexes", return_value=None):
                response = self.client.post(self.ingest, payload, format="json")
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.data["data"]["recorded"])
            self.assertEqual(self.source.documents[0]["discovery_source"], "UNKNOWN")
        self.source.documents.clear()
        with patch.object(VisibilityEventService, "ensure_indexes", return_value=None):
            response = self.client.post(
                self.ingest,
                {
                    "discovery_source": "MAP",
                    "explorer_id": 999,
                    "occurred_at": "2000-01-01",
                },
                format="json",
            )
        self.assertTrue(response.data["data"]["recorded"])
        self.assertEqual(self.source.documents[0]["explorer_id"], self.supporter_a.pk)
        self.assertEqual(self.source.documents[0]["occurred_at"], self.NOW)

    def test_authentication_ownership_and_methods(self):
        self.client.force_authenticate(user=self.merchant_a)
        response = self.client.post(self.ingest, {"discovery_source": "MAP"})
        self.assertFalse(response.data["data"]["recorded"])
        self.assertEqual(self.source.documents, [])
        self.client.force_authenticate(user=self.supporter_a)
        self.assertEqual(self.client.get(self.url).status_code, 403)
        self.client.force_authenticate(user=self.user("source-no-business", User.UserRole.MERCHANT))
        self.assertEqual(self.client.get(self.url).status_code, 404)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(self.url).status_code, 401)
        self.assertEqual(self.client.post(self.ingest, {}).status_code, 401)
        self.client.force_authenticate(user=self.merchant_a)
        self.assertEqual(self.client.post(self.url).status_code, 405)

    def test_periods_and_unknown_parameters(self):
        for period in ("7", "30", "90"):
            response = self.client.get(self.url, {"period": period})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["data"]["meta"]["period"]["timezone"], "Asia/Manila")
        invalid_queries = (
            {"period": "custom"},
            {"period": "5"},
            {"business_id": 9},
            {"start_date": "2026-10-01"},
        )
        for query in invalid_queries:
            self.assertEqual(self.client.get(self.url, query).status_code, 400)
