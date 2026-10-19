from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase, override_settings
from pymongo.errors import AutoReconnect
from rest_framework.exceptions import ValidationError

from apps.business.services.discovery_source import DISCOVERY_SOURCE_LABELS, DiscoverySource
from apps.business.services.visibility_event_service import VisibilityEventService
from apps.merchant_operations.merchant_analytics.services.discovery_sources_service import (
    DiscoverySourcesService,
)
from apps.shared.analytics.date_ranges import resolve_period
from .discovery_source_fixtures import DiscoverySourceCollection


@override_settings(TIME_ZONE="UTC")
class DiscoverySourceTests(SimpleTestCase):
    NOW = datetime(2026, 10, 19, 5, tzinfo=UTC)

    def setUp(self):
        self.collection = DiscoverySourceCollection()
        self.business = SimpleNamespace(
            pk=9,
            BUSN_ID=9,
            USER_ID_id=85,
            BUSN_NAME="Source fixture",
            BUSN_STATUS="active",
        )
        targets = [
            patch.object(
                VisibilityEventService,
                "_get_collection",
                return_value=self.collection,
            ),
            patch.object(
                VisibilityEventService,
                "_validate_active_business",
                return_value=self.business,
            ),
            patch.object(
                VisibilityEventService,
                "_get_current_time",
                return_value=self.NOW - timedelta(seconds=1),
            ),
            patch.object(VisibilityEventService, "ensure_indexes", return_value=None),
            patch.object(VisibilityEventService, "_unavailable_until", 0),
            patch("apps.business.services.visibility_event_service.VisibilityCoverageService.observe"),
            patch(
                "apps.merchant_operations.merchant_analytics.services."
                "discovery_sources_service.BusinessProfileService.get_business_for_merchant",
                return_value=self.business,
            ),
        ]
        for target in targets:
            target.start()
            self.addCleanup(target.stop)
        self.period = resolve_period(now=self.NOW)

    def record(
        self,
        source=None,
        explorer=17,
    ):
        return VisibilityEventService.record_profile_visit(
            explorer_id=explorer,
            business_id=9,
            discovery_source=source,
        )

    def report(self):
        return DiscoverySourcesService.get_report(
            SimpleNamespace(pk=85),
            self.period,
        )

    def test_all_seven_sources_and_server_labels_have_exact_total_parity(self):
        for index, source in enumerate(DiscoverySource):
            self.record(source.value, explorer=index + 1)
        report = self.report()
        self.assertEqual(report["profile_visits"], 7)
        self.assertEqual(sum(row["count"] for row in report["sources"]), 7)
        for row in report["sources"]:
            self.assertEqual(row["count"], 1)
            self.assertEqual(row["label"], DISCOVERY_SOURCE_LABELS[row["source"]])
        query = {
            "business_ids": [9],
            "start_time": self.period.start,
            "end_time": self.period.end,
        }
        self.assertEqual(
            VisibilityEventService.get_analytics_totals(**query)["PROFILE_VISIT"],
            7,
        )
        self.assertEqual(
            VisibilityEventService.count_analytics_explorers(
                **query,
                event_type="PROFILE_VISIT",
            ),
            7,
        )

    def test_cross_source_duplicate_preserves_first_insert_and_key(self):
        self.assertEqual(self.record("MAP").recorded_count, 1)
        self.assertEqual(self.record("COMMUNITY").duplicate_count, 1)
        self.assertEqual(len(self.collection.documents), 1)
        row = self.collection.documents[0]
        self.assertEqual(row["discovery_source"], "MAP")
        self.assertEqual(row["dedupe_key"], "PROFILE_VISIT:17:9:2026-10-19")

    def test_unknown_and_legacy_documents_are_never_upgraded(self):
        for legacy in (False, True):
            with self.subTest(legacy=legacy):
                self.collection.documents.clear()
                self.record()
                if legacy:
                    self.collection.documents[0].pop("discovery_source")
                original = self.collection.documents[0].copy()
                self.record("EXPLORE_DISCOVERY")
                self.assertEqual(self.collection.documents[0], original)
                self.assertEqual(self.report()["profile_visits"], 1)
                self.assertFalse(self.report()["attribution_complete"])

    def test_malformed_and_excluded_incoming_origins_remain_counted_unknowns(self):
        values = (None, "", "MY_REVIEWS", "VOUCH_HISTORY", "NOTIFICATIONS", "map", [], {}, 4)
        for index, source in enumerate(values):
            self.record(source, explorer=index + 1)
        report = self.report()
        self.assertEqual(report["profile_visits"], 9)
        self.assertEqual(report["sources"][-1]["source"], "UNKNOWN")
        self.assertEqual(report["sources"][-1]["count"], 9)

    def test_legacy_null_invalid_and_structured_stored_values_aggregate_unknown(self):
        for index, source in enumerate((None, "MY_REVIEWS", "VOUCH_HISTORY", "OLD", [], {})):
            self.record("MAP", explorer=index + 1)
            self.collection.documents[-1]["discovery_source"] = source
        self.record("COMMUNITY", explorer=50)
        self.collection.documents[-1].pop("discovery_source")
        report = self.report()
        self.assertEqual(report["profile_visits"], 7)
        self.assertEqual(report["sources"][-1]["count"], 7)

    def test_concurrent_different_sources_preserve_one_winner(self):
        with ThreadPoolExecutor(max_workers=8) as executor:
            results = list(executor.map(self.record, ["MAP", "COMMUNITY"] * 8))
        self.assertEqual(sum(result.recorded_count for result in results), 1)
        self.assertEqual(sum(result.duplicate_count for result in results), 15)
        self.assertEqual(len(self.collection.documents), 1)
        self.assertIn(self.collection.documents[0]["discovery_source"], {"MAP", "COMMUNITY"})

    def test_owner_exclusion_does_not_initialize_or_write(self):
        self.assertEqual(self.record("MAP", explorer=85).recorded_count, 0)
        self.assertEqual(self.collection.documents, [])
        self.assertEqual(self.collection.index_calls, [])

    def test_utc_day_changes_without_reinterpreting_manila_midnight(self):
        clock = "apps.business.services.visibility_event_service.VisibilityEventService._get_current_time"
        first = datetime(2026, 10, 18, 15, 59, tzinfo=UTC)
        boundaries = (
            (first, 1),
            (first + timedelta(minutes=2), 0),
            (first + timedelta(hours=9), 1),
        )
        for timestamp, expected in boundaries:
            with patch(clock, return_value=timestamp):
                self.assertEqual(self.record("MAP").recorded_count, expected)

    def test_manila_boundaries_business_scope_and_event_type_are_preserved(self):
        self.record("MAP")
        template = self.collection.documents[0].copy()
        self.collection.documents = []
        for timestamp in (self.period.start - timedelta(microseconds=1), self.period.start, self.period.end):
            self.collection.documents.append({**template, "occurred_at": timestamp})
        self.collection.documents.append({**template, "business_id": 10})
        self.collection.documents.append({**template, "event_type": "IMPRESSION"})
        self.assertEqual(self.report()["profile_visits"], 1)
        self.assertEqual(self.collection.index_calls, [])

    def test_healthy_zero_preserves_unverified_coverage_without_unknown_activity(self):
        report = self.report()
        self.assertEqual(report["profile_visits"], 0)
        self.assertTrue(report["attribution_complete"])
        self.assertFalse(report["meta"]["coverage_verified"])
        self.assertTrue(all(row["count"] == 0 for row in report["sources"]))

    def test_missing_collection_and_source_failure_are_nullable(self):
        self.collection.exists = False
        report = self.report()
        self.assertIsNone(report["profile_visits"])
        self.assertIsNone(report["sources"])
        self.assertIsNone(report["attribution_complete"])
        self.assertIn("visibility_collection_missing", report["meta"]["partial_reasons"])
        self.collection.error = AutoReconnect("Simulated unavailable source")
        report = self.report()
        self.assertEqual(report["meta"]["availability"], "unavailable")
        self.assertIsNone(report["profile_visits"])

    def test_known_sources_do_not_certify_collection_coverage(self):
        self.record("MAP")
        report = self.report()
        self.assertTrue(report["attribution_complete"])
        self.assertFalse(report["meta"]["coverage_verified"])
        self.assertEqual(report["meta"]["availability"], "partial")

    def test_source_reader_requires_explicit_business_scope(self):
        with self.assertRaises(ValidationError):
            VisibilityEventService.get_profile_visit_sources(
                business_ids=None,
                start_time=self.period.start,
                end_time=self.period.end,
            )
        self.assertEqual(self.collection.calls, [])
