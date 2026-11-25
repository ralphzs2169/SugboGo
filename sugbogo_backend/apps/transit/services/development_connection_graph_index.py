"""Publish and read directional pair ranges in a completed development graph."""

import hashlib
import io
import json
import math
import os
import re
from collections.abc import Iterator
from dataclasses import dataclass
from itertools import combinations
from pathlib import Path
from tempfile import NamedTemporaryFile

from django.contrib.gis.geos import GEOSException, GEOSGeometry

from apps.transit.services.coordinate_route_matching_service import RoutePosition
from apps.transit.services.development_connection_graph_service import (
    ARTIFACT_BYTES,
    PAIR_RETAINED_CONNECTIONS,
    digest,
    read_json,
)
from apps.transit.services.route_connection_service import (
    MAXIMUM_PROVISIONAL_TRANSFER_DISTANCE_METERS,
    RouteConnection,
    TransferValidationStatus,
)

INDEX_NAME = "graph.pair-index"
INDEX_FORMAT = 1
GRAPH_FORMAT = 1
SHA256_PATTERN = re.compile(r"[0-9a-f]{64}")
EMPTY_SHA256 = hashlib.sha256(b"").hexdigest()
VALID_STATUSES = {status.value for status in TransferValidationStatus}


@dataclass(frozen=True)
class DirectedConnectionBlock:
    """Locate and authenticate one eligible direction, including a confirmed empty."""

    offset: int
    length: int
    count: int
    sha256: str


def _file_identity(stat):
    """Detect replaced or edited artifacts without reading their contents."""
    return (
        stat.st_dev,
        stat.st_ino,
        stat.st_size,
        stat.st_mtime_ns,
    )


def _is_sha256(value):
    """Recognize a canonical SHA-256 digest."""
    return isinstance(value, str) and SHA256_PATTERN.fullmatch(value) is not None


def _is_number(value):
    """Recognize the finite JSON numbers emitted by graph assembly."""
    return (
        type(value) is int
        or (type(value) is float and math.isfinite(value))
    )


def _record_order(
    row,
    pair,
):
    """Validate scalar record fields and return their exact within-pair sort key."""
    if not isinstance(row, list) or len(row) != 8:
        raise ValueError("Invalid graph connection record.")
    source, target, alighting, alighting_point, boarding, boarding_point, distance, status = row
    if (
        type(source) is not int
        or type(target) is not int
        or (source, target) != pair
        or not _is_number(alighting)
        or not 0 < alighting <= 1
        or not _is_number(boarding)
        or not 0 <= boarding < 1
        or not _is_number(distance)
        or not 0 <= distance <= MAXIMUM_PROVISIONAL_TRANSFER_DISTANCE_METERS
        or not isinstance(status, str)
        or status not in VALID_STATUSES
        or not isinstance(alighting_point, str)
        or not isinstance(boarding_point, str)
    ):
        raise ValueError("Invalid directed connection in graph block.")
    return alighting, boarding


def _point(ewkt):
    """Reconstruct the original finite two-dimensional WGS84 point."""
    try:
        point = GEOSGeometry(ewkt)
    except (GEOSException, ValueError, TypeError) as error:
        raise ValueError("Invalid connection point in graph block.") from error
    if (
        point.geom_type != "Point"
        or point.srid != 4326
        or point.empty
        or point.hasz
        or not -180 <= point.x <= 180
        or not -90 <= point.y <= 90
    ):
        raise ValueError("Invalid connection point in graph block.")
    return point


class _GraphSource:
    """Read the small revision metadata and pin the identities of its three files."""

    def __init__(
        self,
        directory,
    ):
        """Resolve eligible pairs from the verified inventory and completion manifest."""
        self.directory = Path(directory)
        self.manifest_path = self.directory / "complete.json"
        self.inventory_path = self.directory / "inventory.json"
        self.graph_path = self.directory / "graph.jsonl"
        self.identities = {
            path: _file_identity(path.stat())
            for path in (self.manifest_path, self.inventory_path, self.graph_path)
        }
        manifest = read_json(self.manifest_path)
        inventory = read_json(self.inventory_path)
        if not isinstance(manifest, dict) or not isinstance(inventory, dict):
            raise ValueError("Invalid graph revision metadata.")
        self.revision = digest(inventory)
        counts = [manifest.get(key) for key in ("complete", "empty", "pending", "failed")]
        self.graph_bytes = manifest.get("graph_bytes")
        self.graph_sha256 = manifest.get("graph_sha256")
        totals = manifest.get("totals")
        if isinstance(totals, dict):
            self.connection_count = totals.get("retained_connections")
        else:
            self.connection_count = None
        if (
            manifest.get("revision") != self.revision
            or self.directory.name != self.revision
            or type(inventory.get("format")) is not int
            or inventory["format"] != GRAPH_FORMAT
            or any(type(count) is not int or count < 0 for count in counts)
            or counts[2] != 0
            or counts[3] != 0
            or type(self.graph_bytes) is not int
            or self.graph_bytes != self.identities[self.graph_path][2]
            or not _is_sha256(self.graph_sha256)
            or type(self.connection_count) is not int
            or self.connection_count < 0
        ):
            raise ValueError("Graph has no complete matching revision.")
        variants = inventory.get("inventory")
        self.pairs = self._eligible_pairs(variants, manifest.get("variants"))
        self.variants = {
            variant_id: (code, ewkb)
            for variant_id, code, _, ewkb in variants
        }
        self.complete_pairs, self.empty_pairs = counts[:2]
        if (
            manifest.get("eligible_pairs") != len(self.pairs)
            or self.complete_pairs + self.empty_pairs != len(self.pairs)
        ):
            raise ValueError("Graph manifest pair counts disagree with its inventory.")
        self.check_current()

    @staticmethod
    def _eligible_pairs(
        inventory,
        expected_variants,
    ):
        """Apply the graph builder's ordered geometry and route-code eligibility rules."""
        if not isinstance(inventory, list) or len(inventory) != expected_variants:
            raise ValueError("Invalid graph variant inventory.")
        variants = []
        for expected_id, row in enumerate(inventory, start=1):
            if not isinstance(row, list) or len(row) != 4:
                raise ValueError("Invalid graph variant inventory entry.")
            variant_id, code, key, ewkb = row
            if (
                type(variant_id) is not int
                or variant_id != expected_id
                or not isinstance(code, str)
                or not isinstance(key, str)
                or not isinstance(ewkb, str)
            ):
                raise ValueError("Invalid graph variant inventory entry.")
            try:
                geometry = GEOSGeometry(memoryview(bytes.fromhex(ewkb)))
            except (GEOSException, ValueError, TypeError) as error:
                raise ValueError("Invalid geometry in graph variant inventory.") from error
            if geometry.geom_type != "LineString" or geometry.srid != 4326 or geometry.empty:
                raise ValueError("Invalid geometry in graph variant inventory.")
            variants.append((variant_id, code, geometry))
        return [
            (source, target)
            for (source, source_code, source_geometry), (target, target_code, target_geometry)
            in combinations(variants, 2)
            if source_code != target_code and not source_geometry.equals_exact(target_geometry)
        ]

    def check_current(self):
        """Reject an artifact set modified while the index was loaded or used."""
        for path, expected in self.identities.items():
            if _file_identity(path.stat()) != expected:
                raise ValueError("Graph artifacts changed. Reload the graph index.")

    def check_graph_handle(
        self,
        source,
    ):
        """Ensure the opened descriptor still refers to the pinned graph."""
        if _file_identity(os.fstat(source.fileno())) != self.identities[self.graph_path]:
            raise ValueError("Graph file changed. Reload the graph index.")

    def binding(self):
        """Return the graph metadata that the index must match."""
        return {
            "format": INDEX_FORMAT,
            "revision": self.revision,
            "graph_sha256": self.graph_sha256,
            "graph_bytes": self.graph_bytes,
            "connection_count": self.connection_count,
        }


def _checkpoint_rows(
    source,
    pair,
):
    """Verify one bounded checkpoint against its original checksum and identity."""
    path = source.directory / f"{pair[0]}-{pair[1]}.json"
    payload = read_json(path)
    if not isinstance(payload, dict) or payload.pop("checksum", None) != digest(payload):
        raise ValueError(f"Invalid graph checkpoint checksum for {pair}.")
    rows = payload.get("connections")
    if not isinstance(rows, list) or len(rows) > PAIR_RETAINED_CONNECTIONS:
        raise ValueError(f"Invalid graph checkpoint rows for {pair}.")
    progress = payload.get("progress")
    state = "complete" if rows else "empty"
    if (
        payload.get("revision") != source.revision
        or payload.get("pair") != list(pair)
        or payload.get("state") != state
        or not isinstance(progress, dict)
        or "stop_reason" not in progress
        or progress["stop_reason"] is not None
        or progress.get("retained_connections") != len(rows)
    ):
        raise ValueError(f"Invalid graph checkpoint completion for {pair}.")
    return rows


def _build_entries(source):
    """Verify JSONL parity with every checkpoint and emit one entry per direction."""
    expected = {f"{first}-{second}.json" for first, second in source.pairs}
    actual = {
        path.name
        for path in source.directory.glob("*.json")
        if path.name not in {"inventory.json", "complete.json"}
    }
    if actual != expected:
        raise ValueError("Graph checkpoint inventory mismatch.")

    graph_hash = hashlib.sha256()
    entries = []
    offset = 0
    complete_pairs = 0
    with source.graph_path.open("rb") as graph:
        source.check_graph_handle(graph)
        for first, second in source.pairs:
            pair = (first, second)
            rows = _checkpoint_rows(source, pair)
            complete_pairs += bool(rows)
            records = iter(rows)
            row = next(records, None)
            for direction in (pair, pair[::-1]):
                start = offset
                count = 0
                previous = None
                block_hash = hashlib.sha256()
                while isinstance(row, list) and row[:2] == list(direction):
                    order = _record_order(row, direction)
                    if previous is not None and order <= previous:
                        raise ValueError(f"Duplicate or unordered graph connection in {direction}.")
                    previous = order
                    expected_line = (json.dumps(row, separators=(",", ":")) + "\n").encode()
                    line = graph.read(len(expected_line))
                    if line != expected_line:
                        raise ValueError(f"Graph disagrees with its checkpoint for {direction}.")
                    offset += len(line)
                    count += 1
                    block_hash.update(line)
                    graph_hash.update(line)
                    row = next(records, None)
                entries.append([*direction, start, offset - start, count, block_hash.hexdigest()])
            if row is not None or sum(entry[4] for entry in entries[-2:]) != len(rows):
                raise ValueError(f"Invalid directional order in graph checkpoint for {pair}.")
        if graph.read(1) or graph_hash.hexdigest() != source.graph_sha256:
            raise ValueError("Graph checksum or byte coverage mismatch.")
        source.check_graph_handle(graph)
    if complete_pairs != source.complete_pairs:
        raise ValueError("Graph checkpoints disagree with manifest completion counts.")
    return entries


def _validate_entries(
    source,
    entries,
):
    """Require exact eligible directions and contiguous, complete graph byte coverage."""
    if not isinstance(entries, list) or len(entries) != len(source.pairs) * 2:
        raise ValueError("Index directional pair count disagrees with graph inventory.")
    blocks = {}
    offset = 0
    total_count = 0
    complete_pairs = 0
    entry_iter = iter(entries)
    for pair in source.pairs:
        pair_count = 0
        for direction in (pair, pair[::-1]):
            entry = next(entry_iter)
            if not isinstance(entry, list) or len(entry) != 6:
                raise ValueError("Invalid directional graph index entry.")
            first, second, start, length, count, sha256 = entry
            if (
                any(type(value) is not int for value in entry[:5])
                or (first, second) != direction
                or start != offset
                or not 0 <= length <= ARTIFACT_BYTES
                or not 0 <= count <= PAIR_RETAINED_CONNECTIONS
                or bool(length) != bool(count)
                or length < count
                or not _is_sha256(sha256)
                or (sha256 == EMPTY_SHA256) != (count == 0)
            ):
                raise ValueError(f"Invalid directional graph index entry for {direction}.")
            blocks[direction] = DirectedConnectionBlock(start, length, count, sha256)
            offset += length
            pair_count += count
        if pair_count > PAIR_RETAINED_CONNECTIONS:
            raise ValueError(f"Indexed graph pair exceeds the checkpoint limit for {pair}.")
        total_count += pair_count
        complete_pairs += bool(pair_count)
    if (
        offset != source.graph_bytes
        or total_count != source.connection_count
        or complete_pairs != source.complete_pairs
    ):
        raise ValueError("Index does not cover the completed graph.")
    return blocks


class DevelopmentConnectionGraphIndex:
    """Read verified directed connection ranges for isolated development searches."""

    def __init__(
        self,
        directory: str | Path,
    ):
        """Load compact index metadata without reading the graph or checkpoints."""
        self._source = _GraphSource(directory)
        payload = read_json(self._source.directory / INDEX_NAME)
        if not isinstance(payload, dict) or payload.pop("checksum", None) != digest(payload):
            raise ValueError("Graph index checksum mismatch.")
        if any(
            type(payload.get(key)) is not type(value) or payload[key] != value
            for key, value in self._source.binding().items()
        ):
            raise ValueError("Graph index has a stale or incompatible revision.")
        self._blocks = _validate_entries(self._source, payload.get("pairs"))
        self._source.check_current()

    @property
    def revision(self):
        """Identify the inventory and graph revision pinned by this reader."""
        return self._source.revision

    def nonempty_pairs(self):
        """Expose directed connectivity using only the validated block metadata."""
        self._source.check_current()
        return (
            pair
            for pair, block in self._blocks.items()
            if block.count
        )

    def validate_network(
        self,
        *,
        route_geometries,
        route_codes,
    ):
        """Require every supplied variant to match its identity in this revision."""
        self._source.check_current()
        for variant_id, geometry in route_geometries.items():
            identity = (route_codes[variant_id], geometry.hexewkb.decode())
            if self._source.variants.get(variant_id) != identity:
                raise ValueError(f"Route variant {variant_id} does not match the graph revision.")

    @classmethod
    def publish(
        cls,
        directory: str | Path,
    ):
        """Verify the original graph offline and atomically publish its sidecar."""
        source = _GraphSource(directory)
        entries = _build_entries(source)
        _validate_entries(source, entries)
        payload = source.binding()
        payload["pairs"] = entries
        payload["checksum"] = digest(payload)

        target = source.directory / INDEX_NAME
        temporary = None
        try:
            with NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                dir=source.directory,
                prefix=f"{INDEX_NAME}.",
                suffix=".tmp",
                delete=False,
            ) as handle:
                temporary = Path(handle.name)
                json.dump(payload, handle, separators=(",", ":"), allow_nan=False)
                handle.flush()
                os.fsync(handle.fileno())
            source.check_current()
            os.replace(temporary, target)
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)
        return {
            **source.binding(),
            "directed_pairs": len(entries),
            "empty_directions": sum(entry[4] == 0 for entry in entries),
            "index_bytes": target.stat().st_size,
        }

    def block(
        self,
        from_variant_id: int,
        to_variant_id: int,
    ) -> DirectedConnectionBlock:
        """Return range metadata or raise KeyError for an ineligible or unknown direction."""
        pair = (from_variant_id, to_variant_id)
        if any(type(variant_id) is not int for variant_id in pair):
            raise KeyError(pair)
        return self._blocks[pair]

    def read_block(
        self,
        from_variant_id: int,
        to_variant_id: int,
    ) -> bytes:
        """Read one bounded byte range and verify its checksum before parsing records."""
        block = self.block(from_variant_id, to_variant_id)
        self._source.check_current()
        if block.count == 0:
            return b""
        with self._source.graph_path.open("rb", buffering=0) as source:
            self._source.check_graph_handle(source)
            source.seek(block.offset)
            raw = source.read(block.length)
            self._source.check_graph_handle(source)
        if (
            len(raw) != block.length
            or not raw.endswith(b"\n")
            or raw.count(b"\n") != block.count
            or hashlib.sha256(raw).hexdigest() != block.sha256
        ):
            raise ValueError("Indexed graph block failed integrity verification.")
        return raw

    def connections(
        self,
        from_variant_id: int,
        to_variant_id: int,
        *,
        earliest_alighting: float | None = None,
        latest_boarding: float | None = None,
    ) -> Iterator[RouteConnection]:
        """Yield original connections in graph order, reconstructing one object at a time."""
        raw = self.read_block(from_variant_id, to_variant_id)
        pair = (from_variant_id, to_variant_id)
        previous = None
        for line in io.BytesIO(raw):
            row = json.loads(line)
            order = _record_order(row, pair)
            if previous is not None and order <= previous:
                raise ValueError("Duplicate or unordered connection in indexed graph block.")
            previous = order
            source, target, alighting, alighting_point, boarding, boarding_point, distance, status = row
            # Keep whole runtime evidence groups at either boundary so precedence
            # can choose the same winner before the caller applies exact fractions.
            if (
                earliest_alighting is not None
                and round(alighting, 12) < round(earliest_alighting, 12)
            ) or (
                latest_boarding is not None
                and round(boarding, 12) > round(latest_boarding, 12)
            ):
                continue
            yield RouteConnection(
                from_variant_id=source,
                to_variant_id=target,
                alighting_position=RoutePosition(_point(alighting_point), alighting),
                boarding_position=RoutePosition(_point(boarding_point), boarding),
                straight_line_distance_meters=distance,
                validation_status=TransferValidationStatus(status),
            )
