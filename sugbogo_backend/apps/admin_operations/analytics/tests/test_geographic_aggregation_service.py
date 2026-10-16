"""Geographic eligibility, reconciliation, source failure and current attribution."""

import json
from datetime import timedelta
from unittest.mock import patch

from django.contrib.gis.geos import MultiPolygon, Point, Polygon
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.db import connection
from rest_framework.exceptions import ValidationError

from apps.admin_operations.analytics.services.geographic_aggregation_service import GeographicAggregationService as Geography
from apps.admin_operations.analytics.services.geographic_grid_service import GeographicGridService as Grid, GeographyUnavailable
from apps.admin_operations.analytics.tests.test_business_attention_service import AttentionFixtures
from apps.business.models import Business, Location, ServiceableBoundary
from apps.business.services.tests.test_visibility_analytics_service import ReadOnlyCollection
from apps.business.services.visibility_event_service import VisibilityEventService, VisibilityTrackingUnavailable
from apps.shared.analytics.date_ranges import resolve_period


class GeographicAggregationServiceTests(AttentionFixtures, TestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.polygon = Polygon.from_bbox((123.87, 10.30, 123.90, 10.33))
        cls.boundary = ServiceableBoundary.objects.create(
            SBND_NAME="Cebu fixture", SBND_PSGC_CODE=Geography.PSGC_CODE,
            SBND_BOUNDARY=MultiPolygon(cls.polygon, srid=4326),
        )

    def setUp(self):
        reference = json.dumps({"type": "MultiPolygon", "coordinates": [self.polygon.coords]})
        patcher = patch.object(Grid, "reference_geometry", return_value=(reference, "fixture-digest"))
        patcher.start()
        self.addCleanup(patcher.stop)

    def report(self, period=None, **filters):
        with patch.object(VisibilityEventService, "get_business_attention_metrics", side_effect=self.mongo_metrics):
            return Geography.get_report(period or self.period, **filters)

    def move(self, business, x, y):
        location = Location.objects.create(LOCT_POINT=Point(x, y, srid=4326), LOCT_ADDRESS="Fixture")
        Business.objects.filter(pk=business.pk).update(LOCT_ID=location)

    def test_current_active_inventory_and_additive_visits_reconcile_with_empty_cells(self):
        report = self.report()
        totals = report["reconciliation"]
        self.assertEqual(totals["eligible_businesses"], 4)
        self.assertEqual(totals["assigned_businesses"], 4)
        self.assertEqual(totals["excluded_businesses"], 0)
        self.assertEqual(totals["inventory_profile_visits"], 10)
        self.assertEqual(totals["assigned_profile_visits"], 10)
        self.assertEqual(sum(cell["eligible_businesses"] for cell in report["cells"]), 4)
        self.assertEqual(sum(cell["profile_visits"] for cell in report["cells"]), 10)
        self.assertTrue(any(cell["eligible_businesses"] == 0 for cell in report["cells"]))
        self.assertTrue(report["empty_cells_included"])
        self.assertFalse(report["truncated"])

    def test_filters_validate_existing_taxonomy_and_do_not_change_grid(self):
        whole = self.report()
        filtered = self.report(category=self.category_a.pk)
        self.assertEqual(filtered["reconciliation"]["eligible_businesses"], 3)
        self.assertEqual(filtered["reconciliation"]["assigned_profile_visits"], 9)
        self.assertEqual([cell["id"] for cell in whole["cells"]], [cell["id"] for cell in filtered["cells"]])
        for filters in ({"cluster": 999999}, {"category": 999999},
                        {"cluster": self.cluster_a.pk, "category": self.category_b.pk}):
            with self.assertRaises(ValidationError):
                self.report(**filters)

    def test_empty_inventory_and_populated_zero_visit_cells_remain_distinguishable(self):
        empty = self.report(category=self.empty_category.pk)
        self.assertEqual(empty["reconciliation"]["assigned_businesses"], 0)
        self.assertTrue(all(cell["eligible_businesses"] == 0 for cell in empty["cells"]))
        for metric in self.metrics.values():
            metric["profile_visits"] = 0
        populated = self.report()
        self.assertTrue(any(cell["eligible_businesses"] > 0 and cell["profile_visits"] == 0 for cell in populated["cells"]))

    def test_outside_businesses_and_their_visits_are_reconciled(self):
        self.move(self.businesses[0], 123.95, 10.31)
        report = self.report()
        totals = report["reconciliation"]
        self.assertEqual(totals["assigned_businesses"], 3)
        self.assertEqual(totals["excluded_businesses"], 1)
        self.assertEqual(totals["excluded_by_reason"]["outside_scope"], {"businesses": 1, "profile_visits": 4})
        self.assertEqual(totals["assigned_profile_visits"] + totals["excluded_profile_visits"], 10)

    def test_outer_boundary_edges_and_overlapping_rows_do_not_duplicate(self):
        self.move(self.businesses[0], 123.87, 10.30)
        ServiceableBoundary.objects.create(
            SBND_NAME="Overlapping approved row", SBND_PSGC_CODE=Geography.PSGC_CODE,
            SBND_BOUNDARY=MultiPolygon(self.polygon, srid=4326),
        )
        self.assertEqual(self.report()["reconciliation"]["assigned_businesses"], 4)

    def test_other_city_active_boundary_does_not_expand_scope(self):
        ServiceableBoundary.objects.create(
            SBND_NAME="Other city", SBND_PSGC_CODE="other",
            SBND_BOUNDARY=MultiPolygon(Polygon.from_bbox((123, 9, 125, 11)), srid=4326),
        )
        self.move(self.businesses[0], 123.95, 10.31)
        self.assertEqual(self.report()["reconciliation"]["excluded_businesses"], 1)

    def test_inactive_boundary_yields_unavailable_geography_with_inventory_intact(self):
        ServiceableBoundary.objects.filter(pk=self.boundary.pk).update(SBND_IS_ACTIVE=False)
        report = self.report()
        self.assertIsNone(report["cells"])
        self.assertEqual(report["meta"]["availability"], "unavailable")
        self.assertEqual(report["reconciliation"]["eligible_businesses"], 4)
        self.assertEqual(report["reconciliation"]["inventory_profile_visits"], 10)
        self.assertIsNone(report["reconciliation"]["excluded_businesses"])

    def test_changed_scope_requires_reference_review(self):
        ServiceableBoundary.objects.filter(pk=self.boundary.pk).update(
            SBND_BOUNDARY=MultiPolygon(Polygon.from_bbox((123, 9, 125, 11)), srid=4326),
        )
        report = self.report()
        self.assertIsNone(report["cells"])
        self.assertIn("boundary_reference_mismatch", report["meta"]["partial_reasons"])

    def test_missing_and_invalid_boundary_are_unavailable(self):
        invalid = Polygon(((123.87, 10.30), (123.90, 10.33), (123.90, 10.30),
                           (123.87, 10.33), (123.87, 10.30)))
        for geometry in (MultiPolygon(invalid, srid=4326), MultiPolygon(srid=4326)):
            ServiceableBoundary.objects.filter(pk=self.boundary.pk).update(SBND_BOUNDARY=geometry)
            report = self.report()
            self.assertIsNone(report["cells"])
            self.assertIn("approved_boundary_invalid", report["meta"]["partial_reasons"])
        ServiceableBoundary.objects.all().delete()
        report = self.report()
        self.assertIsNone(report["cells"])
        self.assertIn("approved_boundary_missing", report["meta"]["partial_reasons"])

    def test_unusable_locations_remain_in_inventory_and_visit_reconciliation(self):
        self.move(self.businesses[0], 181, 10)
        self.move(self.businesses[1], float("nan"), 10)
        totals = self.report()["reconciliation"]
        self.assertEqual(totals["eligible_businesses"], 4)
        self.assertEqual(totals["assigned_businesses"], 2)
        self.assertEqual(totals["excluded_businesses"], 2)
        self.assertEqual(totals["excluded_by_reason"]["invalid_coordinates"], {"businesses": 2, "profile_visits": 9})
        self.assertEqual(totals["assigned_profile_visits"], 1)

    def test_visibility_failure_preserves_cell_population_and_uses_null_counts(self):
        with patch.object(VisibilityEventService, "get_business_attention_metrics", side_effect=VisibilityTrackingUnavailable()):
            report = Geography.get_report(self.period)
        self.assertEqual(sum(cell["eligible_businesses"] for cell in report["cells"]), 4)
        self.assertTrue(all(cell["profile_visits"] is None for cell in report["cells"]))
        self.assertIsNone(report["reconciliation"]["assigned_profile_visits"])
        self.assertEqual(report["sources"]["visibility"]["availability"], "unavailable")

    def test_transform_failure_is_unavailable_and_never_successful_empty(self):
        with patch.object(Grid, "project_points", side_effect=GeographyUnavailable("coordinate_transform_failed")):
            report = self.report()
        self.assertIsNone(report["cells"])
        self.assertIn("coordinate_transform_failed", report["meta"]["partial_reasons"])

    def test_missing_transform_assignment_cannot_silently_drop_inventory(self):
        with patch.object(Grid, "project_points", return_value={}):
            report = self.report()
        self.assertIsNone(report["cells"])
        self.assertIn("incomplete_coordinate_transform", report["meta"]["partial_reasons"])

    def test_location_quality_reasons_are_mutually_exclusive(self):
        boundary = self.boundary.SBND_BOUNDARY
        for point, expected in (
            (None, "missing_location"), (Point(srid=4326), "invalid_coordinates"),
            (Point(123.88, 10.31, srid=3857), "unsupported_srid"),
            (Point(181, 10, srid=4326), "invalid_coordinates"),
            (Point(float("nan"), 10, srid=4326), "invalid_coordinates"),
            (Point(123.88, 10.31, 5, srid=4326), "invalid_coordinates"),
            (Point(123.95, 10.31, srid=4326), "outside_scope"),
            (Point(123.87, 10.30, srid=4326), None),
        ):
            with self.subTest(expected=expected):
                self.assertEqual(Geography.location_reason(point, boundary), expected)

    def test_historical_attribution_moves_with_current_location_but_ids_stay_fixed(self):
        before = self.report()
        first = next(cell for cell in before["cells"] if cell["eligible_businesses"])
        self.move(self.businesses[0], 123.895, 10.325)
        after = self.report()
        old_cell = next(cell for cell in after["cells"] if cell["id"] == first["id"])
        self.assertEqual(old_cell["profile_visits"], 6)
        self.assertEqual(sum(cell["profile_visits"] for cell in after["cells"]), 10)
        self.assertTrue(after["attribution"]["historical_counts_can_move_with_business"])
        other_period = resolve_period(preset="7", now=self.NOW - timedelta(days=10))
        self.assertEqual([cell["id"] for cell in after["cells"]], [cell["id"] for cell in self.report(other_period)["cells"]])

    def test_real_visibility_helper_uses_whole_half_open_period_without_indexes_or_identity_leaks(self):
        business_id = self.businesses[0].pk
        documents = [
            {"event_type": "PROFILE_VISIT", "business_id": business_id, "explorer_id": 999, "occurred_at": when}
            for when in (self.period.start - timedelta(seconds=1), self.period.start,
                         self.period.start + timedelta(days=1), self.period.end)
        ]
        collection = ReadOnlyCollection(documents)
        with patch.object(VisibilityEventService, "_unavailable_until", 0), \
             patch.object(VisibilityEventService, "_get_collection", return_value=collection), \
             patch.object(VisibilityEventService, "ensure_indexes", side_effect=AssertionError("Index write")), \
             CaptureQueriesContext(connection) as queries:
            report = Geography.get_report(self.period)
        self.assertEqual(report["reconciliation"]["assigned_profile_visits"], 2)
        self.assertEqual(len(collection.calls), 1)
        self.assertFalse(any(query["sql"].lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE")) for query in queries))
        encoded = json.dumps(report)
        for forbidden in ("explorer_id", "business_id", "distinct_visitors", "distinct_savers", "USER_ID"):
            self.assertNotIn(f'"{forbidden}"', encoded)
        self.assertFalse(report["meta"]["coverage_verified"])
        selects = [query for query in queries if query["sql"].lstrip().upper().startswith(("SELECT", "WITH"))]
        self.assertEqual(len(selects), 5)
