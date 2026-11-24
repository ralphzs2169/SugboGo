from dataclasses import replace

from django.contrib.gis.geos import LineString, Point
from django.test import TestCase
from rest_framework.exceptions import ValidationError

from apps.transit.services.coordinate_journey_service import (
    CoordinateJourneySearchLimits,
    CoordinateJourneyService,
)
from apps.transit.services.coordinate_route_matching_service import RoutePosition
from apps.transit.services.route_connection_service import (
    RouteConnectionService,
    TransferValidationStatus,
)


def _point(
    x,
    y,
):
    return Point(123.900 + x, 10.310 + y, srid=4326)


def _line(*coordinates):
    return LineString(
        [
            _point(*coordinate).coords
            for coordinate in coordinates
        ],
        srid=4326,
    )


class RouteConnectionDiscoveryTests(TestCase):
    def test_separate_crossings_produce_distinct_provisional_connections(self):
        routes = {
            1: _line((0, 0), (0.010, 0)),
            2: _line((0.003, -0.005), (0.003, 0.005), (0.007, 0.005), (0.007, -0.005)),
        }

        connections = RouteConnectionService.discover(
            route_geometries=routes,
            maximum_transfer_distance_meters=15,
            maximum_candidates_per_area=1,
        )
        forward = [
            link
            for link in connections
            if link.from_variant_id == 1
        ]

        self.assertEqual(len(forward), 2)
        self.assertAlmostEqual(forward[0].alighting_position.fraction, 0.3)
        self.assertAlmostEqual(forward[1].alighting_position.fraction, 0.7)
        self.assertLess(forward[0].boarding_position.fraction, forward[1].boarding_position.fraction)
        self.assertEqual(
            {
                (link.from_variant_id, link.to_variant_id)
                for link in connections
            },
            {(1, 2), (2, 1)},
        )
        for link in connections:
            self.assertAlmostEqual(link.straight_line_distance_meters, 0, places=4)
            self.assertEqual(link.validation_status, TransferValidationStatus.PROVISIONAL)

    def test_parallel_lines_produce_meter_based_links_across_the_corridor(self):
        routes = {
            1: _line((0, 0), (0.010, 0)),
            2: _line((0, 0.0003), (0.010, 0.0003)),
        }
        connections = RouteConnectionService.discover(
            route_geometries=routes,
            maximum_transfer_distance_meters=50,
            maximum_candidates_per_area=1,
        )

        self.assertFalse(routes[1].intersects(routes[2]))
        self.assertTrue(any(
            0.4 < link.alighting_position.fraction < 0.6
            for link in connections
        ))
        for link in connections:
            self.assertAlmostEqual(link.straight_line_distance_meters, 33.2, delta=0.5)
        self.assertEqual(
            RouteConnectionService.discover(
                route_geometries=routes,
                maximum_transfer_distance_meters=25,
            ),
            [],
        )

    def test_empty_invalid_disconnected_and_identical_routes_produce_no_connections(self):
        valid = _line((0, 0), (0.010, 0))
        for routes in (
            {},
            {1: valid, 2: _line((0, 0), (0, 0))},
            {1: valid, 2: _line((0, 0.010), (0.010, 0.010))},
            {1: valid, 2: valid.clone()},
        ):
            with self.subTest(routes=routes):
                self.assertEqual(
                    RouteConnectionService.discover(route_geometries=routes),
                    [],
                )

    def test_discovery_budget_fails_explicitly_before_returning_partial_connections(self):
        routes = {
            1: _line((0, 0), (0.010, 0)),
            2: _line((0.003, -0.005), (0.003, 0.005), (0.007, 0.005), (0.007, -0.005)),
        }

        with self.assertRaises(ValidationError) as context:
            RouteConnectionService.discover(
                route_geometries=routes,
                maximum_segment_pairs=1,
            )

        self.assertIn("connections", context.exception.detail)


class CoordinateJourneyServiceTests(TestCase):
    def setUp(self):
        self.routes = {
            1: _line((0, 0), (0.010, 0)),
            2: _line((0.010, 0), (0.010, 0.010)),
            3: _line((0.010, 0.010), (0.020, 0.010)),
            4: _line((0.020, 0.010), (0.020, 0.020)),
        }
        self.limits = CoordinateJourneySearchLimits(
            maximum_access_distance_meters=45,
            maximum_egress_distance_meters=45,
        )
        self.origin = _point(0.001, 0)

    def _search(
        self,
        destination,
        *,
        routes=None,
        codes=None,
        origin=None,
        connections=None,
        provisional=False,
        **limits,
    ):
        if routes is None:
            routes = self.routes
        if codes is None:
            codes = {
                variant_id: str(variant_id)
                for variant_id in routes
            }
        if origin is None:
            origin = self.origin
        return CoordinateJourneyService.search(
            origin=origin,
            destination=destination,
            route_geometries=routes,
            route_codes=codes,
            connections=connections,
            allow_provisional_transfers=provisional,
            limits=replace(self.limits, **limits),
        )

    def _approved_connections(self):
        return [
            replace(
                connection,
                validation_status=TransferValidationStatus.PEDESTRIAN_VALIDATED,
            )
            for connection in RouteConnectionService.discover(route_geometries=self.routes)
        ]

    def _assert_rides(
        self,
        journey,
        variant_ids,
    ):
        self.assertEqual([leg.variant_id for leg in journey.ride_legs], variant_ids)
        self.assertEqual(journey.transfer_count, len(variant_ids) - 1)
        self.assertAlmostEqual(
            journey.total_ride_distance_meters,
            sum(leg.ride_distance_meters for leg in journey.ride_legs),
        )
        for leg in journey.ride_legs:
            self.assertLess(leg.boarding_position.fraction, leg.alighting_position.fraction)
            self.assertGreaterEqual(leg.ride_distance_meters, self.limits.minimum_ride_distance_meters)
            self.assertEqual(leg.ride_geometry.srid, 4326)
        for index, transfer in enumerate(journey.transfers):
            before = journey.ride_legs[index]
            after = journey.ride_legs[index + 1]
            self.assertEqual(before.alighting_position, transfer.alighting_position)
            self.assertEqual(after.boarding_position, transfer.boarding_position)

    def test_direct_journey_returns_an_ordered_centerline_ride(self):
        (journey,) = self._search(_point(0.008, 0), max_transfers=0)

        self._assert_rides(journey, [1])
        self.assertEqual(journey.ride_legs[0].jeepney_route_code, "1")
        self.assertAlmostEqual(journey.ride_legs[0].boarding_position.fraction, 0.1)
        self.assertAlmostEqual(journey.ride_legs[0].alighting_position.fraction, 0.8)
        self.assertAlmostEqual(journey.ranking_cost_meters, 0)

    def test_approved_one_and_two_transfer_journeys_use_every_ordered_ride(self):
        approved = self._approved_connections()
        (one_transfer,) = self._search(
            _point(0.010, 0.008),
            connections=approved,
            max_transfers=1,
        )
        (two_transfers,) = self._search(_point(0.017, 0.010), connections=approved)

        self._assert_rides(one_transfer, [1, 2])
        self._assert_rides(two_transfers, [1, 2, 3])
        self.assertFalse(two_transfers.has_provisional_transfers)
        self.assertEqual(
            [link.validation_status for link in two_transfers.transfers],
            [TransferValidationStatus.PEDESTRIAN_VALIDATED] * 2,
        )
        self.assertAlmostEqual(two_transfers.approximate_total_walking_distance_meters, 0)
        self.assertEqual(two_transfers.transfer_penalty_meters, 200)

    def test_transfer_limit_blocks_otherwise_reachable_routes(self):
        approved = self._approved_connections()
        self.assertIn((3, 4), {
            (link.from_variant_id, link.to_variant_id)
            for link in approved
        })
        for transfer_limit, destination in (
            (0, _point(0.010, 0.008)),
            (1, _point(0.017, 0.010)),
            (2, _point(0.020, 0.019)),
        ):
            with self.subTest(transfer_limit=transfer_limit):
                self.assertEqual(
                    self._search(
                        destination,
                        connections=approved,
                        max_transfers=transfer_limit,
                    ),
                    [],
                )
        with self.assertRaises(ValidationError):
            self._search(_point(0.020, 0.019), max_transfers=3)

    def test_reverse_riding_and_wrong_intermediate_order_are_rejected(self):
        self.assertEqual(
            self._search(
                _point(0.001, 0),
                origin=_point(0.009, 0),
                max_transfers=0,
            ),
            [],
        )

        routes = {
            1: self.routes[1],
            2: _line((0.010, 0.013), (0.010, -0.003)),
            3: self.routes[3],
        }
        connections = RouteConnectionService.discover(
            route_geometries=routes,
            maximum_transfer_distance_meters=15,
        )
        enter = next(link for link in connections if (link.from_variant_id, link.to_variant_id) == (1, 2))
        leave = next(link for link in connections if (link.from_variant_id, link.to_variant_id) == (2, 3))
        self.assertGreater(enter.boarding_position.fraction, leave.alighting_position.fraction)
        self.assertEqual(
            self._search(
                _point(0.017, 0.010),
                routes=routes,
                connections=connections,
                provisional=True,
            ),
            [],
        )

    def test_candidate_with_a_short_or_zero_length_ride_is_rejected(self):
        self.assertEqual(self._search(self.origin, max_transfers=0), [])
        self.assertEqual(
            self._search(
                _point(0.010, 0.008),
                origin=_point(0.0099, 0),
                provisional=True,
                maximum_access_distance_meters=5,
            ),
            [],
        )

        routes = {
            1: self.routes[1],
            2: _line((0.010, -0.005), (0.010, 0.005)),
            3: _line((0.010, 0), (0.020, 0.002)),
        }
        links = [
            link
            for link in RouteConnectionService.discover(
                route_geometries=routes,
                maximum_transfer_distance_meters=15,
            )
            if (link.from_variant_id, link.to_variant_id) in {(1, 2), (2, 3)}
        ]
        self.assertEqual(len(links), 2)
        self.assertAlmostEqual(links[0].boarding_position.fraction, links[1].alighting_position.fraction)
        self.assertEqual(
            self._search(
                _point(0.019, 0.0018),
                routes=routes,
                connections=links,
                provisional=True,
            ),
            [],
        )

    def test_repeated_variants_and_same_code_transfers_are_discarded(self):
        routes = {
            1: self.routes[1],
            2: _line((0.008, 0), (0.008, 0.003), (0.002, 0.003), (0.002, 0)),
        }
        cycle_links = RouteConnectionService.discover(route_geometries=routes)
        self.assertTrue(any(
            link.from_variant_id == 2 and link.to_variant_id == 1
            for link in cycle_links
        ))
        self.assertEqual(
            self._search(
                _point(0.004, 0),
                origin=_point(0.006, 0),
                routes=routes,
                connections=cycle_links,
                provisional=True,
            ),
            [],
        )
        self.assertEqual(
            self._search(
                _point(0.010, 0.008),
                routes={1: self.routes[1], 2: self.routes[2]},
                codes={1: "A", 2: "A"},
                provisional=True,
            ),
            [],
        )

    def test_non_nearest_connection_survives_area_and_result_limits(self):
        routes = {
            1: _line((0, 0), (0.013, 0)),
            2: _line((0.003, -0.002), (0.003, 0.003), (0.008, 0.003), (0.010, 0.00035), (0.014, 0.005)),
        }
        connections = RouteConnectionService.discover(
            route_geometries=routes,
            maximum_transfer_distance_meters=90,
            maximum_candidates_per_area=1,
        )
        origin = _point(0.005, 0)
        nearest = min(
            (
                link
                for link in connections
                if link.from_variant_id == 1
            ),
            key=lambda link: link.straight_line_distance_meters,
        )
        self.assertLess(nearest.alighting_position.point.x, origin.x)

        (journey,) = self._search(
            _point(0.014, 0.005),
            origin=origin,
            routes=routes,
            connections=connections,
            provisional=True,
            maximum_journeys=1,
        )

        self._assert_rides(journey, [1, 2])
        self.assertGreater(journey.transfers[0].straight_line_distance_meters, 25)
        self.assertGreater(journey.transfers[0].alighting_position.point.x, origin.x)

    def test_two_usable_crossings_on_the_same_route_pair_remain_separate_itineraries(self):
        routes = {
            1: self.routes[1],
            2: _line((0.003, -0.005), (0.003, 0.005), (0.007, 0.005), (0.007, -0.005)),
        }
        connections = RouteConnectionService.discover(
            route_geometries=routes,
            maximum_transfer_distance_meters=15,
            maximum_candidates_per_area=1,
        )

        journeys = self._search(
            _point(0.007, -0.004),
            routes=routes,
            connections=connections,
            provisional=True,
        )

        self.assertEqual(len(journeys), 2)
        self.assertEqual(
            {
                round(journey.transfers[0].alighting_position.fraction, 2)
                for journey in journeys
            },
            {0.3, 0.7},
        )
        for journey in journeys:
            self._assert_rides(journey, [1, 2])

    def test_provisional_requires_opt_in_and_blocked_evidence_overrides_approval(self):
        destination = _point(0.010, 0.008)
        candidates = RouteConnectionService.discover(route_geometries=self.routes)
        self.assertEqual(self._search(destination, connections=candidates), [])

        (provisional,) = self._search(destination, provisional=True)
        self.assertTrue(provisional.has_provisional_transfers)
        self._assert_rides(provisional, [1, 2])
        link = provisional.transfers[0]
        approved = replace(link, validation_status=TransferValidationStatus.PEDESTRIAN_VALIDATED)
        blocked = replace(link, validation_status=TransferValidationStatus.NON_WALKABLE)

        (validated,) = self._search(destination, connections=[approved, link])
        self.assertFalse(validated.has_provisional_transfers)
        self.assertEqual(
            self._search(destination, connections=[link, blocked, approved], provisional=True),
            [],
        )

    def test_stale_or_unclassified_transfer_is_not_eligible(self):
        (journey,) = self._search(_point(0.010, 0.008), provisional=True)
        link = journey.transfers[0]
        stale = replace(
            link,
            boarding_position=RoutePosition(
                point=link.boarding_position.point,
                fraction=0.5,
            ),
        )
        unclassified = replace(link, validation_status=None)

        self.assertEqual(
            self._search(
                _point(0.010, 0.008),
                connections=[stale, unclassified],
                provisional=True,
            ),
            [],
        )

    def test_ranking_penalty_can_change_best_journey(self):
        routes = {
            1: self.routes[1],
            2: self.routes[2],
            3: _line((0, 0.001), (0.010, 0.001), (0.010, 0.010)),
        }
        approved = self._approved_connections()
        destination = _point(0.010, 0.008)
        for penalty, expected in (
            (0, [1, 2]),
            (200, [3]),
        ):
            with self.subTest(penalty=penalty):
                (best,) = self._search(
                    destination,
                    routes=routes,
                    connections=approved,
                    maximum_access_distance_meters=120,
                    maximum_journeys=1,
                    transfer_penalty_meters=penalty,
                )
                self._assert_rides(best, expected)
                self.assertAlmostEqual(
                    best.ranking_cost_meters,
                    best.approximate_total_walking_distance_meters + penalty * best.transfer_count,
                )

    def test_stable_ranking_uses_variant_identity_when_distances_tie(self):
        line = self.routes[1]
        destination = _point(0.008, 0)
        first = self._search(destination, routes={20: line, 10: line})
        second = self._search(destination, routes={10: line, 20: line})

        self.assertEqual(first, second)
        self.assertEqual([journey.ride_legs[0].variant_id for journey in first], [10, 20])

    def test_empty_and_invalid_networks_produce_no_journeys(self):
        for routes in (
            {},
            {1: _line((0, 0), (0, 0)), 2: _point(0, 0)},
        ):
            with self.subTest(routes=routes), self.assertNumQueries(0):
                self.assertEqual(self._search(_point(0.008, 0), routes=routes, provisional=True), [])

    def test_exceeding_work_budget_fails_explicitly(self):
        with self.assertRaises(ValidationError) as context:
            self._search(_point(0.017, 0.010), provisional=True, maximum_search_work=1)

        self.assertIn("search", context.exception.detail)
