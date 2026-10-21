from dataclasses import replace
from datetime import UTC, datetime, timedelta

from django.test import SimpleTestCase

from apps.shared.analytics.comparisons import (
    compare_count_difference,
    compare_values,
    equal_elapsed_periods,
)
from apps.shared.analytics.date_ranges import resolve_period


class KpiComparisonTests(SimpleTestCase):
    def test_absolute_counts_include_zero_cohorts_without_percentage_growth(self):
        for current, previous, expected in ((3, 0, 3), (0, 3, -3), (0, 0, 0)):
            with self.subTest(current=current, previous=previous):
                result = compare_count_difference(
                    current=current,
                    previous=previous,
                )
                self.assertEqual(result["value"], expected)
                self.assertEqual(result["unit"], "count")
        missing = compare_count_difference(
            current=None,
            previous=1,
        )
        unavailable = compare_count_difference(
            current=1,
            previous=1,
            data_available=False,
        )
        self.assertIsNone(missing["value"])
        self.assertIsNone(unavailable["value"])

    def test_verified_percent_changes_handle_zero_current_and_zero_previous(self):
        cases = (
            (12, 10, 20),
            (5, 10, -50),
            (10, 10, 0),
            (0, 10, -100),
            (1, 0, None),
        )
        for current, previous, expected in cases:
            with self.subTest(current=current, previous=previous):
                result = compare_values(
                    current=current,
                    previous=previous,
                    current_sample_size=current,
                    previous_sample_size=previous,
                    minimum_sample_size=0,
                )
                self.assertEqual(result["value"], expected)
        self.assertEqual(result["reason"], "zero_previous_value")

    def test_partial_manila_periods_have_equal_adjacent_elapsed_windows(self):
        period = resolve_period(
            preset="7",
            now=datetime(2026, 10, 13, 4, 30, tzinfo=UTC),
        )
        self.assertTrue(period.includes_partial_day)
        self.assertTrue(equal_elapsed_periods(period))
        self.assertEqual(period.start.hour, 16)
        unequal_period = replace(
            period,
            previous_start=period.previous_start - timedelta(seconds=1),
        )
        self.assertFalse(equal_elapsed_periods(unequal_period))
