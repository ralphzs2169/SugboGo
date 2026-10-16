"""Fixed-grid identities and real PostGIS coordinate/geometry behavior."""

import json
from unittest.mock import patch

from django.contrib.gis.geos import MultiPolygon, Polygon
from django.db import DatabaseError
from django.test import SimpleTestCase, TestCase

from apps.admin_operations.analytics.services.geographic_grid_service import GeographicGridService as Grid, GeographyUnavailable


class GeographicGridIdentityTests(SimpleTestCase):
    def test_edges_corners_and_negative_coordinates_use_half_open_floor(self):
        for coords, expected in (
            ((0, 0), (0, 0)), ((999.999, 999.999), (0, 0)),
            ((1000, 1000), (1, 1)), ((-0.001, -1000), (-1, -1)),
            ((-1000.001, 0), (-2, 0)),
        ):
            with self.subTest(coords=coords):
                self.assertEqual(Grid.indices(*coords), expected)

    def test_identity_includes_resolution_crs_origin_and_edge_version(self):
        self.assertEqual(Grid.cell_id(596, 1139), "cebu-utm51n-1000m-origin0-floor-v1:596:1139")
        self.assertEqual(Grid.definition()["cell_size_metres"], 1000)
        self.assertEqual(Grid.definition()["projected_srid"], 32651)

    def test_nonfinite_projected_coordinates_are_unavailable(self):
        for x in (float("nan"), float("inf"), -float("inf")):
            with self.assertRaises(GeographyUnavailable):
                Grid.indices(x, 1000)


class GeographicGridPostGISTests(TestCase):
    def setUp(self):
        polygon = Polygon.from_bbox((123.87, 10.30, 123.90, 10.33))
        self.boundary = MultiPolygon(polygon, srid=4326)
        reference = json.dumps({"type": "MultiPolygon", "coordinates": [polygon.coords]})
        patcher = patch.object(Grid, "reference_geometry", return_value=(reference, "fixture-digest"))
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_real_transform_has_known_cebu_cell_and_valid_lon_lat_geometry(self):
        assignments = Grid.project_points([{"id": 1, "x": 123.88, "y": 10.31}])
        self.assertEqual(assignments, {1: (596, 1139)})
        cells, digest = Grid.cells(self.boundary)
        self.assertEqual(digest, "fixture-digest")
        ring = cells[assignments[1]]["geometry"]["coordinates"][0]
        self.assertEqual(len(ring), 5)
        self.assertEqual(ring[0], ring[-1])
        for longitude, latitude in ring:
            self.assertTrue(123 < longitude < 125)
            self.assertTrue(10 < latitude < 11)

    def test_order_and_batch_size_do_not_change_assignment(self):
        points = [{"id": 1, "x": 123.88, "y": 10.31}, {"id": 2, "x": 123.89, "y": 10.32}]
        expected = Grid.project_points(points)
        with patch.object(Grid, "BATCH_SIZE", 1):
            self.assertEqual(Grid.project_points(list(reversed(points))), expected)

    def test_more_than_one_batch_preserves_all_points_with_bounded_queries(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        points = [{"id": index, "x": 123.88, "y": 10.31} for index in range(1001)]
        with CaptureQueriesContext(connection) as queries:
            assignments = Grid.project_points(points)
        selects = [query for query in queries if query["sql"].lstrip().upper().startswith("SELECT")]
        self.assertEqual(len(selects), 2)
        self.assertEqual(len(assignments), 1001)
        self.assertEqual(set(assignments.values()), {(596, 1139)})

    def test_all_service_boundary_corners_receive_cells(self):
        cells, _ = Grid.cells(self.boundary)
        points = [{"id": index, "x": x, "y": y} for index, (x, y) in enumerate(self.boundary[0].coords[0])]
        self.assertTrue(all(indices in cells for indices in Grid.project_points(points).values()))

    def test_grid_limit_reports_failure_instead_of_truncation(self):
        with patch.object(Grid, "MAX_CELLS", 1), self.assertRaisesMessage(GeographyUnavailable, "cell_limit_exceeded"):
            Grid.cells(self.boundary)

    def test_different_boundary_is_not_accepted_by_city_name_or_psgc_alone(self):
        other = MultiPolygon(Polygon.from_bbox((123.88, 10.31, 123.89, 10.32)), srid=4326)
        with self.assertRaisesMessage(GeographyUnavailable, "boundary_reference_mismatch"):
            Grid.cells(other)

    def test_runtime_failure_is_controlled_and_transaction_remains_usable(self):
        with patch("apps.admin_operations.analytics.services.geographic_grid_service.connection.cursor", side_effect=DatabaseError()):
            with self.assertRaisesMessage(GeographyUnavailable, "spatial_runtime_unavailable"):
                Grid.cells(self.boundary)
        self.assertTrue(Grid.cells(self.boundary)[0])
