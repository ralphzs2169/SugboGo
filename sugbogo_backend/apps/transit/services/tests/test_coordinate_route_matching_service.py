from django.contrib.gis.geos import GEOSGeometry, LineString, Point
from django.test import TestCase
from rest_framework.exceptions import ValidationError

from apps.transit.models import JeepneyRoute, JeepneyRouteVariant, RouteTransitPoint, TransitPoint
from apps.transit.services.coordinate_route_matching_service import CoordinateRouteMatchingService


class CoordinateRouteMatchingServiceTests(TestCase):
    def setUp(self):
        self.straight = LineString(
            (123.900, 10.310),
            (123.910, 10.310),
            srid=4326,
        )
        self.origin = Point(123.902, 10.310, srid=4326)
        self.destination = Point(123.908, 10.310, srid=4326)

    def test_straight_match_returns_fraction_substring_and_meter_distances(self):
        origin = Point(123.902, 10.3102, srid=4326)
        destination = Point(123.908, 10.3097, srid=4326)

        with self.assertNumQueries(1):
            (match,) = CoordinateRouteMatchingService.match_routes(
                origin=origin,
                destination=destination,
                route_geometries={42: self.straight},
            )

        self.assertEqual(match.variant_id, 42)
        self.assertAlmostEqual(match.boarding_position.fraction, 0.2)
        self.assertAlmostEqual(match.alighting_position.fraction, 0.8)
        self.assertAlmostEqual(match.boarding_position.point.x, origin.x)
        self.assertAlmostEqual(match.alighting_position.point.x, destination.x)
        self.assertAlmostEqual(match.boarding_position.point.y, 10.310)
        self.assertAlmostEqual(match.alighting_position.point.y, 10.310)
        self.assertEqual(match.ride_geometry.srid, 4326)
        self.assertEqual(match.ride_geometry.coords, (
            match.boarding_position.point.coords,
            match.alighting_position.point.coords,
        ))
        self.assertAlmostEqual(match.access_distance_meters, 22.1, delta=0.2)
        self.assertAlmostEqual(match.ride_distance_meters, 657, delta=2)
        self.assertAlmostEqual(match.egress_distance_meters, 33.2, delta=0.2)

    def test_curved_route_preserves_intermediate_vertex_and_travel_order(self):
        curve = LineString(
            (123.900, 10.310),
            (123.905, 10.310),
            (123.905, 10.315),
            srid=4326,
        )
        destination = Point(123.905, 10.313, srid=4326)

        (match,) = CoordinateRouteMatchingService.match_routes(
            origin=self.origin,
            destination=destination,
            route_geometries={1: curve},
        )

        self.assertAlmostEqual(match.boarding_position.fraction, 0.2)
        self.assertAlmostEqual(match.alighting_position.fraction, 0.8)
        self.assertEqual(match.ride_geometry.coords, (
            match.boarding_position.point.coords,
            (123.905, 10.310),
            match.alighting_position.point.coords,
        ))
        self.assertAlmostEqual(match.ride_distance_meters, 660, delta=3)

    def test_reverse_request_only_matches_geometry_stored_in_that_direction(self):
        forward = LineString(
            self.straight.coords[0],
            (123.905, 10.310),
            self.straight.coords[1],
            srid=4326,
        )
        reverse = LineString(
            tuple(reversed(forward.coords)),
            srid=4326,
        )

        no_matches = CoordinateRouteMatchingService.match_routes(
            origin=self.destination,
            destination=self.origin,
            route_geometries={1: forward},
        )
        matches = CoordinateRouteMatchingService.match_routes(
            origin=self.destination,
            destination=self.origin,
            route_geometries={1: forward, 2: reverse},
        )

        self.assertEqual(no_matches, [])
        self.assertEqual([match.variant_id for match in matches], [2])
        (match,) = matches
        self.assertAlmostEqual(match.ride_geometry.coords[0][0], self.destination.x)
        self.assertAlmostEqual(match.ride_geometry.coords[-1][0], self.origin.x)

    def test_stored_variant_matches_before_and_after_terminal_memberships_exist(self):
        route = JeepneyRoute.objects.create(JRT_CODE="TEST")
        start = TransitPoint.objects.create(
            TRPT_NAME="Synthetic start",
            TRPT_POINT=Point(*self.straight.coords[0], srid=4326),
        )
        end = TransitPoint.objects.create(
            TRPT_NAME="Synthetic end",
            TRPT_POINT=Point(*self.straight.coords[-1], srid=4326),
        )
        variant = JeepneyRouteVariant.objects.create(
            JRT_ID=route,
            JRV_ORIGIN_ID=start,
            JRV_DESTINATION_ID=end,
            JRV_GEOMETRY=self.straight,
        )
        geometries = {variant.pk: variant.JRV_GEOMETRY}
        without_memberships = CoordinateRouteMatchingService.match_routes(
            origin=self.origin,
            destination=self.destination,
            route_geometries=geometries,
        )

        RouteTransitPoint.objects.create(
            JRV_ID=variant,
            TRPT_ID=start,
            RVTP_SEQUENCE=1,
        )
        RouteTransitPoint.objects.create(
            JRV_ID=variant,
            TRPT_ID=end,
            RVTP_SEQUENCE=2,
        )
        with_memberships = CoordinateRouteMatchingService.match_routes(
            origin=self.origin,
            destination=self.destination,
            route_geometries=geometries,
        )

        (match,) = without_memberships
        self.assertEqual(with_memberships, without_memberships)
        self.assertAlmostEqual(match.boarding_position.point.x, self.origin.x)
        self.assertAlmostEqual(match.alighting_position.point.x, self.destination.x)
        self.assertGreater(match.boarding_position.fraction, 0)
        self.assertLess(match.alighting_position.fraction, 1)

    def test_rejects_collapsed_and_short_rides_with_configurable_minimum(self):
        nearby_destination = Point(123.9021, 10.310, srid=4326)
        geometries = {1: self.straight}

        self.assertEqual(
            CoordinateRouteMatchingService.match_routes(
                origin=self.origin,
                destination=self.origin,
                route_geometries=geometries,
            ),
            [],
        )
        self.assertEqual(
            CoordinateRouteMatchingService.match_routes(
                origin=self.origin,
                destination=nearby_destination,
                route_geometries=geometries,
            ),
            [],
        )

        (match,) = CoordinateRouteMatchingService.match_routes(
            origin=self.origin,
            destination=nearby_destination,
            route_geometries=geometries,
            minimum_ride_distance_meters=10,
        )
        self.assertAlmostEqual(match.ride_distance_meters, 10.95, delta=0.1)

    def test_later_pass_can_match_when_nearest_projections_are_backwards(self):
        hairpin = LineString(
            (123.900, 10.310),
            (123.910, 10.310),
            (123.910, 10.311),
            (123.900, 10.311),
            srid=4326,
        )
        origin = Point(123.907, 10.310, srid=4326)
        destination = Point(123.905, 10.310, srid=4326)

        matches = CoordinateRouteMatchingService.match_routes(
            origin=origin,
            destination=destination,
            route_geometries={1: hairpin},
            search_radius_meters=130,
        )

        self.assertEqual(len(matches), 2)
        self.assertAlmostEqual(matches[0].boarding_position.point.y, 10.310)
        self.assertAlmostEqual(matches[1].boarding_position.point.y, 10.311)
        for match in matches:
            self.assertAlmostEqual(match.alighting_position.point.y, 10.311)
            self.assertLess(
                match.boarding_position.fraction,
                match.alighting_position.fraction,
            )

    def test_same_coordinate_on_two_passes_keeps_distinct_ordered_positions(self):
        crossing = LineString(
            (123.900, 10.310),
            (123.910, 10.310),
            (123.910, 10.315),
            (123.905, 10.315),
            (123.905, 10.305),
            srid=4326,
        )
        origin = Point(123.905, 10.310, srid=4326)
        destination = Point(123.905, 10.307, srid=4326)

        matches = CoordinateRouteMatchingService.match_routes(
            origin=origin,
            destination=destination,
            route_geometries={1: crossing},
            search_radius_meters=35,
        )

        self.assertEqual(len(matches), 2)
        first, second = matches
        self.assertNotAlmostEqual(
            first.boarding_position.fraction,
            second.boarding_position.fraction,
        )
        for match in matches:
            self.assertAlmostEqual(match.boarding_position.point.x, origin.x)
            self.assertAlmostEqual(match.boarding_position.point.y, origin.y)
            self.assertAlmostEqual(match.alighting_position.point.y, destination.y)

    def test_shared_vertex_with_a_duplicate_vertex_returns_one_candidate(self):
        line = LineString(
            (123.900, 10.310),
            (123.905, 10.310),
            (123.905, 10.310),
            (123.910, 10.310),
            srid=4326,
        )
        origin = Point(123.905, 10.310, srid=4326)

        (match,) = CoordinateRouteMatchingService.match_routes(
            origin=origin,
            destination=Point(123.911, 10.310, srid=4326),
            route_geometries={1: line},
        )

        self.assertAlmostEqual(match.boarding_position.fraction, 0.5)
        self.assertEqual(match.alighting_position.fraction, 1.0)

    def test_no_match_for_empty_eligible_set_or_endpoint_outside_radius(self):
        with self.assertNumQueries(0):
            self.assertEqual(
                CoordinateRouteMatchingService.match_routes(
                    origin=self.origin,
                    destination=self.destination,
                    route_geometries={},
                ),
                [],
            )

        self.assertEqual(
            CoordinateRouteMatchingService.match_routes(
                origin=self.origin,
                destination=Point(123.908, 10.316, srid=4326),
                route_geometries={1: self.straight},
            ),
            [],
        )

    def test_invalid_geometries_are_skipped_without_hiding_a_valid_match(self):
        invalid_geometries = {
            1: LineString(
                (123.902, 10.310),
                (123.902, 10.310),
                srid=4326,
            ),
            2: GEOSGeometry("LINESTRING EMPTY", srid=4326),
            3: LineString(self.straight.coords, srid=3857),
            4: self.origin,
            5: LineString(
                (123.902, 10.310),
                (123.908, 91),
                srid=4326,
            ),
        }

        with self.assertNumQueries(0):
            self.assertEqual(
                CoordinateRouteMatchingService.match_routes(
                    origin=self.origin,
                    destination=self.destination,
                    route_geometries=invalid_geometries,
                ),
                [],
            )
        (match,) = CoordinateRouteMatchingService.match_routes(
            origin=self.origin,
            destination=self.destination,
            route_geometries={**invalid_geometries, 6: self.straight},
        )
        self.assertEqual(match.variant_id, 6)

    def test_invalid_request_location_or_distance_is_rejected(self):
        for field, value in (
            ("origin", Point(123.902, 10.310, srid=3857)),
            ("destination", Point(123.908, 91, srid=4326)),
            ("search_radius_meters", float("nan")),
            ("minimum_ride_distance_meters", 0),
        ):
            with self.subTest(field=field):
                arguments = {
                    "origin": self.origin,
                    "destination": self.destination,
                    "route_geometries": {1: self.straight},
                    field: value,
                }

                with self.assertRaises(ValidationError) as context:
                    CoordinateRouteMatchingService.match_routes(**arguments)

                self.assertIn(field, context.exception.detail)

    def test_equal_scores_use_stable_variant_order_regardless_of_input_order(self):
        first = CoordinateRouteMatchingService.match_routes(
            origin=self.origin,
            destination=self.destination,
            route_geometries={20: self.straight, 10: self.straight},
        )
        second = CoordinateRouteMatchingService.match_routes(
            origin=self.origin,
            destination=self.destination,
            route_geometries={10: self.straight, 20: self.straight},
        )

        self.assertEqual([match.variant_id for match in first], [10, 20])
        self.assertEqual(first, second)
