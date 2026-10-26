"""Verify reference consumers can traverse stable bounded API pages."""

from django.contrib.gis.geos import LineString, Point
from rest_framework.test import APITestCase

from apps.admin_operations.transit_management.views.tests import TransitManagementViewTestMixin
from apps.transit.models import JeepneyRoute, JeepneyRouteVariant, RouteTransitPoint, TransitPoint


class TransitReferencePaginationTests(TransitManagementViewTestMixin, APITestCase):
    """Exercise real API pages larger than the editor's former one-page limit."""

    def test_stops_with_equal_names_are_stable_across_pages_and_keep_server_cap(self):
        TransitPoint.objects.bulk_create([
            TransitPoint(TRPT_NAME="Duplicate test stop", TRPT_POINT=Point(123.9, 10.31, srid=4326))
            for _ in range(121)
        ])
        expected = list(
            TransitPoint.objects.filter(TRPT_NAME="Duplicate test stop")
            .order_by("TRPT_ID").values_list("TRPT_ID", flat=True),
        )
        first = self.client.get("/api/admin/transit/transit-points/", {
            "page": 1, "page_size": 10000, "search": "Duplicate test stop",
        })
        second = self.client.get("/api/admin/transit/transit-points/", {
            "page": 2, "page_size": 100, "search": "Duplicate test stop",
        })
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.data["data"]["pagination"]["page_size"], 100)
        self.assertTrue(first.data["data"]["pagination"]["has_next"])
        self.assertFalse(second.data["data"]["pagination"]["has_next"])
        actual = [item["id"] for item in first.data["data"]["items"] + second.data["data"]["items"]]
        self.assertEqual(actual, expected)

    def test_directions_beyond_100_keep_complete_geometry_and_stop_memberships(self):
        for index in range(101):
            variant = JeepneyRouteVariant.objects.create(
                JRT_ID=JeepneyRoute.objects.create(JRT_CODE=f"TEST{index:03}"),
                JRV_ORIGIN_ID=self.kamputhaw,
                JRV_DESTINATION_ID=self.colon,
                JRV_GEOMETRY=LineString(self.kamputhaw.TRPT_POINT.coords, self.colon.TRPT_POINT.coords, srid=4326),
            )
            RouteTransitPoint.objects.bulk_create([
                RouteTransitPoint(JRV_ID=variant, TRPT_ID=point, RVTP_SEQUENCE=sequence)
                for sequence, point in enumerate([self.kamputhaw, self.colon], start=1)
            ])
        first = self.client.get("/api/admin/transit/route-variants/", {"page": 1, "page_size": 100})
        second = self.client.get("/api/admin/transit/route-variants/", {"page": 2, "page_size": 100})
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        items = first.data["data"]["items"] + second.data["data"]["items"]
        self.assertEqual(len(items), 103)
        self.assertEqual(len({item["id"] for item in items}), 103)
        self.assertEqual(first.data["data"]["pagination"]["total_pages"], 2)
        for item in items:
            self.assertGreaterEqual(len(item["geometry"]), 2)
            self.assertGreaterEqual(len(item["transit_points"]), 2)
