"""Heatmap presentation states without duplicating geographic calculations."""

from copy import deepcopy
from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError

from apps.admin_operations.analytics.services.discovery_heatmap_service import DiscoveryHeatmapService as Heatmap
from apps.admin_operations.analytics.services.geographic_aggregation_service import GeographicAggregationService


class DiscoveryHeatmapServiceTests(SimpleTestCase):
    def setUp(self):
        self.report = {
            "cells": [
                {"id": "one", "eligible_businesses": 2, "profile_visits": 7},
                {"id": "two", "eligible_businesses": 1, "profile_visits": 0},
                {"id": "three", "eligible_businesses": 0, "profile_visits": 0},
            ],
            "sources": {"visibility": {"availability": "partial"}},
            "reconciliation": {"eligible_businesses": 4, "assigned_businesses": 3},
        }
        patcher = patch.object(GeographicAggregationService, "get_report", return_value=self.report)
        self.aggregate = patcher.start()
        self.addCleanup(patcher.stop)

    def test_one_foundation_call_preserves_inputs_and_does_not_mutate_its_output(self):
        original = deepcopy(self.report)
        period = object()
        report = Heatmap.get_report(period, cluster=11, category=12)
        self.aggregate.assert_called_once_with(period, cluster=11, category=12)
        self.assertEqual(self.report, original)
        self.assertEqual(report["selection"]["eligible_businesses"], 3)
        self.assertEqual(report["selection"]["profile_visits"], 7)
        self.assertEqual([row["state"] for row in report["cells"]],
                         ["recorded_visits", "zero_recorded_visits", "no_businesses"])

    def test_cell_selection_keeps_full_scope_legend_and_reconciliation(self):
        report = Heatmap.get_report(object(), cell="two")
        self.assertEqual([row["id"] for row in report["cells"]], ["two"])
        self.assertEqual(report["selection"]["returned_cells"], 1)
        self.assertEqual(report["selection"]["total_scope_cells"], 3)
        self.assertEqual(report["legend"]["maximum"], 7)
        self.assertEqual(report["reconciliation"], self.report["reconciliation"])
        self.assertEqual(report["display_state"], "zero_recorded_visits")

    def test_outside_cell_is_validation_error_when_geography_is_readable(self):
        with self.assertRaises(ValidationError):
            Heatmap.get_report(object(), cell="outside")

    def test_visibility_failure_never_creates_a_zero_count_scale(self):
        self.report["sources"]["visibility"]["availability"] = "unavailable"
        for row in self.report["cells"]:
            row["profile_visits"] = None
        report = Heatmap.get_report(object())
        self.assertEqual(report["display_state"], "visibility_unavailable")
        self.assertIsNone(report["selection"]["profile_visits"])
        self.assertIsNone(report["legend"]["minimum"])
        self.assertIsNone(report["legend"]["maximum"])
        self.assertIsNone(report["legend"]["zero_range"])
        self.assertEqual(report["cells"][2]["state"], "no_businesses")

    def test_geographic_failure_preserves_null_cells_and_unknown_selection(self):
        self.report["cells"] = None
        report = Heatmap.get_report(object(), cell="one")
        self.assertIsNone(report["cells"])
        self.assertEqual(report["display_state"], "geography_unavailable")
        self.assertIsNone(report["selection"]["eligible_businesses"])
        self.assertIsNone(report["selection"]["returned_cells"])
        self.assertIsNone(report["legend"]["maximum"])

    def test_healthy_all_zero_scale_and_empty_population_do_not_divide_by_zero(self):
        for row in self.report["cells"]:
            row["profile_visits"] = 0
        report = Heatmap.get_report(object())
        self.assertEqual(report["display_state"], "zero_recorded_visits")
        self.assertEqual(report["legend"]["maximum"], 0)
        self.assertTrue(report["legend"]["zero_range"])
        for row in self.report["cells"]:
            row["eligible_businesses"] = 0
        self.assertEqual(Heatmap.get_report(object())["display_state"], "no_businesses")
