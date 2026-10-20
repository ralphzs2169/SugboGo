from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from django.test import TestCase, override_settings
from pymongo.errors import AutoReconnect, DuplicateKeyError
from rest_framework.exceptions import NotFound, ValidationError

from apps.business.models import Business
from apps.business.services.route_planning_event_service import (
    RoutePlanningEventService,
    RoutePlanningUnavailable,
)
from apps.merchant_operations.merchant_analytics.services.tests.fixtures import (
    MerchantAnalyticsFixtures,
)
from .route_planning_fixtures import RoutePlanningCollection


class RoutePlanningEventsTests(
    MerchantAnalyticsFixtures,
    TestCase,
):
    def setUp(self):
        super().setUp()
        self.collection = RoutePlanningCollection()
        source = patch.object(
            RoutePlanningEventService,
            "_get_collection",
            return_value=self.collection,
        )
        source.start()
        self.addCleanup(source.stop)
        indexes = patch.object(
            RoutePlanningEventService,
            "_indexes_initialized",
            False,
        )
        indexes.start()
        self.addCleanup(indexes.stop)
        self.clock = patch(
            "apps.business.services.route_planning_event_service.timezone.now",
            return_value=self.NOW,
        )
        self.now = self.clock.start()
        self.addCleanup(self.clock.stop)

    def record(
        self,
        method="ROAD_ROUTE",
        user=None,
        business=None,
    ):
        return RoutePlanningEventService.record_intent(
            user=user or self.supporter_a,
            business_id=(business or self.business_a).pk,
            navigation_method=method,
        )

    def test_minimal_server_timestamped_events_and_unique_index(self):
        self.assertTrue(self.record()["recorded"])
        events = [
            document
            for document in self.collection.documents
            if "navigation_method" in document
        ]
        self.assertEqual(events, [{
            "business_id": self.business_a.pk,
            "explorer_id": self.supporter_a.pk,
            "navigation_method": "ROAD_ROUTE",
            "occurred_at": self.NOW,
            "utc_day": self.NOW.date().isoformat(),
        }])
        keys, options = self.collection.index_calls[0]
        self.assertTrue(options["unique"])
        self.assertEqual(
            [field for field, direction in keys],
            ["explorer_id", "business_id", "navigation_method", "utc_day"],
        )
        self.assertEqual(len(self.collection.index_calls), 2)

    def test_method_and_account_are_independent_but_repeated_requests_deduplicate(self):
        self.assertTrue(self.record()["recorded"])
        self.assertTrue(self.record()["duplicate"])
        self.assertTrue(self.record("JEEPNEY")["recorded"])
        self.assertTrue(self.record(user=self.supporter_b)["recorded"])
        self.assertTrue(self.record(business=self.business_b)["recorded"])

    def test_event_clock_is_captured_after_collection_initialization(self):
        self.now.side_effect = [self.NOW, self.NOW + timedelta(seconds=1)]
        self.record()
        self.assertEqual(self.collection.documents[0]["started_at"], self.NOW)
        self.assertEqual(
            self.collection.documents[1]["occurred_at"],
            self.NOW + timedelta(seconds=1),
        )

    @override_settings(TIME_ZONE="Asia/Manila")
    def test_deduplication_changes_at_utc_midnight_not_manila_midnight(self):
        day = datetime(2026, 10, 12, 15, 59, tzinfo=UTC)
        self.now.return_value = day
        self.assertTrue(self.record()["recorded"])
        self.now.return_value = day + timedelta(minutes=2)
        self.assertTrue(self.record()["duplicate"])
        self.now.return_value = day.replace(hour=23, minute=59)
        self.assertTrue(self.record()["duplicate"])
        self.now.return_value += timedelta(minutes=2)
        self.assertTrue(self.record()["recorded"])

    def test_owner_is_excluded_before_mongo_access_but_other_merchants_are_allowed(self):
        self.assertEqual(
            self.record(user=self.merchant_a)["excluded_reason"],
            "business_owner",
        )
        self.assertFalse(self.collection.exists)
        self.assertTrue(self.record(user=self.merchant_b)["recorded"])

    def test_invalid_method_missing_and_inactive_businesses_do_not_write(self):
        with self.assertRaises(ValidationError):
            self.record("WALKING")
        with self.assertRaises(NotFound):
            RoutePlanningEventService.record_intent(
                user=self.supporter_a,
                business_id=999999,
                navigation_method="ROAD_ROUTE",
            )
        Business.objects.filter(pk=self.business_a.pk).update(
            BUSN_STATUS=Business.BusinessStatus.SUSPENDED,
        )
        with self.assertRaises(NotFound):
            self.record()
        self.assertFalse(self.collection.exists)

    def test_simultaneous_upserts_have_one_counted_observation(self):
        with patch.object(
            RoutePlanningEventService,
            "_get_business",
            return_value=self.business_a,
        ):
            with ThreadPoolExecutor(max_workers=8) as executor:
                results = list(executor.map(lambda value: self.record(), range(16)))
        self.assertEqual(sum(result["recorded"] for result in results), 1)
        self.assertEqual(sum(result["duplicate"] for result in results), 15)

    def test_duplicate_key_race_is_successful_deduplication_not_a_source_failure(self):
        self.record()
        original = self.collection.update_one

        def race(
            query,
            update,
            upsert,
        ):
            if "navigation_method" in query:
                raise DuplicateKeyError("Simulated concurrent upsert")
            return original(query, update, upsert)

        with patch.object(self.collection, "update_one", side_effect=race):
            self.assertTrue(self.record()["duplicate"])

    def test_database_write_failure_is_controlled_and_retry_keeps_original_marker(self):
        self.record()
        state = self.collection.find_one({"_id": RoutePlanningEventService.STATE_ID})
        self.collection.error = AutoReconnect("Offline")
        with self.assertRaises(RoutePlanningUnavailable):
            self.record("JEEPNEY")
        self.collection.error = None
        self.now.return_value += timedelta(hours=1)
        self.assertTrue(self.record("JEEPNEY")["recorded"])
        self.assertEqual(
            self.collection.find_one({"_id": RoutePlanningEventService.STATE_ID}),
            state,
        )
