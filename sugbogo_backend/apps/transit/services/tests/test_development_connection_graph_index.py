"""Verify selective connection retrieval and its existing journey-search semantics."""

import hashlib
import json
from dataclasses import replace
from itertools import chain, combinations
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.contrib.gis.geos import LineString, Point
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase, override_settings

from apps.transit.services.coordinate_journey_service import (
    CoordinateJourneySearchLimits,
    CoordinateJourneySearchProgress,
    CoordinateJourneyService,
)
from apps.transit.services.development_connection_graph_index import (
    INDEX_NAME,
    DevelopmentConnectionGraphIndex,
)
from apps.transit.services.development_connection_graph_service import (
    connection_record,
    digest,
    read_json,
    write_json,
)
from apps.transit.services.route_connection_service import (
    RouteConnectionService,
    TransferValidationStatus,
)


def write_fixture(
    directory,
    routes,
    codes,
    rows,
):
    """Write a small completed artifact in the exact Phase 5 wire format."""
    pairs = [
        (source, target)
        for source, target in combinations(routes, 2)
        if codes[source] != codes[target] and not routes[source].equals_exact(routes[target])
    ]
    inventory = {
        "format": 1,
        "inventory": [
            [variant_id, codes[variant_id], str(variant_id), geometry.hexewkb.decode()]
            for variant_id, geometry in routes.items()
        ],
    }
    revision = digest(inventory)
    directory = directory / revision
    directory.mkdir()
    write_json(directory / "inventory.json", inventory)
    complete = 0
    ordered = []
    for first, second in pairs:
        connections = sorted(
            (
                row
                for row in rows
                if {row[0], row[1]} == {first, second}
            ),
            key=lambda row: (row[0], row[1], row[2], row[4], row[6]),
        )
        complete += bool(connections)
        ordered.extend(connections)
        payload = {
            "revision": revision,
            "pair": [first, second],
            "state": "complete" if connections else "empty",
            "connections": connections,
            "progress": {
                "retained_connections": len(connections),
                "stop_reason": None,
            },
        }
        payload["checksum"] = digest(payload)
        write_json(directory / f"{first}-{second}.json", payload)
    graph = b"".join(
        (json.dumps(row, separators=(",", ":")) + "\n").encode()
        for row in ordered
    )
    (directory / "graph.jsonl").write_bytes(graph)
    write_json(directory / "complete.json", {
        "revision": revision,
        "variants": len(routes),
        "eligible_pairs": len(pairs),
        "complete": complete,
        "empty": len(pairs) - complete,
        "failed": 0,
        "pending": 0,
        "graph_bytes": len(graph),
        "graph_sha256": hashlib.sha256(graph).hexdigest(),
        "totals": {"retained_connections": len(rows)},
    })
    return directory, ordered


class GraphIndexFixture:
    """Supply a forward chain with two distinct non-nearest transfer opportunities."""

    def setUp(self):
        """Prepare a disposable graph without running spatial discovery."""
        temporary = TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.routes = {
            1: LineString((123.900, 10.310), (123.920, 10.310), srid=4326),
            2: LineString(
                (123.903, 10.310),
                (123.903, 10.313),
                (123.910, 10.313),
                (123.910, 10.3104),
                (123.915, 10.3104),
                (123.915, 10.320),
                srid=4326,
            ),
            3: LineString((123.915, 10.320), (123.928, 10.320), srid=4326),
        }
        self.codes = {1: "A", 2: "B", 3: "C"}
        self.origin = Point(123.906, 10.310, srid=4326)
        self.second_boarding = self.routes[2].project_normalized(
            Point(123.910, 10.3104, srid=4326),
        )
        third_boarding = self.routes[2].project_normalized(
            Point(123.915, 10.3104, srid=4326),
        )
        rows = [
            self.record(1, 2, 0.15, 0.0, 0.0),
            self.record(1, 2, 0.5, self.second_boarding, 44.0),
            self.record(1, 2, 0.5 + 1e-14, self.second_boarding, 45.0),
            self.record(1, 2, 0.75, third_boarding, 46.0),
            self.record(2, 1, 0.0001, 0.15, 0.4),
            self.record(2, 3, 1.0, 0.0, 0.0),
        ]
        self.directory, self.ordered = write_fixture(
            Path(temporary.name),
            self.routes,
            self.codes,
            rows,
        )
        self.index_path = self.directory / INDEX_NAME

    def record(
        self,
        source,
        target,
        alighting,
        boarding,
        distance,
    ):
        """Build an original record at exact fractions on the ordered lines."""
        return [
            source,
            target,
            alighting,
            self.routes[source].interpolate_normalized(alighting).ewkt,
            boarding,
            self.routes[target].interpolate_normalized(boarding).ewkt,
            distance,
            TransferValidationStatus.PROVISIONAL.value,
        ]

    def publish(self):
        """Publish and reopen the fixture's index."""
        DevelopmentConnectionGraphIndex.publish(self.directory)
        return DevelopmentConnectionGraphIndex(self.directory)

    def change_index(self, change):
        """Apply an index mutation and reseal it to exercise structural validation."""
        payload = read_json(self.index_path)
        payload.pop("checksum")
        change(payload)
        payload["checksum"] = digest(payload)
        write_json(self.index_path, payload)


class DevelopmentConnectionGraphIndexTests(GraphIndexFixture, SimpleTestCase):
    """Exercise artifact integrity without connecting to the database."""

    @override_settings(DEBUG=False)
    def test_index_command_is_development_only(self):
        with self.assertRaisesMessage(CommandError, "requires DEBUG=True"):
            call_command("index_development_connections", revision=self.directory.name)

    @override_settings(DEBUG=True)
    def test_index_command_rejects_paths_as_revision_ids(self):
        with self.assertRaisesMessage(CommandError, "64-character SHA-256 revision"):
            call_command("index_development_connections", revision="../inventory")

    def test_complete_inventory_preserves_both_directions_empties_and_raw_graph(self):
        original = (self.directory / "graph.jsonl").read_bytes()
        with patch.object(RouteConnectionService, "discover", side_effect=AssertionError):
            stats = DevelopmentConnectionGraphIndex.publish(self.directory)
        self.assertEqual(stats["directed_pairs"], 6)
        self.assertEqual(stats["empty_directions"], 3)
        self.assertEqual(stats["connection_count"], 6)
        self.assertEqual((self.directory / "graph.jsonl").read_bytes(), original)
        reader = DevelopmentConnectionGraphIndex(self.directory)
        for source, target in ((1, 2), (2, 1), (1, 3), (3, 1), (2, 3), (3, 2)):
            expected = [row for row in self.ordered if row[:2] == [source, target]]
            with self.subTest(source=source, target=target):
                self.assertEqual(reader.block(source, target).count, len(expected))
                self.assertEqual(
                    [json.loads(line) for line in reader.read_block(source, target).splitlines()],
                    expected,
                )
                first = list(reader.connections(source, target))
                self.assertEqual([connection_record(link) for link in first], expected)
                self.assertEqual(list(reader.connections(source, target)), first)
        self.assertEqual(round(self.ordered[1][2], 12), round(self.ordered[2][2], 12))
        self.assertNotEqual(self.ordered[1][2], self.ordered[2][2])
        with self.assertRaises(KeyError):
            reader.block(1, 4)
        with patch.object(Path, "open", side_effect=AssertionError):
            self.assertEqual(reader.read_block(1, 3), b"")

    def test_index_load_and_pair_lookup_read_only_the_selected_range(self):
        self.publish()
        graph = self.directory / "graph.jsonl"
        opened = []
        reads = []
        seek_offsets = []
        real_open = Path.open

        class GraphRead:
            def __init__(self, wrapped):
                self.wrapped = wrapped

            def __enter__(self):
                self.wrapped.__enter__()
                return self

            def __exit__(self, *args):
                return self.wrapped.__exit__(*args)

            def fileno(self):
                return self.wrapped.fileno()

            def seek(self, offset):
                seek_offsets.append(offset)
                return self.wrapped.seek(offset)

            def read(self, length):
                reads.append(length)
                return self.wrapped.read(length)

        def record_open(path, *args, **kwargs):
            opened.append(path.name)
            handle = real_open(path, *args, **kwargs)
            if path == graph:
                return GraphRead(handle)
            return handle

        with patch.object(Path, "open", record_open):
            reader = DevelopmentConnectionGraphIndex(self.directory)
            self.assertCountEqual(opened, ["complete.json", "inventory.json", INDEX_NAME])
            self.assertEqual(reads, [])
            block = reader.block(2, 1)
            self.assertEqual(len(list(reader.connections(2, 1))), 1)
        self.assertEqual(seek_offsets, [block.offset])
        self.assertEqual(reads, [block.length])
        self.assertLess(block.length, graph.stat().st_size)

    def test_empty_graph_distinguishes_eligible_and_excluded_directions(self):
        routes = dict(self.routes)
        routes[4] = self.routes[2].clone()
        codes = {1: "A", 2: "A", 3: "C", 4: "D"}
        directory, _ = write_fixture(self.directory.parent, routes, codes, [])
        result = DevelopmentConnectionGraphIndex.publish(directory)
        self.assertEqual(result["directed_pairs"], 8)
        self.assertEqual(result["empty_directions"], 8)
        reader = DevelopmentConnectionGraphIndex(directory)
        self.assertEqual(reader.read_block(1, 3), b"")
        for pair in ((1, 2), (2, 4), (1, 1)):
            with self.subTest(pair=pair), self.assertRaises(KeyError):
                reader.block(*pair)

    def test_malformed_index_entries_are_rejected_even_with_valid_checksum(self):
        changes = (
            lambda index: index["pairs"][0].__setitem__(2, 1),
            lambda index: index["pairs"][0].__setitem__(3, 1),
            lambda index: index["pairs"][0].__setitem__(4, 0),
            lambda index: index["pairs"].pop(),
            lambda index: index["pairs"].__setitem__(1, index["pairs"][0]),
            lambda index: index.__setitem__("revision", "0" * 64),
            lambda index: index.__setitem__("graph_sha256", "0" * 64),
            lambda index: index.__setitem__("graph_bytes", 1),
        )
        self.publish()
        good = self.index_path.read_bytes()
        for change in changes:
            with self.subTest(change=change):
                self.index_path.write_bytes(good)
                self.change_index(change)
                with self.assertRaises(ValueError):
                    DevelopmentConnectionGraphIndex(self.directory)
        self.index_path.write_bytes(good.replace(b'"format":1', b'"format":9'))
        with self.assertRaisesMessage(ValueError, "checksum mismatch"):
            DevelopmentConnectionGraphIndex(self.directory)

    def test_same_size_corruption_is_detected_before_yielding_a_selected_block(self):
        reader = self.publish()
        graph = self.directory / "graph.jsonl"
        raw = bytearray(graph.read_bytes())
        raw[reader.block(1, 2).offset + 1] = ord("9")
        graph.write_bytes(raw)
        with self.assertRaisesMessage(ValueError, "changed"):
            reader.read_block(1, 2)
        reader = DevelopmentConnectionGraphIndex(self.directory)
        with self.assertRaisesMessage(ValueError, "failed integrity verification"):
            next(reader.connections(1, 2))
        self.assertEqual(len(list(reader.connections(2, 1))), 1)
        with self.assertRaisesMessage(ValueError, "disagrees with its checkpoint"):
            DevelopmentConnectionGraphIndex.publish(self.directory)

    def test_missing_artifacts_and_incomplete_manifest_are_rejected(self):
        self.publish()
        for name in ("complete.json", "graph.jsonl", "inventory.json", INDEX_NAME):
            path = self.directory / name
            original = path.read_bytes()
            path.unlink()
            with self.subTest(name=name), self.assertRaises(FileNotFoundError):
                DevelopmentConnectionGraphIndex(self.directory)
            path.write_bytes(original)
        path = self.directory / "complete.json"
        manifest = read_json(path)
        manifest["pending"] = 1
        write_json(path, manifest)
        with self.assertRaisesMessage(ValueError, "no complete matching revision"):
            DevelopmentConnectionGraphIndex(self.directory)

    def test_missing_unexpected_and_corrupt_checkpoints_prevent_publication(self):
        path = self.directory / "1-2.json"
        original = path.read_bytes()
        path.rename(self.directory / "duplicate.json")
        with self.assertRaisesMessage(ValueError, "checkpoint inventory mismatch"):
            DevelopmentConnectionGraphIndex.publish(self.directory)
        (self.directory / "duplicate.json").unlink()
        path.write_bytes(original.replace(b'"provisional"', b'"non_walkable"'))
        with self.assertRaisesMessage(ValueError, "checkpoint checksum"):
            DevelopmentConnectionGraphIndex.publish(self.directory)
        self.assertFalse(self.index_path.exists())

    def test_interrupted_verification_and_failed_atomic_replace_preserve_previous_index(self):
        with patch(
            "apps.transit.services.development_connection_graph_index._build_entries",
            side_effect=KeyboardInterrupt,
        ):
            with self.assertRaises(KeyboardInterrupt):
                DevelopmentConnectionGraphIndex.publish(self.directory)
        self.assertFalse(self.index_path.exists())
        self.publish()
        old = self.index_path.read_bytes()
        with patch(
            "apps.transit.services.development_connection_graph_index.os.replace",
            side_effect=OSError("interrupted replacement"),
        ):
            with self.assertRaisesMessage(OSError, "interrupted replacement"):
                DevelopmentConnectionGraphIndex.publish(self.directory)
        self.assertEqual(self.index_path.read_bytes(), old)
        self.assertEqual(list(self.directory.glob(f"{INDEX_NAME}.*.tmp")), [])
        self.assertEqual(DevelopmentConnectionGraphIndex(self.directory).block(1, 2).count, 4)

    def test_invalid_connection_cannot_publish_even_with_matching_source_checksums(self):
        rows = [row.copy() for row in self.ordered]
        rows[0][2] = 0.0
        temporary = TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        directory, _ = write_fixture(Path(temporary.name), self.routes, self.codes, rows)
        with self.assertRaisesMessage(ValueError, "Invalid directed connection"):
            DevelopmentConnectionGraphIndex.publish(directory)
        self.assertFalse((directory / INDEX_NAME).exists())


class IndexedCoordinateJourneyTests(GraphIndexFixture, SimpleTestCase):
    """Supply indexed directions to the unchanged coordinate journey service."""

    databases = {"default"}

    def search(
        self,
        destination,
        *,
        limit=2,
        route_codes=None,
        connections=None,
        maximum_search_work=20_000,
    ):
        """Run exact PostGIS journey measurement on a small selected subgraph."""
        if connections is None:
            index = DevelopmentConnectionGraphIndex(self.directory)
            connections = chain(index.connections(1, 2), index.connections(2, 3))
        progress = CoordinateJourneySearchProgress()
        journeys = CoordinateJourneyService.search(
            origin=self.origin,
            destination=destination,
            route_geometries=self.routes,
            route_codes=self.codes if route_codes is None else route_codes,
            connections=connections,
            allow_provisional_transfers=True,
            limits=CoordinateJourneySearchLimits(
                max_transfers=limit,
                maximum_access_distance_meters=20,
                maximum_egress_distance_meters=20,
                maximum_search_work=maximum_search_work,
            ),
            progress=progress,
        )
        return journeys, progress

    def test_direct_and_both_transfer_depths_keep_direction_length_and_ranking(self):
        self.publish()
        cases = (
            (Point(123.917, 10.310, srid=4326), 0, (1,)),
            (Point(123.915, 10.317, srid=4326), 1, (1, 2)),
            (Point(123.925, 10.320, srid=4326), 2, (1, 2, 3)),
        )
        for destination, limit, expected in cases:
            with self.subTest(limit=limit):
                journeys, progress = self.search(destination, limit=limit)
                self.assertIsNone(progress.incomplete_reason)
                self.assertEqual(
                    tuple(ride.variant_id for ride in journeys[0].ride_legs),
                    expected,
                )
                for journey in journeys:
                    for ride in journey.ride_legs:
                        self.assertLess(ride.boarding_position.fraction, ride.alighting_position.fraction)
                        self.assertGreaterEqual(ride.ride_distance_meters, 25)
                if limit:
                    self.assertEqual(len(journeys), 2)
                    self.assertEqual(
                        [journey.transfers[0].straight_line_distance_meters for journey in journeys],
                        [44.0, 46.0],
                    )
                    self.assertEqual(
                        [journey.transfers[0].alighting_position.fraction for journey in journeys],
                        [0.5, 0.75],
                    )

    def test_folded_duplicate_evidence_keeps_the_existing_blocked_precedence(self):
        index = self.publish()
        first = list(index.connections(1, 2))
        self.assertEqual(len(first), 4)
        blocked = replace(
            first[2],
            validation_status=TransferValidationStatus.NON_WALKABLE,
        )
        approved = replace(
            first[1],
            validation_status=TransferValidationStatus.PEDESTRIAN_VALIDATED,
        )
        destination = Point(123.915, 10.317, srid=4326)
        for links in ([*first, approved, blocked], [blocked, approved, *reversed(first)]):
            journeys, progress = self.search(destination, limit=1, connections=iter(links))
            self.assertIsNone(progress.incomplete_reason)
            self.assertEqual(len(journeys), 1)
            self.assertEqual(journeys[0].transfers[0].alighting_position.fraction, 0.75)

    def test_repeated_route_codes_and_incomplete_search_are_preserved(self):
        self.publish()
        destination = Point(123.925, 10.320, srid=4326)
        journeys, progress = self.search(destination, route_codes={1: "A", 2: "B", 3: "A"})
        self.assertEqual(journeys, [])
        self.assertIsNone(progress.incomplete_reason)
        journeys, progress = self.search(destination, maximum_search_work=1)
        self.assertEqual(journeys, [])
        self.assertEqual(progress.incomplete_reason, "candidate_budget")
