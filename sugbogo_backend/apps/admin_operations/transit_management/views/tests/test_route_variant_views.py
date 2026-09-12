from rest_framework import status
from rest_framework.test import APITestCase

from apps.admin_operations.transit_management.views.tests import (
    TransitManagementViewTestMixin,
)
from apps.transit.models import JeepneyRoute, RouteTransitPoint


class RouteVariantViewTests(
    TransitManagementViewTestMixin,
    APITestCase,
):
    """Test protected administrator route-variant APIs."""

    def test_variant_create_converts_geometry_and_orders_points(self):
        """Create a variant from coordinate objects and ordered point IDs."""

        route = JeepneyRoute.objects.create(
            JRT_CODE="04L",
        )
        payload = self._variant_payload(
            route,
            self.colon,
            self.kamputhaw,
            [
                self.colon,
                self.capitol,
                self.kamputhaw,
            ],
        )

        response = self.client.post(
            "/api/admin/transit/route-variants/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )
        self.assertEqual(
            response.data["data"]["geometry"],
            payload["geometry"],
        )
        self.assertEqual(
            [
                route_point["transit_point"]["id"]
                for route_point in response.data["data"]["transit_points"]
            ],
            payload["transit_point_ids"],
        )

    def test_variant_geometry_and_ordered_points_can_be_replaced(self):
        """Update route geometry and replace its ordered point sequence."""

        payload = {
            "geometry": [
                {
                    "longitude": 123.8930,
                    "latitude": 10.3150,
                },
                {
                    "longitude": 123.8950,
                    "latitude": 10.3050,
                },
                {
                    "longitude": 123.9003,
                    "latitude": 10.2940,
                },
            ],
            "transit_point_ids": [
                self.kamputhaw.TRPT_ID,
                self.colon.TRPT_ID,
            ],
        }

        response = self.client.patch(
            (
                "/api/admin/transit/route-variants/"
                f"{self.variant_14d.JRV_ID}/"
            ),
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            len(response.data["data"]["geometry"]),
            3,
        )
        self.assertEqual(
            RouteTransitPoint.objects.filter(
                JRV_ID=self.variant_14d,
            ).count(),
            2,
        )

    def test_variant_rejects_origin_mismatch(self):
        """Reject an ordered list whose first point differs from origin."""

        route = JeepneyRoute.objects.create(
            JRT_CODE="04L",
        )
        payload = self._variant_payload(
            route,
            self.kamputhaw,
            self.colon,
            [
                self.capitol,
                self.colon,
            ],
        )

        response = self.client.post(
            "/api/admin/transit/route-variants/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_variant_rejects_destination_mismatch(self):
        """Reject an ordered list whose last point differs from destination."""

        route = JeepneyRoute.objects.create(
            JRT_CODE="04L",
        )
        payload = self._variant_payload(
            route,
            self.kamputhaw,
            self.colon,
            [
                self.kamputhaw,
                self.capitol,
            ],
        )

        response = self.client.post(
            "/api/admin/transit/route-variants/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_variant_rejects_duplicate_transit_points(self):
        """Reject duplicate Transit Point IDs in one ordered sequence."""

        route = JeepneyRoute.objects.create(
            JRT_CODE="04L",
        )
        payload = self._variant_payload(
            route,
            self.kamputhaw,
            self.colon,
            [
                self.kamputhaw,
                self.capitol,
                self.capitol,
                self.colon,
            ],
        )

        response = self.client.post(
            "/api/admin/transit/route-variants/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_variant_requires_at_least_two_transit_points(self):
        """Reject a route variant with fewer than two ordered points."""

        route = JeepneyRoute.objects.create(
            JRT_CODE="04L",
        )
        payload = self._variant_payload(
            route,
            self.kamputhaw,
            self.colon,
            [
                self.kamputhaw,
            ],
        )

        response = self.client.post(
            "/api/admin/transit/route-variants/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_variant_rejects_unknown_transit_point(self):
        """Reject an ordered sequence containing an unknown point ID."""

        route = JeepneyRoute.objects.create(
            JRT_CODE="04L",
        )
        payload = self._variant_payload(
            route,
            self.kamputhaw,
            self.colon,
            [
                self.kamputhaw,
                self.colon,
            ],
        )
        payload["transit_point_ids"][1] = 999999

        response = self.client.post(
            "/api/admin/transit/route-variants/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
