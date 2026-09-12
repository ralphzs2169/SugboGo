from django.test import TestCase
from rest_framework.exceptions import NotFound

from apps.admin_operations.transit_management.services.jeepney_route_service import (
    JeepneyRouteService,
)
from apps.admin_operations.transit_management.services.route_variant_service import (
    RouteVariantService,
)
from apps.admin_operations.transit_management.services.transit_point_service import (
    TransitPointService,
)


class JeepneyRouteServiceTests(TestCase):
    """Test administrator jeepney-route operations."""

    def setUp(self):
        """Create routes and one directional variant."""

        kamputhaw = TransitPointService.create_transit_point(
            {
                "name": "Kamputhaw",
                "longitude": 123.8930,
                "latitude": 10.3150,
            },
        )
        colon = TransitPointService.create_transit_point(
            {
                "name": "Colon",
                "longitude": 123.9003,
                "latitude": 10.2940,
            },
        )

        self.route_14d = JeepneyRouteService.create_route(
            {
                "code": "14D",
            },
        )
        JeepneyRouteService.create_route(
            {
                "code": "08G",
            },
        )

        RouteVariantService.create_variant(
            {
                "JRT_ID": self.route_14d,
                "JRV_ORIGIN_ID": kamputhaw,
                "JRV_DESTINATION_ID": colon,
                "geometry": [
                    {
                        "longitude": kamputhaw.TRPT_POINT.x,
                        "latitude": kamputhaw.TRPT_POINT.y,
                    },
                    {
                        "longitude": colon.TRPT_POINT.x,
                        "latitude": colon.TRPT_POINT.y,
                    },
                ],
                "ordered_transit_points": [
                    kamputhaw,
                    colon,
                ],
            },
        )

    def test_route_create_list_detail_and_update(self):
        """Manage route codes and include variants in route detail."""

        routes = JeepneyRouteService.list_routes()
        route = JeepneyRouteService.get_route(
            self.route_14d.JRT_ID,
        )

        JeepneyRouteService.update_route(
            self.route_14d.JRT_ID,
            {
                "code": "14E",
            },
        )

        self.route_14d.refresh_from_db()

        self.assertEqual(
            routes.count(),
            2,
        )
        self.assertEqual(
            len(route.variants.all()),
            1,
        )
        self.assertEqual(
            self.route_14d.JRT_CODE,
            "14E",
        )

    def test_missing_route_raises_not_found(self):
        """Raise a controlled error for an unknown route."""

        with self.assertRaises(NotFound):
            JeepneyRouteService.get_route(999999)

