"""Exercise stale authoring inputs while another administrator moves a stop."""

import threading

from django.contrib.gis.geos import MultiPolygon, Point, Polygon
from django.db import connection, transaction
from django.test import TransactionTestCase
from rest_framework.exceptions import ValidationError

from apps.admin_operations.transit_management.services.route_variant_service import RouteVariantService
from apps.admin_operations.transit_management.services.transit_point_service import TransitPointService
from apps.admin_operations.transit_management.services.transit_transfer_service import (
    TransitTransferService,
)
from apps.admin_operations.transit_management.services.transfer_candidate_detection_service import (
    TransferCandidateDetectionService,
)
from apps.business.models import ServiceableBoundary
from apps.transit.models import (
    JeepneyRoute,
    JeepneyRouteVariant,
    RouteTransitPoint,
    TransitPoint,
    TransitTransfer,
)
from apps.transit.services.transit_spatial_validation_service import (
    TransitSpatialValidationService,
)


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


class TransitPointDeletionConcurrencyTests(TransactionTestCase):
    """Exercise deletion against the existing route, transfer and candidate writers."""

    def setUp(self):
        """Create only the synthetic boundary needed by direction updates."""

        ServiceableBoundary.objects.create(
            SBND_NAME="Cebu City",
            SBND_PSGC_CODE="072217000",
            SBND_BOUNDARY=MultiPolygon(
                Polygon.from_bbox((123, 10, 124, 11)),
                srid=4326,
            ),
        )

    def _network(self):
        """Create intersecting directions sharing a removable intermediate stop."""

        points = [
            TransitPointService.create_transit_point(
                {
                    "name": name,
                    "longitude": longitude,
                    "latitude": latitude,
                },
            )
            for name, longitude, latitude in (
                ("West", 123.89, 10.3),
                ("Crossing", 123.9, 10.3),
                ("East", 123.91, 10.3),
                ("South", 123.9, 10.29),
                ("North", 123.9, 10.31),
            )
        ]
        directions = []
        for ordered in (
            [points[0], points[1], points[2]],
            [points[3], points[1], points[4]],
        ):
            route = JeepneyRoute.objects.create(
                JRT_CODE=f"D{JeepneyRoute.objects.count()}",
            )
            directions.append(
                RouteVariantService.create_variant(
                    {
                        "JRT_ID": route,
                        "JRV_ORIGIN_ID": ordered[0],
                        "JRV_DESTINATION_ID": ordered[-1],
                        "ordered_transit_points": ordered,
                        "geometry": [
                            {
                                "longitude": point.TRPT_POINT.x,
                                "latitude": point.TRPT_POINT.y,
                            }
                            for point in ordered
                        ],
                    },
                ),
            )
        return points, directions

    def _overlap(
        self,
        first_operation,
        second_operation,
    ):
        """Hold the first transaction until the second reaches the real advisory lock."""

        first_ready = threading.Event()
        second_waiting = threading.Event()
        release = threading.Event()
        results = {}

        def first_writer():
            """Keep the first writer's lock and database changes uncommitted."""

            try:
                with transaction.atomic():
                    results["first"] = first_operation()
                    first_ready.set()
                    if not release.wait(10):
                        raise RuntimeError("Timed out waiting for overlapping reference write")
            except Exception as exc:
                results["first"] = exc
            finally:
                connection.close()

        def second_writer():
            """Signal lock entry without replacing the database's blocking behavior."""

            def observe_lock(
                execute,
                sql,
                params,
                many,
                context,
            ):
                """Observe the existing network lock before allowing PostgreSQL to execute it."""

                if "pg_advisory_xact_lock" in sql:
                    second_waiting.set()
                return execute(sql, params, many, context)

            try:
                with connection.execute_wrapper(observe_lock):
                    results["second"] = second_operation()
            except Exception as exc:
                results["second"] = exc
            finally:
                connection.close()

        first_thread = threading.Thread(target=first_writer)
        second_thread = threading.Thread(target=second_writer)
        first_thread.start()
        try:
            self.assertTrue(first_ready.wait(5), results)
            second_thread.start()
            self.assertTrue(second_waiting.wait(5), results)
        finally:
            release.set()
            first_thread.join(15)
            if second_thread.ident is not None:
                second_thread.join(15)
        self.assertFalse(first_thread.is_alive())
        self.assertFalse(second_thread.is_alive())
        self.assertNotIsInstance(results["first"], Exception)
        return results["second"]

    def test_reference_writers_recheck_after_concurrent_detachment_and_deletion(self):
        """Reject stale route and transfer references and scan candidates after deletion commits."""

        for operation in (
            "route_create",
            "route_update",
            "transfer_create",
            "transfer_update",
            "candidates",
        ):
            with self.subTest(operation=operation):
                network = self._network()
                points = network[0]
                directions = network[1]
                point = points[1]
                point_id = point.pk
                source = directions[0]
                destination = directions[1]
                route_data = {
                    "JRT_ID": source.JRT_ID,
                    "JRV_ORIGIN_ID": points[0],
                    "JRV_DESTINATION_ID": points[2],
                    "ordered_transit_points": points[:3],
                    "geometry": [
                        {
                            "longitude": item.TRPT_POINT.x,
                            "latitude": item.TRPT_POINT.y,
                        }
                        for item in points[:3]
                    ],
                }
                transfer_data = {
                    "TTFR_FROM_VARIANT_ID": source,
                    "TTFR_TO_VARIANT_ID": destination,
                    "TTFR_FROM_TRANSIT_POINT_ID": point,
                    "TTFR_TO_TRANSIT_POINT_ID": point,
                }
                existing_transfer = TransitTransferService.create_transfer(
                    {
                        **transfer_data,
                        "TTFR_FROM_TRANSIT_POINT_ID": points[0],
                        "TTFR_TO_TRANSIT_POINT_ID": points[3],
                    },
                )
                transfer_count = TransitTransfer.objects.count()

                def detach_and_delete():
                    """Detach the shared stop and delete it in the same transaction."""

                    TransitSpatialValidationService.lock_network()
                    for direction in directions:
                        RouteVariantService.update_variant(
                            direction.pk,
                            {
                                "ordered_transit_points": [
                                    direction.JRV_ORIGIN_ID,
                                    direction.JRV_DESTINATION_ID,
                                ],
                            },
                        )
                    TransitPointService.delete_transit_point(point_id)

                def write_reference():
                    """Submit relationships captured before the concurrent deletion."""

                    if operation == "route_create":
                        return RouteVariantService.create_variant(route_data)
                    if operation == "route_update":
                        return RouteVariantService.update_variant(
                            source.pk,
                            route_data,
                        )
                    if operation == "transfer_create":
                        return TransitTransferService.create_transfer(transfer_data)
                    if operation == "transfer_update":
                        return TransitTransferService.update_transfer(
                            existing_transfer.pk,
                            transfer_data,
                        )
                    return TransferCandidateDetectionService.detect_candidates()

                result = self._overlap(detach_and_delete, write_reference)

                if operation == "candidates":
                    self.assertIsInstance(result, dict)
                    self.assertEqual(
                        TransitTransfer.objects.count(),
                        transfer_count + result["candidates_created"],
                    )
                else:
                    self.assertIsInstance(result, ValidationError)
                    self.assertIn("no longer exists", str(result))
                    self.assertEqual(
                        TransitTransfer.objects.count(),
                        transfer_count,
                    )
                self.assertFalse(TransitPoint.objects.filter(pk=point_id).exists())
                self.assertFalse(
                    RouteTransitPoint.objects.filter(TRPT_ID=point_id).exists(),
                )
                self.assertFalse(
                    TransitTransfer.objects.filter(
                        TTFR_FROM_TRANSIT_POINT_ID=point_id,
                    ).exists(),
                )
                self.assertFalse(
                    TransitTransfer.objects.filter(
                        TTFR_TO_TRANSIT_POINT_ID=point_id,
                    ).exists(),
                )
                existing_transfer.refresh_from_db()
                self.assertEqual(
                    existing_transfer.TTFR_FROM_TRANSIT_POINT_ID_id,
                    points[0].pk,
                )
                self.assertEqual(
                    existing_transfer.TTFR_TO_TRANSIT_POINT_ID_id,
                    points[3].pk,
                )

    def test_deletion_waits_for_candidate_persistence_and_rechecks_dependencies(self):
        """Keep a shared stop and its newly committed candidates when deletion loses the lock."""

        network = self._network()
        points = network[0]
        directions = network[1]
        point_id = points[1].pk

        def delete_point():
            """Attempt deletion while candidate writes are still uncommitted."""

            return TransitPointService.delete_transit_point(point_id)

        result = self._overlap(
            TransferCandidateDetectionService.detect_candidates,
            delete_point,
        )

        self.assertIsInstance(result, ValidationError)
        self.assertEqual(result.detail["deletion"]["counts"]["directions"], 2)
        self.assertEqual(result.detail["deletion"]["counts"]["transfers"], 2)
        self.assertTrue(TransitPoint.objects.filter(pk=point_id).exists())
        self.assertEqual(JeepneyRouteVariant.objects.count(), len(directions))
        self.assertEqual(RouteTransitPoint.objects.count(), 6)
        self.assertEqual(TransitTransfer.objects.count(), 2)
