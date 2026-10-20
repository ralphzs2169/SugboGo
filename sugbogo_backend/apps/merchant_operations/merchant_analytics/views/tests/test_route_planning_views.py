from datetime import timedelta
from unittest.mock import patch

from django.urls import reverse
from pymongo.errors import AutoReconnect
from rest_framework.test import APITestCase

from apps.business.services.route_planning_event_service import RoutePlanningEventService
from apps.business.services.tests.route_planning_fixtures import RoutePlanningCollection
from apps.users.models import User
from ...services.tests.fixtures import MerchantAnalyticsFixtures


class RoutePlanningApiTests(
    MerchantAnalyticsFixtures,
    APITestCase,
):
    def setUp(self):
        super().setUp()
        self.collection = RoutePlanningCollection()
        for attribute, value in (
            ("_get_collection", None),
            ("_indexes_initialized", False),
        ):
            if attribute == "_get_collection":
                target = patch.object(
                    RoutePlanningEventService,
                    attribute,
                    return_value=self.collection,
                )
            else:
                target = patch.object(RoutePlanningEventService, attribute, value)
            target.start()
            self.addCleanup(target.stop)
        clock = patch("django.utils.timezone.now", return_value=self.NOW)
        clock.start()
        self.addCleanup(clock.stop)
        self.url = reverse("merchant-analytics-route-planning")
        self.ingest_url = reverse("business-route-intent", args=[self.business_a.pk])
        self.client.force_authenticate(user=self.merchant_a)

    def add_event(
        self,
        explorer,
        method,
        timestamp,
        business=None,
    ):
        self.collection.documents.append({
            "business_id": (business or self.business_a).pk,
            "explorer_id": explorer.pk,
            "navigation_method": method,
            "occurred_at": timestamp,
            "utc_day": timestamp.date().isoformat(),
        })

    def test_totals_distinct_accounts_method_sum_and_owned_scope(self):
        self.collection.initialize(self.period.start - timedelta(days=1))
        self.add_event(self.supporter_a, "ROAD_ROUTE", self.period.start)
        self.add_event(self.supporter_a, "JEEPNEY", self.period.start)
        self.add_event(self.supporter_b, "JEEPNEY", self.NOW - timedelta(hours=1))
        self.add_event(self.merchant_a, "ROAD_ROUTE", self.period.start)
        self.add_event(self.supporter_b, "ROAD_ROUTE", self.period.start, self.business_b)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        report = response.data["data"]
        self.assertEqual(report["total_requests"], 3)
        self.assertEqual(report["distinct_explorer_accounts"], 2)
        self.assertEqual(report["road_route_requests"], 1)
        self.assertEqual(report["jeepney_requests"], 2)
        self.assertFalse(report["meta"]["coverage_verified"])
        self.assertNotIn("previous_start", report["meta"]["period"])
        self.assertEqual(self.collection.write_calls, [])
        self.assertEqual(self.collection.index_calls, [])
        self.client.force_authenticate(user=self.merchant_b)
        self.assertEqual(self.client.get(self.url).data["data"]["total_requests"], 1)

    def test_manila_half_open_boundaries_and_selected_periods(self):
        self.collection.initialize(self.period.start - timedelta(days=100))
        self.add_event(self.supporter_a, "ROAD_ROUTE", self.period.start)
        self.add_event(self.supporter_b, "JEEPNEY", self.period.start - timedelta(microseconds=1))
        self.add_event(self.supporter_a, "ROAD_ROUTE", self.NOW - timedelta(days=1))
        self.add_event(self.supporter_a, "JEEPNEY", self.NOW)
        for period, count in (("7", 1), ("30", 2), ("90", 3)):
            response = self.client.get(self.url, {"period": period})
            self.assertEqual(response.data["data"]["total_requests"], count)
            self.assertEqual(response.data["data"]["meta"]["period"]["timezone"], "Asia/Manila")
        match = self.collection.calls[-1][0]["$match"]
        self.assertEqual(match["occurred_at"]["$lt"], self.NOW)

    def test_missing_collection_and_missing_initialization_are_not_zeros(self):
        for exists, reason in (
            (False, "route_intent_collection_missing"),
            (True, "route_tracking_not_initialized"),
        ):
            self.collection.exists = exists
            report = self.client.get(self.url).data["data"]
            self.assertIsNone(report["total_requests"])
            self.assertEqual(report["meta"]["availability"], "unavailable")
            self.assertIn(reason, report["meta"]["partial_reasons"])
        self.assertFalse(self.collection.write_calls)

    def test_healthy_zero_is_recorded_zero_but_never_verified_coverage(self):
        self.collection.initialize(self.period.start)
        report = self.client.get(self.url).data["data"]
        self.assertEqual(report["total_requests"], 0)
        self.assertEqual(report["distinct_explorer_accounts"], 0)
        self.assertEqual(report["road_route_requests"] + report["jeepney_requests"], 0)
        self.assertEqual(report["meta"]["availability"], "partial")
        self.assertFalse(report["meta"]["coverage_verified"])

    def test_history_is_clipped_to_real_initialization_and_prior_period_is_unavailable(self):
        started = self.NOW - timedelta(days=2)
        self.collection.initialize(started.replace(tzinfo=None))
        self.add_event(self.supporter_a, "ROAD_ROUTE", started - timedelta(days=10))
        self.add_event(self.supporter_b, "JEEPNEY", started + timedelta(hours=1))
        report = self.client.get(self.url).data["data"]
        self.assertEqual(report["total_requests"], 1)
        self.assertIn("tracking_started_during_period", report["meta"]["partial_reasons"])
        state = self.collection.documents[0]
        state["started_at"] = self.NOW + timedelta(days=1)
        report = self.client.get(self.url).data["data"]
        self.assertIsNone(report["total_requests"])
        self.assertIn("tracking_not_started_in_period", report["meta"]["partial_reasons"])

    def test_database_failures_are_unavailable_not_empty_success(self):
        self.collection.error = AutoReconnect("Unavailable")
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["data"]["road_route_requests"])
        self.assertIn("route_source_unavailable", response.data["data"]["meta"]["partial_reasons"])

    def test_post_uses_authenticated_identity_and_rejects_client_time_and_identity(self):
        self.client.force_authenticate(user=self.supporter_a)
        response = self.client.post(self.ingest_url, {"navigation_method": "ROAD_ROUTE"})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["data"]["recorded"])
        response = self.client.post(self.ingest_url, {"navigation_method": "ROAD_ROUTE"})
        self.assertTrue(response.data["data"]["duplicate"])
        for extra in ("user_id", "explorer_id", "occurred_at", "business_id", "utc_day"):
            response = self.client.post(
                self.ingest_url,
                {"navigation_method": "JEEPNEY", extra: "untrusted"},
            )
            self.assertEqual(response.status_code, 400)
        self.client.force_authenticate(user=self.merchant_a)
        response = self.client.post(self.ingest_url, {"navigation_method": "JEEPNEY"})
        self.assertEqual(response.data["data"]["excluded_reason"], "business_owner")

    def test_permissions_query_validation_and_http_methods(self):
        for query in (
            {"business_id": self.business_b.pk},
            {"period": "custom"},
            {"period": "5"},
            {"start_date": "2026-10-01"},
            {"as_of": self.NOW.isoformat()},
        ):
            self.assertEqual(self.client.get(self.url, query).status_code, 400)
        for user in (self.supporter_a, self.user("no-business", User.UserRole.MERCHANT)):
            self.client.force_authenticate(user=user)
            expected = 403 if user == self.supporter_a else 404
            self.assertEqual(self.client.get(self.url).status_code, expected)
        self.client.force_authenticate(user=User(
            USER_ID=999,
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.SUSPENDED,
        ))
        self.assertEqual(self.client.post(self.ingest_url, {"navigation_method": "JEEPNEY"}).status_code, 403)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(self.url).status_code, 401)
        self.assertEqual(self.client.post(self.ingest_url, {"navigation_method": "JEEPNEY"}).status_code, 401)
        self.client.force_authenticate(user=self.merchant_a)
        self.assertEqual(self.client.post(self.url).status_code, 405)
        self.assertEqual(self.client.get(self.ingest_url).status_code, 405)
