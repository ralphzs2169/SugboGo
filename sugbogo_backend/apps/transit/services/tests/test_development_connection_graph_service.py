"""Verify development graph completeness, recovery and directional parity in isolated PostGIS."""

import copy
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.contrib.gis.geos import LineString, MultiPolygon, Point, Polygon
from django.db import connection
from django.test import SimpleTestCase, override_settings

from apps.transit.services.development_connection_graph_service import (
    DevelopmentConnectionGraphService,
    connection_record,
    digest,
    read_json,
    write_json,
)
from apps.transit.services.route_connection_service import (
    RouteConnectionBudgetExceeded,
    RouteConnectionService,
)
from apps.transit.services.coordinate_journey_service import (
    CoordinateJourneySearchLimits,
    CoordinateJourneyService,
)
from apps.transit.services.tests.test_transit_seed_service import reviewed_fixture


class DevelopmentConnectionGraphTests(SimpleTestCase):
    """Exercise real pair discovery with disposable checkpoint files and read-only SQL."""

    databases = {"default"}

    def setUp(self):
        """Create a small directional network with one confirmed empty pair."""
        self.temporary = TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.service = DevelopmentConnectionGraphService.__new__(DevelopmentConnectionGraphService)
        self.service.routes = {
            1: LineString((123.9, 10.31), (123.91, 10.31), srid=4326),
            2: LineString((123.905, 10.305), (123.905, 10.315), srid=4326),
            3: LineString((123.905, 10.314), (123.915, 10.314), srid=4326),
        }
        self.service.codes = {1: "A", 2: "B", 3: "C"}
        self.service.pairs = [(1, 2), (1, 3), (2, 3)]
        self.service.parameters = {"fixture": "ordered-crossings"}
        self.service.revision = digest(self.service.parameters)
        self.service.directory = Path(self.temporary.name)

    def test_complete_empty_accounting_and_output_parity(self):
        result = self.service.build()
        self.assertEqual(result["complete"], 2)
        self.assertEqual(result["empty"], 1)
        self.assertEqual(result["pending"], 0)
        self.assertEqual(result["failed"], 0)
        expected = RouteConnectionService.discover(
            route_geometries=self.service.routes,
            route_codes=self.service.codes,
        )
        actual = list(self.service.connections())
        self.assertEqual(
            sorted(connection_record(link) for link in expected),
            sorted(connection_record(link) for link in actual),
        )

    def test_completed_graph_supports_one_and_two_forward_transfers(self):
        self.service.build()
        connections = list(self.service.connections())
        for destination, expected in (
            ((123.905, 10.313), [1, 2]),
            ((123.914, 10.314), [1, 2, 3]),
        ):
            with self.subTest(destination=destination):
                journeys = CoordinateJourneyService.search(
                    origin=Point(123.901, 10.31, srid=4326),
                    destination=Point(*destination, srid=4326),
                    route_geometries=self.service.routes,
                    route_codes=self.service.codes,
                    connections=connections,
                    allow_provisional_transfers=True,
                    limits=CoordinateJourneySearchLimits(
                        maximum_access_distance_meters=20,
                        maximum_egress_distance_meters=20,
                    ),
                )
                self.assertTrue(journeys)
                self.assertEqual(
                    [leg.variant_id for leg in journeys[0].ride_legs],
                    expected,
                )
                for journey in journeys:
                    for leg in journey.ride_legs:
                        self.assertLess(leg.boarding_position.fraction, leg.alighting_position.fraction)
                        self.assertGreaterEqual(leg.ride_distance_meters, 25)

    def test_interrupted_build_resumes_once_and_regenerates_deterministically(self):
        first = self.service.build(maximum_pairs=1)
        self.assertEqual(first["pending"], 2)
        self.assertFalse((self.service.directory / "complete.json").exists())
        result = self.service.build()
        self.assertEqual(result["reused_pairs"], 1)
        resumed = self.service.build()
        self.assertEqual(resumed["reused_pairs"], 3)
        self.assertEqual(result["graph_sha256"], resumed["graph_sha256"])
        self.service.pair_path((1, 2)).unlink()
        regenerated = self.service.build()
        self.assertEqual(regenerated["graph_sha256"], result["graph_sha256"])
        self.assertEqual(regenerated["attempted_pairs"], 1)

    def test_partial_corrupt_and_stale_pairs_are_reprocessed(self):
        self.service.build()
        cases = [
            b'{"partial":',
            b'{"revision":"stale"}',
        ]
        for raw in cases:
            with self.subTest(raw=raw):
                self.service.pair_path((1, 2)).write_bytes(raw)
                result = self.service.build()
                self.assertEqual(result["attempted_pairs"], 1)
                self.assertEqual(result["reused_pairs"], 2)
        payload = read_json(self.service.pair_path((1, 2)))
        payload.pop("checksum")
        payload["revision"] = "wrong"
        payload["checksum"] = digest(payload)
        write_json(self.service.pair_path((1, 2)), payload)
        self.assertEqual(self.service.build()["attempted_pairs"], 1)

    def test_duplicate_artifact_prevents_publication(self):
        self.service.build()
        write_json(self.service.directory / "duplicate.json", {})
        with self.assertRaises(ValueError):
            self.service.build()
        self.assertFalse((self.service.directory / "complete.json").exists())

    def test_pair_failure_is_checkpointed_and_retry_is_idempotent(self):
        with patch.object(
            RouteConnectionService,
            "discover",
            side_effect=RouteConnectionBudgetExceeded,
        ):
            result = self.service.build()
        self.assertEqual(result["failed"], 1)
        self.assertEqual(result["pending"], 2)
        self.assertFalse((self.service.directory / "complete.json").exists())
        payload = read_json(self.service.pair_path((1, 2)))
        self.assertEqual(payload["state"], "failed")
        result = self.service.build()
        self.assertEqual(result["complete"] + result["empty"], 3)

    def test_invalid_ordered_fraction_is_rejected_even_with_valid_checksum(self):
        self.service.build()
        payload = read_json(self.service.pair_path((1, 2)))
        payload.pop("checksum")
        payload["connections"][0][2] = 0
        payload["checksum"] = digest(payload)
        write_json(self.service.pair_path((1, 2)), payload)
        with self.assertRaises(ValueError):
            list(self.service.connections())
        self.assertEqual(self.service.build()["attempted_pairs"], 1)

    def test_graph_corruption_prevents_loading(self):
        self.service.build()
        with (self.service.directory / "graph.jsonl").open("ab") as target:
            target.write(b"corrupt")
        with self.assertRaises(ValueError):
            list(self.service.connections())
        result = self.service.build()
        self.assertEqual(result["reused_pairs"], 3)
        self.assertTrue(list(self.service.connections()))

    def test_distinct_fraction_records_survive_python_rounding_collisions(self):
        self.service.build()
        path = self.service.pair_path((1, 2))
        payload = read_json(path)
        payload.pop("checksum")
        row = copy.deepcopy(payload["connections"][0])
        row[2] += 1e-14
        self.assertEqual(round(row[2], 12), round(payload["connections"][0][2], 12))
        payload["connections"].append(row)
        payload["connections"].sort(key=lambda item: (item[0], item[1], item[2], item[4], item[6]))
        payload["progress"]["retained_connections"] += 1
        payload["checksum"] = digest(payload)
        write_json(path, payload)
        self.assertEqual(
            len(self.service.validated_pair((1, 2))["connections"]),
            len(payload["connections"]),
        )

    def test_concurrent_builder_is_rejected(self):
        with self.service.build_lock():
            with self.assertRaises(OSError):
                self.service.build()

    def test_resource_limits_prevent_completed_artifacts(self):
        with patch(
            "apps.transit.services.development_connection_graph_service.PAIR_RETAINED_CONNECTIONS",
            1,
        ):
            result = self.service.build()
        self.assertEqual(result["failed"], 1)
        self.assertFalse((self.service.directory / "complete.json").exists())

    @override_settings(DEBUG=True)
    def test_revision_tracks_geometry_parameters_and_canonical_variant_identity(self):
        payload = reviewed_fixture()
        other = copy.deepcopy(payload["routes"][0])
        other["code"] = "OTHER"
        other["variants"][0]["key"] = "return"
        other["variants"][0]["geometry"].reverse()
        other["variants"][0]["point_keys"].reverse()
        payload["routes"].append(other)
        dataset = Path(self.temporary.name) / "seed.json"
        boundary = MultiPolygon(Polygon.from_bbox((123, 10, 124, 11)), srid=4326)

        def load():
            dataset.write_text(json.dumps(payload), encoding="utf-8")
            return DevelopmentConnectionGraphService(
                dataset=dataset,
                confirmation=str(connection.settings_dict["NAME"]),
            )

        with patch(
            "apps.transit.services.development_connection_graph_service."
            "TransitSpatialValidationService.boundary",
            return_value=boundary,
        ):
            original = load()
            payload["routes"].reverse()
            reordered = load()
            self.assertEqual(original.revision, reordered.revision)
            self.assertEqual(original.pairs, reordered.pairs)
            payload["routes"][0]["variants"][0]["geometry"][1]["latitude"] += 0.0001
            changed = load()
            self.assertNotEqual(original.revision, changed.revision)
            self.assertNotEqual(original.directory, changed.directory)
            with patch(
                "apps.transit.services.development_connection_graph_service.PAIR_SECONDS",
                1,
            ):
                self.assertNotEqual(changed.revision, load().revision)

