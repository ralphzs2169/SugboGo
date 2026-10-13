"""Grouped and pooled coverage of current active inventory."""

from unittest.mock import patch

from django.test import TestCase

from apps.admin_operations.analytics.services.coverage_analytics_service import CoverageAnalyticsService
from apps.admin_operations.analytics.tests.test_business_attention_service import AttentionFixtures
from apps.business.services.visibility_event_service import VisibilityEventService, VisibilityTrackingUnavailable


class CoverageAnalyticsServiceTests(AttentionFixtures, TestCase):
    def report(self, **options):
        with patch.object(VisibilityEventService, "get_business_attention_metrics", side_effect=self.mongo_metrics):
            return CoverageAnalyticsService.get_report(self.period, **options)

    def test_coverage_pools_counts_instead_of_averaging_group_percentages(self):
        report = self.report()
        self.assertEqual(report["overall"], {
            "eligible_businesses": 4, "visited_businesses": 3,
            "zero_recorded_visit_businesses": 1, "coverage_percentage": 75,
        })
        groups = {row["id"]: row for row in report["clusters"]}
        self.assertEqual(groups[self.cluster_a.pk]["coverage_percentage"], 66.67)
        self.assertEqual(groups[self.cluster_b.pk]["coverage_percentage"], 100)
        self.assertIsNone(groups[self.empty_cluster.pk]["coverage_percentage"])

    def test_filters_scope_both_denominator_and_recorded_visits(self):
        report = self.report(cluster=self.cluster_a.pk, category=self.category_a.pk)
        self.assertEqual(report["overall"]["eligible_businesses"], 3)
        self.assertEqual(report["overall"]["coverage_percentage"], 66.67)
        self.assertEqual(len(report["clusters"]), 1)
        self.assertEqual(len(report["categories"]), 1)

    def test_empty_group_and_zero_visits_are_not_the_same_result(self):
        empty = self.report(category=self.empty_category.pk)
        self.assertEqual(empty["overall"]["eligible_businesses"], 0)
        self.assertIsNone(empty["overall"]["coverage_percentage"])
        for value in self.metrics.values():
            value["profile_visits"] = 0
        zero = self.report()
        self.assertEqual(zero["overall"]["visited_businesses"], 0)
        self.assertEqual(zero["overall"]["coverage_percentage"], 0)
        self.assertEqual(zero["overall"]["zero_recorded_visit_businesses"], 4)

    def test_failed_tracking_preserves_sql_population_but_has_no_coverage(self):
        with patch.object(VisibilityEventService, "get_business_attention_metrics", side_effect=VisibilityTrackingUnavailable()):
            report = CoverageAnalyticsService.get_report(self.period)
        self.assertEqual(report["overall"]["eligible_businesses"], 4)
        self.assertIsNone(report["overall"]["visited_businesses"])
        self.assertIsNone(report["overall"]["coverage_percentage"])
        self.assertEqual(report["sources"]["visibility"]["availability"], "unavailable")
