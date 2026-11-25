"""Regression tests for the exact journey ride SQL and request-local reuse."""

from math import inf, nextafter
from unittest.mock import patch

from django.contrib.gis.geos import LineString, Point
from django.db import OperationalError, connection
from django.test import TestCase

from apps.transit.services import coordinate_journey_service as journey_service
from apps.transit.services.coordinate_ride_measurement_service import measure_journey_rides
from apps.transit.services.coordinate_route_matching_service import (
    CoordinateRouteMatchingService,
    RouteEndpointPosition,
    RoutePosition,
)
from apps.transit.services.route_connection_service import RouteConnection, TransferValidationStatus


class CoordinateRideMeasurementTests(TestCase):
    """Compare bounded measurement with the original spatial query."""

    def setUp(self):
        """Use two ordered lines and explicit projections for repeated ride keys."""
        self.routes = {
            1: LineString((123.900, 10.310), (123.910, 10.310), srid=4326),
            2: LineString(
                (123.903, 10.310),
                (123.903, 10.314),
                (123.910, 10.320),
                srid=4326,
            ),
        }
        origin = self.position(1, 0.1)
        self.positions = [
            RouteEndpointPosition(1, True, origin, 0.0),
            RouteEndpointPosition(1, False, self.position(1, 0.11), 0.0),
            RouteEndpointPosition(1, False, self.position(1, 0.4), 0.0),
            RouteEndpointPosition(2, False, self.position(2, 0.9), 0.0),
        ]
        self.links = [
            RouteConnection(
                from_variant_id=1,
                to_variant_id=2,
                alighting_position=self.position(1, alighting),
                boarding_position=self.position(2, boarding),
                straight_line_distance_meters=50,
                validation_status=TransferValidationStatus.PROVISIONAL,
            )
            for alighting, boarding in ((0.11, 0.0), (0.4, 0.0), (0.4, 0.3))
        ]

    def position(
        self,
        variant,
        fraction,
    ):
        """Interpolate a fixture point without changing its exact fraction."""
        return RoutePosition(self.routes[variant].interpolate_normalized(fraction), fraction)

    def search(self, progress):
        """Run the real journey engine with controlled endpoint projections."""
        with patch.object(
            CoordinateRouteMatchingService,
            "find_endpoint_positions",
            return_value=self.positions,
        ):
            return journey_service.CoordinateJourneyService.search(
                origin=self.positions[0].position.point,
                destination=Point(123.909, 10.319, srid=4326),
                route_geometries=self.routes,
                route_codes={1: "A", 2: "B"},
                connections=self.links,
                allow_provisional_transfers=True,
                progress=progress,
            )

    def test_distance_geometry_and_threshold_match_original_query(self):
        short = (1, 0.0, 0.022)
        long = (1, 0.0, 0.024)
        curved = (2, 0.1, 0.95)
        reverse = (2, 0.95, 0.1)
        collapsed = (2, 0.4, 0.4)
        keys = [short, long, long, curved, reverse, collapsed]
        for threshold in (1.0, 25.0):
            with self.subTest(threshold=threshold):
                arguments = {
                    "route_geometries": self.routes,
                    "rides": keys,
                    "minimum_ride_distance_meters": threshold,
                }
                expected = CoordinateRouteMatchingService.measure_rides(**arguments)
                with self.assertNumQueries(1):
                    actual = measure_journey_rides(**arguments)
                self.assertEqual(actual, expected)
        self.assertEqual(set(actual), {long, curved})
        exact = actual[long][1]
        for threshold, eligible in ((exact, True), (nextafter(exact, inf), False)):
            with self.subTest(threshold=threshold):
                result = measure_journey_rides(
                    route_geometries=self.routes,
                    rides=[long],
                    minimum_ride_distance_meters=threshold,
                )
                self.assertEqual(long in result, eligible)

    def test_reuses_accepted_and_short_rides_across_stages(self):
        with patch.object(journey_service, "measure_journey_rides", wraps=measure_journey_rides) as measure:
            journeys = self.search(journey_service.CoordinateJourneySearchProgress())
        self.assertEqual(
            [call.kwargs["rides"] for call in measure.call_args_list],
            [
                ((1, 0.1, 0.11), (1, 0.1, 0.4)),
                ((2, 0.0, 0.9), (2, 0.3, 0.9)),
            ],
        )
        self.assertEqual([journey.transfer_count for journey in journeys], [0, 1, 1])

    def test_cancelled_batch_preserves_completed_rides_and_outer_transaction(self):
        def measure(**kwargs):
            if kwargs["rides"] == ((2, 0.3, 0.9),):
                with connection.cursor() as cursor:
                    cursor.execute("SET LOCAL statement_timeout = '1ms'")
                    cursor.execute("SELECT pg_sleep(0.05)")
            return measure_journey_rides(**kwargs)

        progress = journey_service.CoordinateJourneySearchProgress()
        with (
            patch.object(journey_service, "RIDE_MEASUREMENT_BATCH_SIZE", 1),
            patch.object(journey_service, "measure_journey_rides", side_effect=measure),
        ):
            journeys = self.search(progress)
            with self.assertRaises(OperationalError):
                self.search(None)

        self.assertTrue(progress.ride_measurement_cancelled)
        self.assertEqual(progress.incomplete_reason, "candidate_budget")
        self.assertEqual([journey.transfer_count for journey in journeys], [0, 1])
        with connection.cursor() as cursor:
            cursor.execute("SELECT 42")
            self.assertEqual(cursor.fetchone(), (42,))

    def test_unrelated_measurement_error_propagates(self):
        with patch.object(
            journey_service,
            "measure_journey_rides",
            side_effect=OperationalError("Synthetic connection failure"),
        ):
            with self.assertRaisesMessage(OperationalError, "Synthetic connection failure"):
                self.search(journey_service.CoordinateJourneySearchProgress())
