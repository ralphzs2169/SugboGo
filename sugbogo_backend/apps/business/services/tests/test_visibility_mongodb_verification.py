from io import StringIO
import json
from unittest.mock import MagicMock, patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase, override_settings
from pymongo.errors import ConfigurationError
from rest_framework.exceptions import ValidationError

from apps.business.services.visibility_event_service import VisibilityEventService
from apps.business.services.visibility_mongodb_verification_service import VisibilityMongoVerificationService
from apps.shared.analytics.date_ranges import resolve_period
from apps.shared.services.mongodb_service import MongoDBService
from .test_visibility_live_mongodb import validate_temporary_database


@override_settings(MONGODB_URI="mongodb://example.invalid", MONGODB_DATABASE="sugbogo")
class VisibilityMongoVerificationTests(SimpleTestCase):
    def setUp(self):
        self.period = resolve_period()
        self.database = MagicMock()
        self.database.list_collection_names.return_value = []
        self.collection = self.database.__getitem__.return_value
        ping = patch.object(MongoDBService, "ping", return_value=True)
        database = patch.object(MongoDBService, "get_database", return_value=self.database)
        for mocked in (ping, database):
            mocked.start()
            self.addCleanup(mocked.stop)
        indexes = patch.object(VisibilityEventService, "ensure_indexes", side_effect=AssertionError("Index mutation attempted"))
        indexes.start()
        self.addCleanup(indexes.stop)

    def test_missing_collection_is_disclosed_without_creation_or_fake_zero_totals(self):
        report = VisibilityMongoVerificationService.inspect(self.period)
        self.assertEqual(report["status"], "collection_missing")
        self.assertIsNone(report["period_totals"])
        self.assertIsNone(report["period_distinct_explorers"])
        self.assertIn("visibility_collection_missing", report["meta"]["partial_reasons"])
        self.database.create_collection.assert_not_called()
        self.database.__getitem__.assert_not_called()

    def test_existing_store_has_safe_totals_dates_and_index_validation(self):
        self.database.list_collection_names.return_value = [VisibilityEventService.COLLECTION_NAME]
        self.collection.list_indexes.return_value = [
            {"name": VisibilityEventService.DEDUPE_INDEX_NAME, "key": {"dedupe_key": 1}, "unique": True},
            {"name": VisibilityEventService.AGGREGATION_INDEX_NAME, "key": {"event_type": 1, "business_id": 1, "occurred_at": 1}},
        ]
        self.collection.aggregate.side_effect = [
            [{"_id": "PROFILE_VISIT", "count": 3}], [{"count": 1}],
            [{"_id": "PROFILE_VISIT", "first": self.period.start.replace(tzinfo=None)}],
        ]
        report = VisibilityMongoVerificationService.inspect(self.period)
        self.assertEqual(report["period_totals"], {"IMPRESSION": 0, "PROFILE_VISIT": 3, "SAVE": 0})
        self.assertEqual(report["period_distinct_explorers"], 1)
        self.assertEqual(report["first_observed_events"]["PROFILE_VISIT"], self.period.start.isoformat())
        self.assertTrue(all(report["expected_indexes"].values()))
        self.assertFalse(report["meta"]["coverage_verified"])
        self.assertNotIn("explorer_id", json.dumps(report))
        self.collection.create_index.assert_not_called()
        self.collection.insert_one.assert_not_called()

    def test_wrong_index_shape_or_nonunique_dedupe_is_not_accepted(self):
        self.database.list_collection_names.return_value = [VisibilityEventService.COLLECTION_NAME]
        self.collection.list_indexes.return_value = [
            {"name": VisibilityEventService.DEDUPE_INDEX_NAME, "key": {"dedupe_key": 1}},
            {"name": VisibilityEventService.AGGREGATION_INDEX_NAME, "key": {"occurred_at": 1}},
        ]
        self.collection.aggregate.return_value = []
        report = VisibilityMongoVerificationService.inspect(self.period)
        self.assertFalse(any(report["expected_indexes"].values()))

    def test_planner_output_excludes_predicates_and_documents(self):
        plan = {"queryPlanner": {"winningPlan": {"stage": "FETCH", "inputStage": {
            "stage": "IXSCAN", "indexName": "visibility_event_business_time", "filter": {"explorer_id": "private"},
        }}}}
        safe = VisibilityMongoVerificationService.summarize_plan(plan)
        self.assertEqual(safe, {"stages": ["FETCH", "IXSCAN"], "index_names": ["visibility_event_business_time"]})
        self.assertNotIn("private", str(safe))

    @override_settings(MONGODB_URI=None)
    def test_missing_uri_refuses_implicit_localhost_without_attempting_connection(self):
        with self.assertRaises(ValidationError):
            VisibilityMongoVerificationService.inspect(self.period)
        MongoDBService.ping.assert_not_called()

    def test_bad_deadline_is_rejected(self):
        for deadline in (0, 60001, True):
            with self.assertRaises(ValidationError):
                VisibilityMongoVerificationService.inspect(self.period, max_time_ms=deadline)

    def test_command_outputs_json_without_uri_and_rejects_bad_dates(self):
        output = StringIO()
        call_command("verify_visibility_mongodb", stdout=output)
        result = json.loads(output.getvalue())
        self.assertTrue(result["read_only"])
        self.assertNotIn("example.invalid", output.getvalue())
        with self.assertRaises(CommandError):
            call_command("verify_visibility_mongodb", period="custom", start_date="invalid", end_date="invalid")

    def test_driver_errors_are_sanitized_even_when_exception_text_contains_credentials(self):
        with patch.object(MongoDBService, "ping", side_effect=ConfigurationError("mongodb://secret-password@example.invalid")):
            with self.assertRaises(CommandError) as error:
                call_command("verify_visibility_mongodb")
        self.assertIn("ConfigurationError", str(error.exception))
        self.assertNotIn("secret-password", str(error.exception))
        self.assertNotIn("example.invalid", str(error.exception))

    def test_live_cleanup_guard_rejects_application_or_nonrandom_names(self):
        for name in ("sugbogo", "sg_av_", "sg_av_abc", "sugbogo_analytics_verify_" + "a" * 32, "other_" + "a" * 32):
            with self.assertRaises(AssertionError):
                validate_temporary_database(name, "sugbogo")
        name = "sg_av_" + "a" * 32
        self.assertEqual(len(name.encode("ascii")), 38)
        with self.assertRaises(AssertionError):
            validate_temporary_database(name, name)
        validate_temporary_database(name, "sugbogo")
