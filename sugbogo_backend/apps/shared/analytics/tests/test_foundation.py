from datetime import UTC, datetime, timedelta

from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError

from apps.shared.analytics.comparisons import compare_values
from apps.shared.analytics.date_ranges import resolve_period
from apps.shared.analytics.metadata import build_meta


class AnalyticsPeriodTests(SimpleTestCase):
    NOW = datetime(2026, 10, 11, 16, 30, tzinfo=UTC)

    def test_presets_include_today_in_manila_and_cap_at_captured_now(self):
        for days in (7, 30, 90):
            with self.subTest(days=days):
                period = resolve_period(preset=str(days), now=self.NOW)
                self.assertEqual(period.end_date.isoformat(), "2026-10-12")
                self.assertEqual((period.end_date - period.start_date).days, days - 1)
                self.assertEqual(period.start.hour, 16)
                self.assertEqual(period.end, self.NOW)
                self.assertEqual(period.previous_end, period.start)
                self.assertEqual(period.end - period.start, period.previous_end - period.previous_start)
                self.assertTrue(period.includes_partial_day)

    def test_default_is_thirty_days(self):
        self.assertEqual(resolve_period(now=self.NOW), resolve_period(preset="30", now=self.NOW))

    def test_custom_day_uses_manila_midnight_and_exclusive_utc_end(self):
        period = resolve_period(
            preset="custom", start_date="2026-10-10", end_date="2026-10-10", now=self.NOW,
        )
        self.assertEqual(period.start, datetime(2026, 10, 9, 16, tzinfo=UTC))
        self.assertEqual(period.end, datetime(2026, 10, 10, 16, tzinfo=UTC))
        self.assertFalse(period.includes_partial_day)
        self.assertEqual(period.previous_start, period.start - timedelta(days=1))

    def test_invalid_dates_presets_and_naive_clock_are_rejected(self):
        invalid = [
            {"preset": "14"},
            {"preset": "7", "start_date": "2026-10-01"},
            {"preset": "custom", "start_date": "bad", "end_date": "2026-10-10"},
            {"preset": "custom", "start_date": "20261010", "end_date": "2026-10-10"},
            {"preset": "custom", "start_date": "2026-10-11", "end_date": "2026-10-10"},
            {"preset": "custom", "start_date": "2026-10-10", "end_date": "2026-10-13"},
            {"preset": "custom", "start_date": None, "end_date": "2026-10-10"},
        ]
        for options in invalid:
            with self.subTest(options=options), self.assertRaises(ValidationError):
                resolve_period(now=self.NOW, **options)
        with self.assertRaises(ValidationError):
            resolve_period(now=datetime(2026, 10, 12))


class AnalyticsComparisonTests(SimpleTestCase):
    def comparison(self, **options):
        values = {"current": 120, "previous": 100, "current_sample_size": 20, "previous_sample_size": 20}
        values.update(options)
        return compare_values(**values)

    def test_relative_count_change_and_decline(self):
        self.assertEqual(self.comparison()["value"], 20)
        result = self.comparison(current=0)
        self.assertEqual(result["value"], -100)
        self.assertEqual(result["direction"], "down")

    def test_rate_change_is_percentage_points_even_when_previous_rate_is_zero(self):
        result = self.comparison(
            current=20, previous=0, unit="percentage_points",
            current_denominator=20, previous_denominator=20,
        )
        self.assertEqual(result["value"], 20)
        self.assertEqual(result["unit"], "percentage_points")

    def test_undefined_comparisons_return_reason_and_null_not_zero(self):
        cases = [
            ({"previous": 0}, "zero_previous_value"),
            ({"current": None}, "missing_value"),
            ({"previous_sample_size": 2, "minimum_sample_size": 5}, "insufficient_sample"),
            ({"data_available": False}, "data_unavailable"),
            ({"current": 20, "previous": 10, "unit": "percentage_points",
              "current_denominator": 20, "previous_denominator": 0}, "missing_or_zero_denominator"),
        ]
        for options, reason in cases:
            with self.subTest(options=options):
                result = self.comparison(**options)
                self.assertIsNone(result["value"])
                self.assertEqual(result["reason"], reason)


class AnalyticsMetadataTests(SimpleTestCase):
    def setUp(self):
        self.period = resolve_period(
            preset="custom", start_date="2026-10-10", end_date="2026-10-10",
            now=datetime(2026, 10, 12, tzinfo=UTC),
        )

    def test_unknown_coverage_and_freshness_are_not_asserted_complete(self):
        meta = build_meta(self.period)
        self.assertEqual(meta["availability"], "partial")
        self.assertTrue(meta["is_partial"])
        self.assertIn("coverage_unverified", meta["partial_reasons"])
        self.assertIn("freshness_unverified", meta["partial_reasons"])
        self.assertIsNone(meta["data_through"])

    def test_complete_metadata_requires_verified_coverage_and_cutoff(self):
        meta = build_meta(self.period, coverage_verified=True, data_through=self.period.end)
        self.assertEqual(meta["availability"], "available")
        self.assertFalse(meta["is_partial"])
        self.assertEqual(meta["partial_reasons"], [])

    def test_unavailable_source_has_no_data_through(self):
        meta = build_meta(self.period, availability="unavailable", data_through=self.period.end)
        self.assertEqual(meta["availability"], "unavailable")
        self.assertIsNone(meta["data_through"])
        self.assertIn("source_unavailable", meta["partial_reasons"])

    def test_current_day_and_lag_are_reported_separately(self):
        period = resolve_period(now=datetime(2026, 10, 12, 4, tzinfo=UTC))
        meta = build_meta(period, coverage_verified=True, data_through=period.end - timedelta(hours=1))
        self.assertIn("current_day_incomplete", meta["partial_reasons"])
        self.assertIn("data_lag", meta["partial_reasons"])

    def test_invalid_status_and_cutoff_are_rejected(self):
        for options in (
            {"availability": "unknown"},
            {"data_through": datetime(2026, 10, 10)},
            {"data_through": self.period.end + timedelta(seconds=1)},
        ):
            with self.subTest(options=options), self.assertRaises(ValueError):
                build_meta(self.period, **options)
