from unittest.mock import patch

from django.test import TestCase
from rest_framework.exceptions import NotFound, ValidationError

from apps.admin_operations.transit_management.services.jeepney_route_service import (
    JeepneyRouteService,
)
from apps.admin_operations.transit_management.services.route_variant_service import (
    RouteVariantService,
)
from apps.admin_operations.transit_management.services.transit_point_service import (
    TransitPointService,
)
from apps.transit.models import JeepneyRouteVariant


class RouteVariantServiceTests(TestCase):
    """Test coordinated route-variant persistence operations."""

    def setUp(self):
        """Create a route, points, and one directional variant."""

        self.kamputhaw = self._create_point(
            "Kamputhaw",
            123.8930,
            10.3150,
        )
        self.capitol = self._create_point(
            "Capitol",
            123.8908,
            10.3173,
        )
        self.colon = self._create_point(
            "Colon",
            123.9003,
            10.2940,
        )
        self.route_14d = JeepneyRouteService.create_route(
            {
                "code": "14D",
            },
        )
        self.variant_14d = RouteVariantService.create_variant(
            {
                "JRT_ID": self.route_14d,
                "JRV_ORIGIN_ID": self.kamputhaw,
                "JRV_DESTINATION_ID": self.colon,
                "geometry": [
                    {
                        "longitude": self.kamputhaw.TRPT_POINT.x,
                        "latitude": self.kamputhaw.TRPT_POINT.y,
                    },
                    {
                        "longitude": self.colon.TRPT_POINT.x,
                        "latitude": self.colon.TRPT_POINT.y,
                    },
                ],
                "ordered_transit_points": [
                    self.kamputhaw,
                    self.capitol,
                    self.colon,
                ],
            },
        )

    def _create_point(
        self,
        name,
        longitude,
        latitude,
    ):
        """Create a managed point through its service boundary."""

        return TransitPointService.create_transit_point(
            {
                "name": name,
                "longitude": longitude,
                "latitude": latitude,
            },
        )

    def test_variant_creation_persists_linestring_and_ordered_points(self):
        """Persist geometry and route-point order as one write."""

        self.assertEqual(
            self.variant_14d.JRV_GEOMETRY.geom_type,
            "LineString",
        )
        self.assertEqual(
            self.variant_14d.JRV_GEOMETRY.srid,
            4326,
        )
        self.assertEqual(
            list(
                self.variant_14d.route_transit_points.values_list(
                    "TRPT_ID_id",
                    flat=True,
                )
            ),
            [
                self.kamputhaw.TRPT_ID,
                self.capitol.TRPT_ID,
                self.colon.TRPT_ID,
            ],
        )

    def test_variant_update_replaces_geometry_and_ordered_points(self):
        """Replace geometry and route-point order coherently."""

        RouteVariantService.update_variant(
            self.variant_14d.JRV_ID,
            {
                "geometry": [
                    {
                        "longitude": 123.8930,
                        "latitude": 10.3150,
                    },
                    {
                        "longitude": 123.8958,
                        "latitude": 10.3103,
                    },
                    {
                        "longitude": 123.9003,
                        "latitude": 10.2940,
                    },
                ],
                "ordered_transit_points": [
                    self.kamputhaw,
                    self.colon,
                ],
            },
        )

        self.variant_14d.refresh_from_db()

        self.assertEqual(
            len(self.variant_14d.JRV_GEOMETRY.coords),
            3,
        )
        self.assertEqual(
            self.variant_14d.route_transit_points.count(),
            2,
        )

    def test_variant_service_rejects_origin_mismatch(self):
        """Reject an ordered sequence whose first point is not the origin."""

        with self.assertRaises(ValidationError):
            RouteVariantService.update_variant(
                self.variant_14d.JRV_ID,
                {
                    "ordered_transit_points": [
                        self.capitol,
                        self.colon,
                    ],
                },
            )

    def test_variant_service_rejects_destination_mismatch(self):
        """Reject an ordered sequence whose last point is not the destination."""

        with self.assertRaises(ValidationError):
            RouteVariantService.update_variant(
                self.variant_14d.JRV_ID,
                {
                    "ordered_transit_points": [
                        self.kamputhaw,
                        self.capitol,
                    ],
                },
            )

    def test_variant_service_rejects_duplicate_points(self):
        """Reject duplicate points before replacing persisted order."""

        with self.assertRaises(ValidationError):
            RouteVariantService.update_variant(
                self.variant_14d.JRV_ID,
                {
                    "ordered_transit_points": [
                        self.kamputhaw,
                        self.capitol,
                        self.capitol,
                        self.colon,
                    ],
                },
            )

    def test_variant_update_rolls_back_after_coordinated_write_failure(self):
        """Roll back geometry changes when ordered-point replacement fails."""

        original_geometry = self.variant_14d.JRV_GEOMETRY.clone()

        with patch.object(
            RouteVariantService,
            "_replace_ordered_points",
            side_effect=RuntimeError("Persistence failure"),
        ):
            with self.assertRaises(RuntimeError):
                RouteVariantService.update_variant(
                    self.variant_14d.JRV_ID,
                    {
                        "geometry": [
                            {
                                "longitude": 123.8930,
                                "latitude": 10.3150,
                            },
                            {
                                "longitude": 123.9000,
                                "latitude": 10.3000,
                            },
                            {
                                "longitude": 123.9003,
                                "latitude": 10.2940,
                            },
                        ],
                        "ordered_transit_points": [
                            self.kamputhaw,
                            self.colon,
                        ],
                    },
                )

        self.variant_14d.refresh_from_db()

        self.assertEqual(
            self.variant_14d.JRV_GEOMETRY,
            original_geometry,
        )
        self.assertEqual(
            self.variant_14d.route_transit_points.count(),
            3,
        )

    def test_missing_variant_raises_not_found(self):
        """Raise a controlled error for an unknown route variant."""

        with self.assertRaises(NotFound):
            RouteVariantService.get_variant(999999)

        self.assertEqual(
            JeepneyRouteVariant.objects.count(),
            1,
        )
