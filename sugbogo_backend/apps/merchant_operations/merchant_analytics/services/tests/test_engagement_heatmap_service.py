"""Owned-business engagement timing, period exposure and source availability."""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from django.db import connection
from django.test import SimpleTestCase, TestCase
from django.test.utils import CaptureQueriesContext
from pymongo.errors import AutoReconnect

from apps.business.services.visibility_event_service import VisibilityEventService
from apps.shared.analytics.date_ranges import resolve_period

from ..engagement_heatmap_service import EngagementHeatmapService as Heatmap
from .fixtures import MerchantAnalyticsFixtures


class EngagementPeriodTests(SimpleTestCase):
    def test_current_partial_hour_and_unselected_hours_are_distinct(self):
        period = resolve_period(preset="custom", start_date="2026-10-13", end_date="2026-10-13",
                                now=datetime(2026, 10, 13, 4, 30, tzinfo=UTC))
        counts, partial = Heatmap.period_occurrences(period)
        self.assertEqual(partial, (2, 12))
        self.assertEqual(sum(counts.values()), 13)
        self.assertEqual(counts[(2, 12)], 1)
        self.assertEqual(counts[(2, 13)], 0)
        self.assertEqual(counts[(1, 12)], 0)

    def test_completed_day_excludes_following_midnight_and_has_no_partial_hour(self):
        period = resolve_period(preset="custom", start_date="2026-10-12", end_date="2026-10-12",
                                now=datetime(2026, 10, 13, 4, 30, tzinfo=UTC))
        counts, partial = Heatmap.period_occurrences(period)
        self.assertIsNone(partial)
        self.assertEqual(sum(counts.values()), 24)
        self.assertTrue(all(counts[(1, hour)] == 1 for hour in range(24)))
        self.assertTrue(all(counts[(2, hour)] == 0 for hour in range(24)))

    def test_repeated_weeks_count_each_calendar_occurrence_without_claiming_coverage(self):
        period = resolve_period(preset="custom", start_date="2026-09-28", end_date="2026-10-12",
                                now=datetime(2026, 10, 13, 4, 30, tzinfo=UTC))
        counts, partial = Heatmap.period_occurrences(period)
        self.assertEqual(sum(counts.values()), 15 * 24)
        self.assertEqual(counts[(1, 8)], 3)
        self.assertEqual(counts[(2, 8)], 2)
        self.assertIsNone(partial)

    def test_long_custom_period_keeps_a_fixed_168_slot_result(self):
        period = resolve_period(preset="custom", start_date="2000-01-01", end_date="2026-10-12",
                                now=datetime(2026, 10, 13, 4, 30, tzinfo=UTC))
        counts, partial = Heatmap.period_occurrences(period)
        self.assertEqual(len(counts), 168)
        self.assertEqual(sum(counts.values()), int((period.end - period.start).total_seconds() // 3600))
        self.assertIsNone(partial)


class EngagementHeatmapServiceTests(MerchantAnalyticsFixtures, TestCase):
    def test_only_owned_profile_visits_reconcile_from_one_read_without_writes(self):
        for business, kind in ((self.business_a, "PROFILE_VISIT"), (self.business_b, "PROFILE_VISIT"),
                               (self.business_a, "SAVE"), (self.business_a, "IMPRESSION")):
            self.event(kind, 1, self.period.start, business)
        self.event("PROFILE_VISIT", 1, self.period.start + timedelta(days=7))
        self.event("PROFILE_VISIT", 2, self.period.start - timedelta(microseconds=1))
        self.event("PROFILE_VISIT", 2, self.period.end)
        with CaptureQueriesContext(connection) as queries:
            report = Heatmap.get_report(self.merchant_a, self.period)
        self.assertEqual(report["total_profile_visits"], 2)
        self.assertEqual(sum(row["profile_visits"] or 0 for row in report["cells"]), 2)
        self.assertEqual(len(self.collection.calls), 1)
        self.assertFalse(any(query["sql"].lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE")) for query in queries))
        self.assertEqual(report["business"]["id"], self.business_a.pk)
        self.assertEqual(report["sample"]["nonzero_cells"], 1)
        self.assertFalse(report["sample"]["conclusions_available"])

    def test_utc_sunday_evening_is_manila_monday_and_midnight_changes_the_hour(self):
        for timestamp in (datetime(2026, 10, 11, 15, 59, tzinfo=UTC),
                          datetime(2026, 10, 11, 16, 0, tzinfo=UTC)):
            self.event("PROFILE_VISIT", 1, timestamp)
        report = Heatmap.get_report(self.merchant_a, self.period)
        observed = {(row["weekday"], row["hour"]): row["profile_visits"]
                    for row in report["cells"] if row["profile_visits"]}
        self.assertEqual(observed, {(7, 23): 1, (1, 0): 1})

    def test_same_weekday_hour_across_weeks_is_additive_and_axes_are_stable(self):
        for days in (0, 7, 14):
            self.event("PROFILE_VISIT", 1, self.period.start + timedelta(days=days, hours=2))
        report = Heatmap.get_report(self.merchant_a, self.period)
        self.assertEqual(len(report["cells"]), 168)
        self.assertEqual(report["hours"], list(range(24)))
        self.assertEqual([row["label"] for row in report["weekdays"]], list(Heatmap.WEEKDAYS))
        self.assertEqual(report["legend"]["maximum"], 3)
        self.assertEqual(report["total_profile_visits"], 3)

    def test_healthy_empty_source_is_zero_with_unverified_coverage(self):
        report = Heatmap.get_report(self.merchant_a, self.period)
        self.assertEqual(report["total_profile_visits"], 0)
        self.assertTrue(report["legend"]["zero_range"])
        self.assertEqual(report["sample"]["nonzero_cells"], 0)
        self.assertTrue(all(row["state"] == "zero_recorded_visits" for row in report["cells"]))
        self.assertFalse(report["meta"]["coverage_verified"])
        self.assertIn("coverage_unverified", report["meta"]["partial_reasons"])

    def test_short_period_retains_null_outside_slots_and_marks_partial_hour(self):
        period = resolve_period(preset="custom", start_date="2026-10-13", end_date="2026-10-13", now=self.NOW)
        report = Heatmap.get_report(self.merchant_a, period)
        by_slot = {(row["weekday"], row["hour"]): row for row in report["cells"]}
        self.assertEqual(by_slot[(2, 12)]["profile_visits"], 0)
        self.assertTrue(by_slot[(2, 12)]["includes_partial_hour"])
        self.assertEqual(by_slot[(2, 13)]["state"], "outside_period")
        self.assertIsNone(by_slot[(2, 13)]["profile_visits"])
        self.assertEqual(report["sample"]["in_period_cells"], 13)
        self.assertEqual(report["sample"]["outside_period_cells"], 155)

    def test_source_failure_keeps_layout_but_has_no_fabricated_counts_or_scale(self):
        with patch.object(self.collection, "aggregate", side_effect=AutoReconnect("Unavailable")):
            report = Heatmap.get_report(self.merchant_a, self.period)
        self.assertEqual(len(report["cells"]), 168)
        self.assertTrue(all(row["profile_visits"] is None for row in report["cells"]))
        self.assertIsNone(report["total_profile_visits"])
        self.assertIsNone(report["legend"]["maximum"])
        self.assertIsNone(report["legend"]["zero_range"])
        self.assertIsNone(report["sample"]["nonzero_cells"])
        self.assertEqual(report["meta"]["availability"], "unavailable")

    def test_timing_reader_leaves_daily_deduplication_implementation_unchanged(self):
        timestamp = datetime(2026, 10, 12, 16, tzinfo=UTC)
        day = VisibilityEventService._get_event_day(timestamp)
        self.assertEqual(day, "2026-10-12")
        self.assertIn("daily deduplication", Heatmap.NOTE)
