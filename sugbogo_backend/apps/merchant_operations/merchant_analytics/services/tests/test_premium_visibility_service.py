from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from pymongo.errors import AutoReconnect

from apps.business.services.visibility_event_service import VisibilityEventService, VisibilityTrackingUnavailable
from apps.shared.analytics.date_ranges import resolve_period

from ..premium_visibility_service import PremiumVisibilityService
from .fixtures import MerchantAnalyticsFixtures


class PremiumVisibilityServiceTests(MerchantAnalyticsFixtures, TestCase):
    def test_profile_uniques_ignore_other_events_and_never_sum_daily_uniques(self):
        self.event("PROFILE_VISIT", 1, self.period.start)
        self.event("PROFILE_VISIT", 1, self.period.start + timedelta(days=1))
        self.event("IMPRESSION", 2, self.period.start)
        self.event("SAVE", 3, self.period.start)
        self.event("PROFILE_VISIT", 4, self.period.start, self.business_b)
        self.event("PROFILE_VISIT", 9, self.period.end)
        report = PremiumVisibilityService.get_report(self.merchant_a, self.period)
        visitors = report["metrics"]["distinct_profile_visitors"]
        self.assertEqual(visitors["value"], 1)
        self.assertEqual(sum(row["value"] for row in visitors["series"]), 2)
        self.assertEqual(report["metrics"]["profile_visits"]["value"], 2)
        self.assertEqual(report["metrics"]["impressions"]["value"], 1)

    def test_weekly_savers_are_save_only_with_period_wide_distinct_count(self):
        for days in (0, 8):
            self.event("SAVE", 1, self.period.start + timedelta(days=days))
        self.event("PROFILE_VISIT", 2, self.period.start)
        report = PremiumVisibilityService.get_report(self.merchant_a, self.period, interval="weekly", pocket=True)
        self.assertEqual(report["metrics"]["saves"]["value"], 2)
        self.assertEqual(report["metrics"]["distinct_savers"]["value"], 1)
        self.assertEqual(sum(row["value"] for row in report["metrics"]["distinct_savers"]["series"]), 2)

    def test_previous_period_uses_exact_equal_duration_and_adjacent_edges(self):
        for timestamp in (self.period.previous_start, self.period.previous_end - timedelta(microseconds=1)):
            self.event("IMPRESSION", 1, timestamp)
        self.event("IMPRESSION", 1, self.period.start)
        metric = PremiumVisibilityService.get_report(self.merchant_a, self.period)["metrics"]["impressions"]
        self.assertEqual((metric["value"], metric["previous_value"]), (1, 2))
        self.assertIsNone(metric["change"]["value"])
        self.assertEqual(metric["change"]["reason"], "coverage_unverified")
        prior = metric["sources"]["previous"]["period"]
        self.assertEqual(prior["start"], self.period.previous_start.isoformat())
        self.assertEqual(prior["end_exclusive"], self.period.start.isoformat())

    def test_manila_bucket_and_clipped_partial_week(self):
        period = resolve_period(preset="custom", start_date="2026-10-06", end_date="2026-10-06", now=self.NOW)
        self.event("PROFILE_VISIT", 1, period.start)
        row = PremiumVisibilityService.get_report(self.merchant_a, period, interval="weekly")["metrics"]["profile_visits"]["series"][0]
        self.assertEqual(row["date"], "2026-10-05")
        self.assertEqual(row["start"], period.start.isoformat())
        self.assertEqual(row["end_exclusive"], period.end.isoformat())

    def test_empty_observed_period_is_zero_with_sparse_series_and_no_growth_claim(self):
        report = PremiumVisibilityService.get_report(self.merchant_a, self.period)
        for metric in report["metrics"].values():
            self.assertEqual(metric["value"], 0)
            self.assertEqual(metric["series"], [])
            self.assertIsNone(metric["change"]["value"])

    def test_mongo_failure_is_null_unavailable_not_zero(self):
        with patch.object(self.collection, "aggregate", side_effect=AutoReconnect("Simulated outage")):
            report = PremiumVisibilityService.get_report(self.merchant_a, self.period)
        self.assertEqual(report["meta"]["availability"], "unavailable")
        for metric in report["metrics"].values():
            self.assertIsNone(metric["value"])
            self.assertIsNone(metric["series"])

    def test_series_failure_preserves_successful_total_and_marks_partial(self):
        self.event("PROFILE_VISIT", 1, self.period.start)
        with patch.object(VisibilityEventService, "get_analytics_series", side_effect=VisibilityTrackingUnavailable()):
            report = PremiumVisibilityService.get_report(self.merchant_a, self.period)
        metric = report["metrics"]["profile_visits"]
        self.assertEqual(metric["value"], 1)
        self.assertIsNone(metric["series"])
        self.assertEqual(metric["sources"]["current"]["availability"], "partial")

    def test_default_shared_explorer_series_still_combines_event_types(self):
        self.event("SAVE", 1, self.period.start)
        self.event("PROFILE_VISIT", 2, self.period.start)
        query = {"business_ids": [self.business_a.pk], "start_time": self.period.start, "end_time": self.period.end}
        self.assertEqual(VisibilityEventService.get_analytics_explorer_series(**query)[0]["count"], 2)
        self.assertEqual(VisibilityEventService.get_analytics_explorer_series(**query, event_type="SAVE")[0]["count"], 1)
