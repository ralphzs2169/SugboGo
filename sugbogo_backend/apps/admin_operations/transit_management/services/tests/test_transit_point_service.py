from apps.admin_operations.transit_management.services.tests import TransitBoundaryTestMixin
from unittest.mock import patch

from django.contrib.gis.geos import LineString, Point
from django.db.models.deletion import ProtectedError
from django.test import TestCase
from rest_framework.exceptions import NotFound, ValidationError

from apps.admin_operations.transit_management.services.transit_point_service import (
    TransitPointService,
)
from apps.transit.models import (
    JeepneyRoute,
    JeepneyRouteVariant,
    RouteTransitPoint,
    TransitPoint,
    TransitTransfer,
)


class TransitPointServiceTests(TransitBoundaryTestMixin, TestCase):
    """Test administrator Transit Point operations."""

    def test_transit_point_create_list_detail_and_update(self):
        """Manage Transit Points while preserving longitude/latitude order."""

        point = TransitPointService.create_transit_point(
            {
                "name": "Fuente",
                "longitude": 123.8958,
                "latitude": 10.3103,
            },
        )

        updated_point = TransitPointService.update_transit_point(
            point.TRPT_ID,
            {
                "name": "Fuente Osmena",
                "longitude": 123.8960,
                "latitude": 10.3105,
            },
        )

        self.assertTrue(
            TransitPointService.list_transit_points(
                search="Fuente",
            ).filter(
                TRPT_ID=point.TRPT_ID,
            ).exists(),
        )
        self.assertEqual(
            TransitPointService.get_transit_point(
                point.TRPT_ID,
            ).TRPT_ID,
            point.TRPT_ID,
        )
        self.assertEqual(
            updated_point.TRPT_POINT,
            Point(
                x=123.8960,
                y=10.3105,
                srid=4326,
            ),
        )

    def test_missing_transit_point_raises_not_found(self):
        """Raise a controlled error for an unknown Transit Point."""

        with self.assertRaises(NotFound):
            TransitPointService.get_transit_point(999999)

    def _point(self):
        """Create a point without invoking unrelated spatial validation."""

        return TransitPoint.objects.create(
            TRPT_NAME="Stop",
            TRPT_POINT=Point(123.9, 10.3, srid=4326),
        )

    def _direction(
        self,
        origin,
        destination,
    ):
        """Create a direction whose point-reference roles can be tested independently."""

        route = JeepneyRoute.objects.create(
            JRT_CODE=f"T{JeepneyRoute.objects.count()}",
        )
        return JeepneyRouteVariant.objects.create(
            JRT_ID=route,
            JRV_ORIGIN_ID=origin,
            JRV_DESTINATION_ID=destination,
            JRV_GEOMETRY=LineString(
                (123.89, 10.3),
                (123.91, 10.3),
                srid=4326,
            ),
        )

    def test_unused_point_can_be_deleted_and_missing_point_is_not_found(self):
        """Delete an eligible point and retain the established missing-point error."""

        point = self._point()
        point_id = point.pk
        dependencies = TransitPointService.get_deletion_dependencies(point)
        self.assertTrue(dependencies["can_delete"])
        self.assertTrue(all(value == 0 for value in dependencies["counts"].values()))

        TransitPointService.delete_transit_point(point_id)

        self.assertFalse(TransitPoint.objects.filter(pk=point_id).exists())
        with self.assertRaisesMessage(
            NotFound,
            "The Transit Point could not be found.",
        ):
            TransitPointService.delete_transit_point(point_id)

    def test_each_reference_role_blocks_deletion_without_changing_records(self):
        """Protect every foreign-key role, including transfers in every review status."""

        cases = [
            ("origin_directions", None),
            ("destination_directions", None),
            ("ordered_stops", None),
        ]
        cases.extend(
            (role, transfer_status)
            for role in ("alighting_transfers", "boarding_transfers")
            for transfer_status in TransitTransfer.TransferStatus.values
        )
        models = (
            TransitPoint,
            JeepneyRoute,
            JeepneyRouteVariant,
            RouteTransitPoint,
            TransitTransfer,
        )

        for role, transfer_status in cases:
            with self.subTest(role=role, transfer_status=transfer_status):
                point = self._point()
                origin = self._point()
                destination = self._point()
                if role == "origin_directions":
                    origin = point
                if role == "destination_directions":
                    destination = point
                direction = self._direction(origin, destination)
                if role == "ordered_stops":
                    RouteTransitPoint.objects.create(
                        JRV_ID=direction,
                        TRPT_ID=point,
                        RVTP_SEQUENCE=1,
                    )
                if transfer_status is not None:
                    other_direction = self._direction(origin, destination)
                    alighting = origin
                    boarding = destination
                    if role == "alighting_transfers":
                        alighting = point
                    else:
                        boarding = point
                    # Isolate transfer-only references, including legacy memberships.
                    TransitTransfer.objects.create(
                        TTFR_FROM_VARIANT_ID=direction,
                        TTFR_TO_VARIANT_ID=other_direction,
                        TTFR_FROM_TRANSIT_POINT_ID=alighting,
                        TTFR_TO_TRANSIT_POINT_ID=boarding,
                        TTFR_STATUS=transfer_status,
                    )
                before = {
                    model: list(model.objects.order_by("pk").values())
                    for model in models
                }

                with self.assertRaises(ValidationError) as caught:
                    TransitPointService.delete_transit_point(point.pk)

                dependencies = caught.exception.detail["deletion"]
                self.assertFalse(dependencies["can_delete"])
                self.assertEqual(dependencies["counts"][role], 1)
                self.assertEqual(
                    before,
                    {
                        model: list(model.objects.order_by("pk").values())
                        for model in models
                    },
                )

    def test_shared_point_totals_are_distinct_and_examples_are_bounded(self):
        """Count each direction, route and transfer once across overlapping roles."""

        point = self._point()
        destination = self._point()
        total = TransitPointService.DEPENDENCY_EXAMPLE_LIMIT + 2
        directions = []
        for index in range(total):
            direction = self._direction(point, destination)
            directions.append(direction)
            RouteTransitPoint.objects.create(
                JRV_ID=direction,
                TRPT_ID=point,
                RVTP_SEQUENCE=1,
            )
        for index, direction in enumerate(directions):
            TransitTransfer.objects.create(
                TTFR_FROM_VARIANT_ID=direction,
                TTFR_TO_VARIANT_ID=directions[(index + 1) % total],
                TTFR_FROM_TRANSIT_POINT_ID=point,
                TTFR_TO_TRANSIT_POINT_ID=point,
            )

        dependencies = TransitPointService.get_deletion_dependencies(point)

        for key in (
            "directions",
            "routes",
            "origin_directions",
            "ordered_stops",
            "transfers",
            "alighting_transfers",
            "boarding_transfers",
        ):
            self.assertEqual(dependencies["counts"][key], total)
        for examples in dependencies["examples"].values():
            self.assertEqual(len(examples), dependencies["example_limit"])
            self.assertEqual(len({item["id"] for item in examples}), len(examples))
        with self.assertRaises(ValidationError):
            TransitPointService.delete_transit_point(point.pk)

    def test_protection_failure_is_a_controlled_validation_error(self):
        """Translate the model protection fallback without deleting the target point."""

        point = self._point()
        with patch.object(
            TransitPoint,
            "delete",
            side_effect=ProtectedError("Referenced point", {point}),
        ):
            with self.assertRaises(ValidationError) as caught:
                TransitPointService.delete_transit_point(point.pk)

        self.assertFalse(caught.exception.detail["deletion"]["can_delete"])
        self.assertTrue(TransitPoint.objects.filter(pk=point.pk).exists())
