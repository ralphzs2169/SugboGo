"""Discovery report availability, period isolation and real aggregation delegation."""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError

from apps.admin_operations.analytics.services.discovery_analytics_service import DiscoveryAnalyticsService
from apps.business.services.tests.test_visibility_analytics_service import ReadOnlyCollection
from apps.business.services.visibility_event_service import VisibilityEventService, VisibilityTrackingUnavailable
from apps.shared.analytics.date_ranges import resolve_period


class DiscoveryAnalyticsServiceTests(SimpleTestCase):
    def setUp(self):
        self.period = resolve_period(
            preset="custom", start_date="2026-10-05", end_date="2026-10-06",
            now=datetime(2026, 10, 12, tzinfo=UTC),
        )
        self.original_cooldown = VisibilityEventService._unavailable_until
        VisibilityEventService._unavailable_until = 0
        self.addCleanup(setattr, VisibilityEventService, "_unavailable_until", self.original_cooldown)
        start = self.period.start
        self.collection = ReadOnlyCollection([
            {"event_type": "PROFILE_VISIT", "explorer_id": 1, "business_id": 10, "occurred_at": start},
            {"event_type": "PROFILE_VISIT", "explorer_id": 1, "business_id": 20, "occurred_at": start},
            {"event_type": "SAVE", "explorer_id": 1, "business_id": 10, "occurred_at": start + timedelta(days=1)},
            {"event_type": "IMPRESSION", "explorer_id": 2, "business_id": 20, "occurred_at": start},
            {"event_type": "IMPRESSION", "explorer_id": 3, "business_id": 10, "occurred_at": self.period.previous_start},
        ])
        collection_patch = patch.object(VisibilityEventService, "_get_collection", return_value=self.collection)
        collection_patch.start()
        self.addCleanup(collection_patch.stop)
        indexes = patch.object(VisibilityEventService, "ensure_indexes", side_effect=AssertionError("Index write"))
        indexes.start()
        self.addCleanup(indexes.stop)

    def test_each_metric_returns_selected_counts_and_sparse_series(self):
        for metric, total, prior in (
            ("profile_visits", 2, 0), ("saves", 1, 0), ("impressions", 1, 1),
            ("distinct_engaged_explorers", 2, 1),
        ):
            with self.subTest(metric=metric):
                report = DiscoveryAnalyticsService.get_report(self.period, metric=metric)
                self.assertEqual(report["value"], total)
                self.assertEqual(report["previous_value"], prior)
                self.assertTrue(report["series_is_sparse"])
                self.assertIsNone(report["change"]["value"])
                self.assertEqual(report["change"]["reason"], "coverage_unverified")
                self.assertEqual(report["meta"]["availability"], "partial")
        distinct = DiscoveryAnalyticsService.get_report(self.period, metric="distinct_engaged_explorers")
        self.assertEqual(sum(row["value"] for row in distinct["series"]), 3)
        self.assertEqual(distinct["value"], 2)
        self.assertIn("not total app MAU", distinct["label"])

    def test_weekly_distinct_series_is_not_event_count_series(self):
        report = DiscoveryAnalyticsService.get_report(
            self.period, metric="distinct_engaged_explorers", interval="weekly",
        )
        self.assertEqual(len(report["series"]), 1)
        self.assertEqual(report["series"][0]["value"], 2)
        self.assertEqual(report["series"][0]["date"], "2026-10-05")

    def test_previous_period_failure_preserves_current_value(self):
        with patch.object(VisibilityEventService, "get_analytics_totals", side_effect=[
            {"IMPRESSION": 1, "PROFILE_VISIT": 2, "SAVE": 1}, VisibilityTrackingUnavailable(),
        ]):
            report = DiscoveryAnalyticsService.get_report(self.period)
        self.assertEqual(report["value"], 2)
        self.assertIsNone(report["previous_value"])
        self.assertEqual(report["sources"]["visibility_previous"]["availability"], "unavailable")
        self.assertIn("previous_period_unavailable", report["meta"]["partial_reasons"])
        self.assertIsNone(report["change"]["value"])

    def test_current_period_failure_preserves_successful_prior_value(self):
        with patch.object(VisibilityEventService, "get_analytics_totals", side_effect=[
            VisibilityTrackingUnavailable(), {"IMPRESSION": 1, "PROFILE_VISIT": 3, "SAVE": 1},
        ]), patch.object(VisibilityEventService, "get_analytics_series", side_effect=VisibilityTrackingUnavailable()):
            report = DiscoveryAnalyticsService.get_report(self.period)
        self.assertIsNone(report["value"])
        self.assertIsNone(report["series"])
        self.assertEqual(report["previous_value"], 3)
        self.assertEqual(report["sources"]["visibility_current"]["availability"], "unavailable")

    def test_failed_series_does_not_erase_successful_total(self):
        with patch.object(VisibilityEventService, "get_analytics_series", side_effect=VisibilityTrackingUnavailable()):
            report = DiscoveryAnalyticsService.get_report(self.period)
        self.assertEqual(report["value"], 2)
        self.assertIsNone(report["series"])
        self.assertIn("series_read_unavailable", report["meta"]["partial_reasons"])
        self.assertEqual(report["meta"]["availability"], "partial")

    def test_successful_series_can_survive_failed_total(self):
        with patch.object(VisibilityEventService, "get_analytics_totals", side_effect=VisibilityTrackingUnavailable()):
            report = DiscoveryAnalyticsService.get_report(self.period)
        self.assertIsNone(report["value"])
        self.assertEqual(report["series"][0]["value"], 2)
        self.assertEqual(report["meta"]["availability"], "partial")

    def test_no_series_kpi_does_not_run_series_queries(self):
        with patch.object(VisibilityEventService, "get_analytics_explorer_series") as series:
            report = DiscoveryAnalyticsService.get_report(
                self.period, metric="distinct_engaged_explorers", include_series=False,
            )
        series.assert_not_called()
        self.assertEqual(report["value"], 2)

    def test_prior_metadata_keeps_exact_elapsed_boundaries(self):
        current = resolve_period(now=datetime(2026, 10, 12, 4, 30, tzinfo=UTC))
        previous = DiscoveryAnalyticsService.previous_period(current)
        self.assertEqual(previous.start, current.previous_start)
        self.assertEqual(previous.end, current.start)
        self.assertEqual(previous.end - previous.start, current.end - current.start)
        self.assertEqual(previous.generated_at, current.generated_at)

    def test_invalid_selectors_are_rejected_before_mongo_reads(self):
        for options in ({"metric": "revenue"}, {"interval": "monthly"}):
            with self.subTest(options=options), self.assertRaises(ValidationError):
                DiscoveryAnalyticsService.get_report(self.period, **options)
        self.assertEqual(self.collection.calls, [])


    def test_summary_reads_three_totals_once_without_trends(self):
        report = DiscoveryAnalyticsService.get_summary(self.period)
        self.assertEqual(report["totals"], {
            "profile_visits": 2,
            "impressions": 1,
            "saves": 1,
        })
        self.assertEqual(len(self.collection.calls), 1)
        window = self.collection.calls[0][0]["$match"]["occurred_at"]
        self.assertEqual(window["$gte"], self.period.start)
        self.assertEqual(window["$lt"], self.period.end)
        self.assertFalse(report["meta"]["coverage_verified"])
        self.assertIsNone(report["meta"]["data_through"])

    def test_summary_excludes_exact_end_and_prior_records(self):
        self.collection.documents.append({
            "event_type": "SAVE", "explorer_id": 8,
            "business_id": 10, "occurred_at": self.period.end,
        })
        report = DiscoveryAnalyticsService.get_summary(self.period)
        self.assertEqual(report["totals"]["saves"], 1)
        self.assertEqual(report["totals"]["impressions"], 1)

    def test_summary_empty_read_is_zero_but_outage_is_null(self):
        self.collection.documents = []
        report = DiscoveryAnalyticsService.get_summary(self.period)
        self.assertEqual(set(report["totals"].values()), {0})
        with patch.object(
            VisibilityEventService,
            "get_analytics_totals",
            side_effect=VisibilityTrackingUnavailable(),
        ):
            unavailable = DiscoveryAnalyticsService.get_summary(self.period)
        self.assertEqual(set(unavailable["totals"].values()), {None})
        self.assertEqual(unavailable["meta"]["availability"], "unavailable")

    def test_timeline_extends_beyond_last_event_with_null_not_zero(self):
        report = DiscoveryAnalyticsService.get_report(self.period)
        self.assertEqual(len(report["series"]), 1)
        self.assertEqual(len(report["timeline"]), 2)
        self.assertEqual(report["timeline"][0]["value"], 2)
        self.assertIsNone(report["timeline"][1]["value"])
        self.assertEqual(report["timeline"][-1]["end_exclusive"], self.period.end.isoformat())
        self.assertIsNone(report["meta"]["data_through"])

    def test_timeline_preserves_explicit_zero_and_unavailable_series(self):
        timeline = DiscoveryAnalyticsService.build_timeline(
            self.period,
            "daily",
            [{"date": "2026-10-05", "value": 0}],
        )
        self.assertEqual(timeline[0]["value"], 0)
        self.assertIsNone(timeline[1]["value"])
        self.assertIsNone(DiscoveryAnalyticsService.build_timeline(
            self.period, "daily", None,
        ))

    def test_only_current_capped_bucket_is_in_progress(self):
        current = resolve_period(
            preset="custom", start_date="2026-10-05", end_date="2026-10-06",
            now=datetime(2026, 10, 6, 4, tzinfo=UTC),
        )
        timeline = DiscoveryAnalyticsService.build_timeline(current, "weekly", [])
        self.assertTrue(timeline[-1]["in_progress"])
        self.assertEqual(timeline[-1]["end_exclusive"], current.end.isoformat())
        historical = DiscoveryAnalyticsService.build_timeline(self.period, "weekly", [])
        self.assertFalse(historical[-1]["in_progress"])
