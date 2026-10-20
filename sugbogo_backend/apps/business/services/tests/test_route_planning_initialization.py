import json
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from io import StringIO
from types import SimpleNamespace
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase
from pymongo.errors import AutoReconnect, DuplicateKeyError, OperationFailure

from apps.business.services.route_planning_event_service import (
    RoutePlanningEventService,
    RoutePlanningInitializationError,
    RoutePlanningUnavailable,
)
from apps.merchant_operations.merchant_analytics.services.route_planning_analytics_service import (
    RoutePlanningAnalyticsService,
)
from apps.shared.analytics.date_ranges import resolve_period
from .route_planning_fixtures import RoutePlanningCollection


class RoutePlanningInitializationTests(SimpleTestCase):
    NOW = datetime(2026, 10, 19, 5, tzinfo=UTC)

    def setUp(self):
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
        clock = patch(
            "apps.business.services.route_planning_event_service.timezone.now",
            return_value=self.NOW,
        )
        self.clock = clock.start()
        self.addCleanup(clock.stop)

    def test_initializes_both_indexes_and_only_the_metadata_document(self):
        result = RoutePlanningEventService.initialize_tracking()
        self.assertTrue(result["initialized"])
        self.assertEqual(result["started_at"], self.NOW)
        self.assertEqual(self.collection.documents, [{
            "_id": "tracking-state-v1",
            "started_at": self.NOW,
        }])
        unique_keys, unique_options = self.collection.index_calls[0]
        self.assertEqual(unique_keys, [
            ("explorer_id", 1),
            ("business_id", 1),
            ("navigation_method", 1),
            ("utc_day", 1),
        ])
        self.assertTrue(unique_options["unique"])
        self.assertEqual(unique_options["partialFilterExpression"], {
            "navigation_method": {"$exists": True},
        })
        self.assertEqual(self.collection.index_calls[1][0], [
            ("business_id", 1),
            ("occurred_at", 1),
        ])

    def test_repeated_explicit_setup_rechecks_indexes_without_resetting_history(self):
        RoutePlanningEventService.initialize_tracking()
        original = self.collection.documents.copy()
        self.clock.return_value += timedelta(days=1)
        result = RoutePlanningEventService.initialize_tracking()
        self.assertFalse(result["initialized"])
        self.assertEqual(result["started_at"], self.NOW)
        self.assertEqual(self.collection.documents, original)
        self.assertEqual(len(self.collection.index_calls), 4)

    def test_existing_events_are_untouched_and_do_not_determine_tracking_start(self):
        event = {
            "navigation_method": "ROAD_ROUTE",
            "occurred_at": self.NOW - timedelta(days=10),
        }
        self.collection.documents.append(event.copy())
        result = RoutePlanningEventService.initialize_tracking()
        self.assertEqual(result["started_at"], self.NOW)
        self.assertEqual(self.collection.documents[0], event)

    def test_existing_invalid_metadata_is_rejected_without_replacement(self):
        for value in (None, "invalid"):
            with self.subTest(value=value):
                state = {"_id": "tracking-state-v1", "started_at": value}
                self.collection.documents = [state.copy()]
                with self.assertRaises(RoutePlanningInitializationError):
                    RoutePlanningEventService.initialize_tracking()
                self.assertEqual(self.collection.documents, [state])

    def test_naive_mongodb_timestamp_is_returned_as_utc_without_rewriting_it(self):
        original = self.NOW.replace(tzinfo=None)
        self.collection.initialize(original)
        result = RoutePlanningEventService.initialize_tracking()
        self.assertEqual(result["started_at"], self.NOW)
        self.assertEqual(self.collection.documents[0]["started_at"], original)

    def test_simultaneous_initializers_preserve_a_single_marker(self):
        with ThreadPoolExecutor(max_workers=8) as executor:
            results = list(executor.map(
                lambda _: RoutePlanningEventService.initialize_tracking(),
                range(16),
            ))
        self.assertEqual(sum(result["initialized"] for result in results), 1)
        self.assertEqual(len(self.collection.documents), 1)

    def test_metadata_duplicate_key_race_reuses_the_winning_marker(self):
        self.collection.initialize(self.NOW - timedelta(days=1))
        with patch.object(
            self.collection,
            "update_one",
            side_effect=DuplicateKeyError("Concurrent initializer"),
        ):
            result = RoutePlanningEventService.initialize_tracking()
        self.assertFalse(result["initialized"])
        self.assertEqual(result["started_at"], self.NOW - timedelta(days=1))

    def test_index_conflict_is_controlled_and_does_not_create_metadata(self):
        with patch.object(
            self.collection,
            "create_index",
            side_effect=OperationFailure("Sensitive driver text", code=85),
        ):
            with self.assertRaises(RoutePlanningUnavailable) as error:
                RoutePlanningEventService.initialize_tracking()
        self.assertIn("code=85", str(error.exception.detail))
        self.assertNotIn("Sensitive driver text", str(error.exception.detail))
        self.assertEqual(self.collection.documents, [])
        self.assertFalse(RoutePlanningEventService._indexes_initialized)

    def test_interrupted_metadata_write_can_be_resumed(self):
        self.collection.error = AutoReconnect("Offline")
        with self.assertRaises(RoutePlanningUnavailable):
            RoutePlanningEventService.initialize_tracking()
        self.collection.error = None
        result = RoutePlanningEventService.initialize_tracking()
        self.assertTrue(result["initialized"])
        self.assertEqual(len(self.collection.documents), 1)

    def test_command_reports_new_and_existing_setup(self):
        for expected in ("initialized", "already_initialized"):
            output = StringIO()
            call_command("initialize_route_planning_tracking", stdout=output)
            report = json.loads(output.getvalue())
            self.assertEqual(report["status"], expected)
            self.assertEqual(report["synthetic_events_created"], 0)
            self.assertFalse(report["coverage_verified"])
            self.assertEqual(report["tracking_started_at"], self.NOW.isoformat())

    def test_command_connection_failure_is_a_sanitized_command_error(self):
        with patch.object(
            RoutePlanningEventService,
            "_get_collection",
            side_effect=AutoReconnect("secret connection string"),
        ):
            with self.assertRaises(CommandError) as error:
                call_command("initialize_route_planning_tracking")
        self.assertIn("AutoReconnect", str(error.exception))
        self.assertNotIn("secret", str(error.exception))

    def test_command_refuses_to_reset_invalid_metadata(self):
        self.collection.documents = [{"_id": "tracking-state-v1"}]
        with self.assertRaisesMessage(CommandError, "timestamp has not been reset"):
            call_command("initialize_route_planning_tracking")
        self.assertEqual(self.collection.documents, [{"_id": "tracking-state-v1"}])

    def test_explicit_initialization_yields_zero_partial_counts_for_each_period(self):
        RoutePlanningEventService.initialize_tracking()
        self.clock.return_value += timedelta(minutes=1)
        business = SimpleNamespace(
            pk=9,
            BUSN_NAME="Demo",
            BUSN_STATUS="active",
        )
        for preset in ("7", "30", "90"):
            period = resolve_period(preset=preset)
            with patch(
                "apps.merchant_operations.merchant_analytics.services."
                "route_planning_analytics_service.BusinessProfileService.get_business_for_merchant",
                return_value=business,
            ):
                report = RoutePlanningAnalyticsService.get_report(
                    user=SimpleNamespace(pk=85),
                    period=period,
                )
            self.assertEqual(report["total_requests"], 0)
            self.assertEqual(report["distinct_explorer_accounts"], 0)
            self.assertEqual(report["road_route_requests"], 0)
            self.assertEqual(report["jeepney_requests"], 0)
            self.assertEqual(report["meta"]["availability"], "partial")
            self.assertIn(
                "tracking_started_during_period",
                report["meta"]["partial_reasons"],
            )
            self.assertFalse(report["meta"]["coverage_verified"])
        self.assertEqual(len(self.collection.write_calls), 1)
        self.assertEqual(len(self.collection.index_calls), 2)
