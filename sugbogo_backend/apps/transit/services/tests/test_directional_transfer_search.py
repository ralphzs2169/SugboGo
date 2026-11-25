"""Verify indexed search against exhaustive position combinations and legacy search."""

from itertools import chain, product
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.db import connection
from django.test import TestCase

from apps.transit.services.coordinate_journey_service import (
    _shortlist,
    CoordinateJourneySearchLimits,
    CoordinateJourneySearchProgress,
    CoordinateJourneyService,
)
from apps.transit.services.coordinate_ride_measurement_service import measure_journey_rides
from apps.transit.services.coordinate_route_matching_service import (
    CoordinateRouteMatchingService,
    RouteEndpointPosition,
    RoutePosition,
)
from apps.transit.services.development_connection_graph_index import DevelopmentConnectionGraphIndex
from apps.transit.services.tests.test_development_connection_graph_index import (
    GraphIndexFixture,
    write_fixture,
)


class DirectionalTransferSearchTests(GraphIndexFixture, TestCase):
    """Use a small verified artifact with distinct and rounded-collision positions."""

    def search(
        self,
        *,
        index,
        destination,
        depth=2,
        budget=20_000,
        positions=None,
        indexed=True,
    ):
        """Run the isolated indexed path or the existing supplied-connections reference."""
        progress = CoordinateJourneySearchProgress()
        if indexed:
            source = {"connection_index": index}
        else:
            source = {
                "connections": chain.from_iterable(
                    index.connections(*pair)
                    for pair in index.nonempty_pairs()
                ),
            }
        options = {
            "origin": self.origin,
            "destination": destination,
            "route_geometries": self.routes,
            "route_codes": self.codes,
            "allow_provisional_transfers": True,
            "limits": CoordinateJourneySearchLimits(
                max_transfers=depth,
                maximum_access_distance_meters=20,
                maximum_egress_distance_meters=20,
                maximum_journeys=100,
                maximum_search_work=budget,
            ),
            "progress": progress,
            **source,
        }
        if positions is None:
            results = CoordinateJourneyService.search(**options)
        else:
            with patch.object(
                CoordinateRouteMatchingService,
                "find_endpoint_positions",
                return_value=positions,
            ):
                results = CoordinateJourneyService.search(**options)
        return results, progress

    def endpoint(
        self,
        variant_id,
        fraction,
        is_boarding,
    ):
        """Place a fixture endpoint directly on its directional geometry."""
        return RouteEndpointPosition(
            variant_id=variant_id,
            is_boarding=is_boarding,
            position=RoutePosition(
                self.routes[variant_id].interpolate_normalized(fraction),
                fraction,
            ),
            distance_meters=0,
        )

    def test_complete_search_retains_geometry_ranking_and_outside_intermediate(self):
        index = self.publish()
        for depth, point in (
            (0, (123.917, 10.310)),
            (1, (123.915, 10.317)),
            (2, (123.925, 10.320)),
        ):
            with self.subTest(depth=depth):
                destination = Point(*point, srid=4326)
                expected, _ = self.search(index=index, destination=destination, depth=depth, indexed=False)
                actual, progress = self.search(index=index, destination=destination, depth=depth)
                self.assertEqual(actual, expected)
                self.assertTrue(actual)
                self.assertIsNone(progress.incomplete_reason)
                self.assertEqual(progress.directional.stage_status, dict.fromkeys(range(depth + 1), "complete"))
                if depth == 2:
                    self.assertEqual(progress.nearby_origin_variants, 1)
                    self.assertEqual(progress.nearby_destination_variants, 1)
                    self.assertEqual(
                        [leg.variant_id for leg in actual[0].ride_legs],
                        [1, 2, 3],
                    )
                    self.assertEqual(
                        [journey.transfers[0].alighting_position.fraction for journey in actual],
                        [0.5, 0.75],
                    )
                    self.assertEqual(progress.directional.connection_blocks_read, 2)

    def test_pruning_matches_exhaustive_order_and_exact_distance_checks(self):
        index = self.publish()
        positions = [
            self.endpoint(1, 0.3, True),
            self.endpoint(1, 0.7, True),
            self.endpoint(1, 0.301, False),
            self.endpoint(1, 0.9, False),
            self.endpoint(2, 0.05, False),
            self.endpoint(2, 0.9, False),
            self.endpoint(3, 0.8, False),
        ]
        edges = [
            link
            for pair in index.nonempty_pairs()
            for link in index.connections(*pair)
        ]
        # The original runtime chooses the nearer of the two same-evidence rows
        # with the same rounded positional identity.
        edges.remove(next(link for link in edges if link.alighting_position.fraction == 0.5 + 1e-14))
        expected = set()
        for origin, destination in product(positions[:2], positions[2:]):
            for depth in range(3):
                for links in product(edges, repeat=depth):
                    variants = (origin.variant_id, *(link.to_variant_id for link in links))
                    if destination.variant_id != variants[-1] or len(set(variants)) != len(variants):
                        continue
                    if tuple(link.from_variant_id for link in links) != variants[:-1]:
                        continue
                    boarding = (origin.position, *(link.boarding_position for link in links))
                    alighting = (*(link.alighting_position for link in links), destination.position)
                    keys = tuple(
                        (variant_id, first.fraction, last.fraction)
                        for variant_id, first, last in zip(variants, boarding, alighting, strict=True)
                    )
                    if all(first < last for _, first, last in keys):
                        expected.add(keys)
        ride_keys = {key for journey in expected for key in journey}
        measurements = measure_journey_rides(
            route_geometries=self.routes,
            rides=ride_keys,
            minimum_ride_distance_meters=25,
        )
        expected = {
            journey
            for journey in expected
            if all(key in measurements for key in journey)
        }
        actual, progress = self.search(
            index=index,
            destination=positions[-1].position.point,
            positions=positions,
        )
        self.assertIsNone(progress.incomplete_reason)
        self.assertGreater(progress.directional.forward_positions_rejected, 0)
        self.assertGreater(progress.directional.repeated_code_sequences, 0)
        self.assertGreater(progress.directional.rejected_ride_keys, 0)
        self.assertEqual(
            {
                tuple((ride.variant_id, ride.boarding_position.fraction, ride.alighting_position.fraction)
                      for ride in journey.ride_legs)
                for journey in actual
            },
            expected,
        )

    def test_rounding_boundary_retains_precedence_before_exact_pruning(self):
        index = self.publish()
        start = self.endpoint(1, 0.5 + 5e-15, True)
        end = self.endpoint(2, 0.95, False)
        actual, progress = self.search(
            index=index,
            destination=end.position.point,
            positions=[start, end],
            depth=1,
        )
        self.assertEqual([journey.transfers[0].alighting_position.fraction for journey in actual], [0.75])
        self.assertEqual(progress.directional.connections_reconstructed, 3)

    def test_connected_middle_variant_cannot_travel_backward(self):
        temporary = TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        rows = [
            row
            for row in self.ordered
            if row[:2] != [2, 3]
        ]
        rows.append(self.record(2, 3, 0.1, 0.0, 25))
        directory, _ = write_fixture(
            Path(temporary.name),
            self.routes,
            self.codes,
            rows,
        )
        DevelopmentConnectionGraphIndex.publish(directory)
        index = DevelopmentConnectionGraphIndex(directory)
        result, progress = self.search(
            index=index,
            destination=Point(123.925, 10.320, srid=4326),
        )
        self.assertEqual(result, [])
        self.assertEqual(progress.directional.route_sequences, {1: 0, 2: 1})
        self.assertEqual(progress.directional.stage_status[2], "complete")
        self.assertGreater(progress.directional.forward_positions_rejected, 0)

    def test_shared_work_gives_depth_two_a_turn_and_preserves_direct_result(self):
        index = self.publish()
        positions = [
            self.endpoint(1, 0.3, True),
            self.endpoint(1, 0.9, False),
            self.endpoint(2, 0.9, False),
            self.endpoint(3, 0.9, False),
        ]
        kwargs = {
            "index": index,
            "destination": positions[-1].position.point,
            "positions": positions,
            "budget": 6,
        }
        before, _ = self.search(**kwargs, indexed=False)
        after, progress = self.search(**kwargs)
        self.assertEqual([journey.transfer_count for journey in before], [0, 1, 1])
        self.assertEqual([journey.transfer_count for journey in after], [0, 1, 2])
        self.assertEqual(before[0], after[0])
        self.assertEqual(progress.incomplete_reason, "candidate_budget")
        self.assertEqual(progress.directional.stage_status, {0: "complete", 1: "partial", 2: "partial"})
        self.assertEqual(
            sum(progress.destination_options.values()) + sum(progress.transfer_options.values()),
            6,
        )

    def test_retrieval_limit_marks_only_the_unfinished_depth(self):
        index = self.publish()
        positions = [
            self.endpoint(1, 0.3, True),
            self.endpoint(1, 0.9, False),
            self.endpoint(2, 0.9, False),
            self.endpoint(3, 0.9, False),
        ]
        with patch("apps.transit.services.coordinate_journey_service.MAX_CONNECTION_RECORDS", 4):
            result, progress = self.search(
                index=index,
                destination=positions[-1].position.point,
                positions=positions,
            )
        self.assertEqual([journey.transfer_count for journey in result], [0, 1, 1])
        self.assertEqual(progress.incomplete_reason, "connection_budget")
        self.assertEqual(progress.directional.stage_status, {0: "complete", 1: "complete", 2: "partial"})
        self.assertEqual(progress.directional.connection_records_read, 4)

    def test_indexed_cancellation_returns_already_measured_journeys(self):
        index = self.publish()
        positions = [
            self.endpoint(1, 0.3, True),
            self.endpoint(1, 0.9, False),
            self.endpoint(2, 0.9, False),
            self.endpoint(3, 0.9, False),
        ]

        def measure(**kwargs):
            if any(key[0] == 3 for key in kwargs["rides"]):
                with connection.cursor() as cursor:
                    cursor.execute("SET LOCAL statement_timeout = '1ms'")
                    cursor.execute("SELECT pg_sleep(0.05)")
            return measure_journey_rides(**kwargs)

        with (
            patch("apps.transit.services.coordinate_journey_service.INDEXED_REQUEST_BATCH_SIZE", 1),
            patch("apps.transit.services.coordinate_journey_service.measure_journey_rides", side_effect=measure),
        ):
            result, progress = self.search(
                index=index,
                destination=positions[-1].position.point,
                positions=positions,
            )
        self.assertEqual([journey.transfer_count for journey in result], [0, 1])
        self.assertEqual(progress.incomplete_reason, "candidate_budget")
        self.assertTrue(progress.ride_measurement_cancelled)
        self.assertEqual(progress.directional.stage_status, {0: "complete", 1: "partial", 2: "partial"})
        with connection.cursor() as cursor:
            cursor.execute("SELECT 42")
            self.assertEqual(cursor.fetchone(), (42,))

    def test_rejects_route_identity_mismatch_before_using_index(self):
        index = self.publish()
        self.codes[3] = "OTHER"
        with self.assertRaisesMessage(ValueError, "does not match the graph revision"):
            self.search(index=index, destination=Point(123.925, 10.320, srid=4326))

    def test_batch_shortlist_matches_one_sort_with_ties_and_multiple_corridors(self):
        groups = [
            [
                SimpleNamespace(score=score, corridor=corridor, transfers=transfers)
                for score, corridor, transfers in rows
            ]
            for rows in (
                [(4, "A", (1,)), (7, "A", (1,)), (3, "D", ())],
                [(3, "A", (1,)), (5, "B", (1,)), (3, "D", ())],
                [(2, "B", (1,)), (6, "A", (1,)), (8, "C", (1,))],
            )
        ]
        with (
            patch("apps.transit.services.coordinate_journey_service.coordinate_journey_rank",
                  side_effect=lambda journey: journey.score),
            patch("apps.transit.services.coordinate_journey_service.coordinate_journey_corridor",
                  side_effect=lambda journey: journey.corridor),
        ):
            for limit, diversify, separate in product((1, 2, 5), (False, True), (False, True)):
                with self.subTest(limit=limit, diversify=diversify, separate=separate):
                    options = {
                        "limit": limit,
                        "diversify_corridors": diversify,
                        "separate_direct_journeys": separate,
                    }
                    expected = _shortlist(list(chain.from_iterable(groups)), **options)
                    accumulated = []
                    for group in groups:
                        accumulated = _shortlist([*accumulated, *group], **options)
                    self.assertEqual(accumulated, expected)
