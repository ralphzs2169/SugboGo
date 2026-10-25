"""Exercise stale authoring inputs while another administrator moves a stop."""

import threading

from django.contrib.gis.geos import MultiPolygon, Point, Polygon
from django.db import connection, transaction
from django.test import TransactionTestCase
from rest_framework.exceptions import ValidationError

from apps.admin_operations.transit_management.services.route_variant_service import RouteVariantService
from apps.admin_operations.transit_management.services.transit_point_service import TransitPointService
from apps.business.models import ServiceableBoundary
from apps.transit.models import JeepneyRoute, JeepneyRouteVariant, TransitPoint


class TransitSpatialConcurrencyTests(TransactionTestCase):
    """Keep route saves consistent with a concurrent shared-network location write."""

    def test_create_rechecks_stale_stop_after_concurrent_move_commits(self):
        ServiceableBoundary.objects.create(
            SBND_NAME="Cebu City", SBND_PSGC_CODE="072217000",
            SBND_BOUNDARY=MultiPolygon(Polygon.from_bbox((123, 10, 124, 11)), srid=4326),
        )
        points = [
            TransitPoint.objects.create(
                TRPT_NAME=name, TRPT_POINT=Point(longitude, 10.31, srid=4326),
            )
            for name, longitude in [("Start", 123.89), ("Middle", 123.9), ("End", 123.91)]
        ]
        route = JeepneyRoute.objects.create(JRT_CODE="06B")
        data = {
            "JRT_ID": route, "JRV_ORIGIN_ID": points[0], "JRV_DESTINATION_ID": points[-1],
            "ordered_transit_points": points,
            "geometry": [
                {"longitude": point.TRPT_POINT.x, "latitude": point.TRPT_POINT.y}
                for point in points
            ],
        }
        moved = threading.Event()
        release = threading.Event()
        saving = threading.Event()
        results = {}

        def move_stop():
            """Hold an uncommitted location change while the other save begins."""
            try:
                with transaction.atomic():
                    TransitPointService.update_transit_point(points[1].pk, {
                        "latitude": 10.32, "longitude": 123.9,
                    })
                    moved.set()
                    if not release.wait(10):
                        raise RuntimeError("Timed out waiting for concurrent save")
                results["move"] = "committed"
            except Exception as exc:
                results["move"] = exc
            finally:
                connection.close()

        def save_direction():
            """Submit the pre-move model instances as a real overlapping editor request."""
            try:
                saving.set()
                RouteVariantService.create_variant(data)
                results["save"] = "committed"
            except Exception as exc:
                results["save"] = exc
            finally:
                connection.close()

        writer = threading.Thread(target=move_stop)
        creator = threading.Thread(target=save_direction)
        writer.start()
        try:
            self.assertTrue(moved.wait(5), "Stop move failed before its synchronization point")
            creator.start()
            self.assertTrue(saving.wait(5), "Direction save did not start")
        finally:
            release.set()
            writer.join(15)
            if creator.ident is not None:
                creator.join(15)
        self.assertFalse(writer.is_alive())
        self.assertFalse(creator.is_alive())
        self.assertEqual(results.get("move"), "committed")
        self.assertIsInstance(results.get("save"), ValidationError)
        self.assertEqual(JeepneyRouteVariant.objects.count(), 0)
        points[1].refresh_from_db()
        self.assertEqual(points[1].TRPT_POINT.y, 10.32)
