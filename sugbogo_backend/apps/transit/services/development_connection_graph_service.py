"""Generate revision-bound development connection artifacts without importing transit rows."""

import hashlib
import json
import math
import os
import time
import tracemalloc
from contextlib import contextmanager
from dataclasses import asdict
from itertools import combinations
from pathlib import Path

from django.contrib.gis.geos import GEOSGeometry
from django.db import connection, transaction

from apps.transit.management.commands.seed_cebu_city_transit import (
    MAX_DATASET_BYTES,
    reject_nonfinite_constant,
    unique_object,
)
from apps.transit.serializers.transit_seed_serializers import TransitSeedDatasetSerializer
from apps.transit.services import coordinate_route_matching_service, route_connection_service
from apps.transit.services.coordinate_route_matching_service import RoutePosition
from apps.transit.services.route_connection_service import (
    RouteConnection,
    RouteConnectionDiscoveryProgress,
    RouteConnectionService,
    TransferValidationStatus,
)
from apps.transit.services.transit_seed_service import TransitSeedService
from apps.transit.services.transit_spatial_validation_service import TransitSpatialValidationService

# Additional development build ceilings are independent of the existing discovery budgets.
PAIR_EXACT_CHECKS = 100_000
PAIR_GENERATED_POSITIONS = 250_000
PAIR_RETAINED_CONNECTIONS = 50_000
PAIR_PYTHON_BYTES = 128 * 1024 * 1024
PAIR_SECONDS = 30
ARTIFACT_BYTES = 32 * 1024 * 1024


def digest(value):
    """Hash canonical, finite JSON for revisions and checkpoint integrity."""
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
    ).hexdigest()


def read_json(path):
    """Reject oversized, partial, duplicate-key or non-finite JSON artifacts."""
    with path.open("rb") as source:
        raw = source.read(ARTIFACT_BYTES + 1)
    if len(raw) > ARTIFACT_BYTES:
        raise ValueError("Artifact exceeds the development size limit.")
    return json.loads(
        raw.decode("utf-8-sig"),
        object_pairs_hook=unique_object,
        parse_constant=reject_nonfinite_constant,
    )


def write_json(
    path,
    value,
):
    """Replace an artifact atomically after flushing its complete contents."""
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8") as target:
        json.dump(value, target, separators=(",", ":"), allow_nan=False)
        target.flush()
        os.fsync(target.fileno())
    os.replace(temporary, path)


def connection_record(link):
    """Serialize original directional positions without rounding their measures."""
    return [
        link.from_variant_id,
        link.to_variant_id,
        link.alighting_position.fraction,
        link.alighting_position.point.ewkt,
        link.boarding_position.fraction,
        link.boarding_position.point.ewkt,
        link.straight_line_distance_meters,
        link.validation_status.value,
    ]


class DevelopmentConnectionGraphService:
    """Build and validate one pair at a time in ignored development artifacts."""

    def __init__(
        self,
        *,
        dataset,
        confirmation,
    ):
        """Validate a bounded seed envelope and fingerprint its ordered directional inputs."""
        TransitSeedService.validate_database(confirmation)
        dataset = Path(dataset)
        if dataset.stat().st_size > MAX_DATASET_BYTES:
            raise ValueError("Dataset exceeds the 8 MiB limit.")
        serializer = TransitSeedDatasetSerializer(data=read_json(dataset))
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        entries = sorted(
            (
                route["code"],
                variant["key"],
                variant["geometry"],
            )
            for route in data["routes"]
            for variant in route["variants"]
        )
        self.routes = {}
        self.codes = {}
        self.inventory = []
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute("SET TRANSACTION READ ONLY")
                cursor.execute("SET LOCAL statement_timeout = '5s'")
            boundary = TransitSpatialValidationService.boundary()
            for index, (code, key, coordinates) in enumerate(entries, start=1):
                geometry = TransitSpatialValidationService.build_geometry(coordinates)
                TransitSpatialValidationService.validate_geometry(geometry, boundary)
                self.routes[index] = geometry
                self.codes[index] = code
                self.inventory.append([index, code, key, geometry.hexewkb.decode()])
        self.pairs = [
            pair
            for pair in combinations(self.routes, 2)
            if (
                self.codes[pair[0]] != self.codes[pair[1]]
                and not self.routes[pair[0]].equals_exact(self.routes[pair[1]])
            )
        ]
        with connection.cursor() as cursor:
            cursor.execute("SELECT PostGIS_Full_Version()")
            spatial_version = cursor.fetchone()[0]
        self.parameters = {
            "format": 1,
            "inventory": self.inventory,
            "boundary": boundary.hexewkb.decode(),
            "spatial_version": spatial_version,
            "discovery_source": hashlib.sha256(
                Path(route_connection_service.__file__).read_bytes()
            ).hexdigest(),
            "matching_source": hashlib.sha256(
                Path(coordinate_route_matching_service.__file__).read_bytes()
            ).hexdigest(),
            "builder_source": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            "limits": [
                PAIR_EXACT_CHECKS,
                PAIR_GENERATED_POSITIONS,
                PAIR_RETAINED_CONNECTIONS,
                PAIR_PYTHON_BYTES,
                PAIR_SECONDS,
            ],
        }
        self.revision = digest(self.parameters)
        self.directory = (
            Path(__file__).resolve().parents[3]
            / ".connection-graphs"
            / self.revision
        )

    def pair_path(
        self,
        pair,
    ):
        """Address each unordered variant pair once while retaining both transfer directions."""
        return self.directory / f"{pair[0]}-{pair[1]}.json"

    def validated_pair(
        self,
        pair,
    ):
        """Verify a checkpoint's revision, digest, counts, fractions and deterministic identity."""
        payload = read_json(self.pair_path(pair))
        if not isinstance(payload, dict):
            raise ValueError("Checkpoint must contain an object.")
        checksum = payload.pop("checksum")
        if checksum != digest(payload):
            raise ValueError("Checkpoint checksum mismatch.")
        if payload["revision"] != self.revision or payload["pair"] != list(pair):
            raise ValueError("Checkpoint input mismatch.")
        rows = payload["connections"]
        expected_state = "complete" if rows else "empty"
        if payload["state"] != expected_state:
            raise ValueError("Pair has no valid completion.")
        stats = payload["progress"]
        if (
            stats["stop_reason"] is not None
            or stats["retained_connections"] != len(rows)
            or stats["accepted_segment_pairs"] > route_connection_service.MAXIMUM_CONNECTION_SEGMENT_PAIRS
            or stats["broad_phase_work"] > route_connection_service.MAXIMUM_CONNECTION_BROAD_PHASE_WORK
            or stats["exact_spatial_checks"] > PAIR_EXACT_CHECKS
            or stats["generated_connection_positions"] > PAIR_GENERATED_POSITIONS
            or len(rows) > PAIR_RETAINED_CONNECTIONS
        ):
            raise ValueError("Checkpoint counts exceed its limits.")
        previous = None
        identities = set()
        for row in rows:
            source, target, alighting, a_wkt, boarding, b_wkt, distance, status = row
            if (
                {source, target} != set(pair)
                or not 0 < alighting <= 1
                or not 0 <= boarding < 1
                or not math.isfinite(distance)
                or not 0 <= distance <= 120
                or status != TransferValidationStatus.PROVISIONAL
            ):
                raise ValueError("Invalid directed connection.")
            for variant, fraction, wkt in (
                (source, alighting, a_wkt),
                (target, boarding, b_wkt),
            ):
                point = GEOSGeometry(wkt)
                if (
                    point.geom_type != "Point"
                    or point.srid != 4326
                    or not self.routes[variant].interpolate_normalized(fraction).equals_exact(
                        point, tolerance=1e-8,
                    )
                ):
                    raise ValueError("Point disagrees with its ordered route position.")
            order = (source, target, alighting, boarding, distance)
            # SQL numeric rounding and Python float rounding differ at bucket boundaries.
            # Preserve every distinct fraction pair returned by discovery.
            identity = (source, target, alighting, boarding)
            if identity in identities or (previous is not None and order < previous):
                raise ValueError("Duplicate or unordered connection.")
            identities.add(identity)
            previous = order
        return payload

    def generate_pair(
        self,
        pair,
    ):
        """Generate one read-only pair under SQL, Python and discovery resource ceilings."""
        progress = RouteConnectionDiscoveryProgress()
        started = time.monotonic()
        tracemalloc.start()

        def enforce(
            execute,
            sql,
            params,
            many,
            context,
        ):
            """Stop SQL submission once a pair reaches its time, memory or exact-check ceiling."""
            if (
                time.monotonic() - started > PAIR_SECONDS
                or tracemalloc.get_traced_memory()[1] > PAIR_PYTHON_BYTES
                or progress.exact_spatial_checks > PAIR_EXACT_CHECKS
            ):
                raise ValueError("Pair resource budget exhausted.")
            return execute(sql, params, many, context)

        try:
            with transaction.atomic(), connection.execute_wrapper(enforce):
                with connection.cursor() as cursor:
                    cursor.execute("SET TRANSACTION READ ONLY")
                    cursor.execute("SET LOCAL statement_timeout = '5s'")
                    cursor.execute("SET LOCAL work_mem = '16MB'")
                    cursor.execute("SET LOCAL temp_file_limit = '128MB'")
                links = RouteConnectionService.discover(
                    route_geometries=self.routes,
                    route_codes=self.codes,
                    variant_pair=pair,
                    progress=progress,
                )
            elapsed = time.monotonic() - started
            peak = tracemalloc.get_traced_memory()[1]
            if (
                elapsed > PAIR_SECONDS
                or peak > PAIR_PYTHON_BYTES
                or progress.exact_spatial_checks > PAIR_EXACT_CHECKS
                or progress.generated_connection_positions > PAIR_GENERATED_POSITIONS
                or len(links) > PAIR_RETAINED_CONNECTIONS
            ):
                raise ValueError("Pair resource budget exhausted.")
            return {
                "revision": self.revision,
                "pair": list(pair),
                "state": "complete" if links else "empty",
                "connections": [connection_record(link) for link in links],
                "progress": asdict(progress),
                "seconds": elapsed,
                "python_peak_bytes": peak,
            }
        finally:
            tracemalloc.stop()

    @contextmanager
    def build_lock(self):
        """Use an OS advisory lock that is released automatically after process interruption."""
        lock = (self.directory / "build.lock").open("a+b")
        lock.seek(0)
        lock.write(b"0")
        lock.flush()
        lock.seek(0)
        try:
            if os.name == "nt":
                import msvcrt
                msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            yield
        finally:
            lock.close()

    def build(
        self,
        *,
        maximum_pairs=None,
    ):
        """Resume verified pairs and publish an atomic manifest only after complete assembly."""
        self.directory.mkdir(parents=True, exist_ok=True)
        with self.build_lock():
            return self._build(maximum_pairs)

    def _build(
        self,
        maximum_pairs,
    ):
        """Checkpoint attempts incrementally and stream the graph through a second validation pass."""
        started = time.monotonic()
        published = self.directory / "complete.json"
        published.unlink(missing_ok=True)
        expected = {self.pair_path(pair).name for pair in self.pairs}
        unexpected = {
            path.name
            for path in self.directory.glob("*.json")
            if path.name not in expected and path.name != "inventory.json"
        }
        if unexpected:
            raise ValueError("Unexpected or duplicate checkpoint files.")
        write_json(self.directory / "inventory.json", self.parameters)
        states = {}
        reused = 0
        attempted = 0
        for pair in self.pairs:
            path = self.pair_path(pair)
            try:
                payload = self.validated_pair(pair)
                reused += 1
            except (OSError, ValueError, KeyError, TypeError):
                if maximum_pairs is not None and attempted >= maximum_pairs:
                    states[path.name] = "pending"
                    continue
                attempted += 1
                try:
                    payload = self.generate_pair(pair)
                    payload["checksum"] = digest(payload)
                    write_json(path, payload)
                    payload = self.validated_pair(pair)
                except Exception as error:
                    write_json(path, {
                        "revision": self.revision,
                        "pair": list(pair),
                        "state": "failed",
                        "error": f"{type(error).__name__}: {error}",
                    })
                    states[path.name] = "failed"
                    break
            states[path.name] = payload["state"]
        counts = {
            state: sum(value == state for value in states.values())
            for state in ("complete", "empty", "failed")
        }
        counts["pending"] = len(self.pairs) - sum(counts.values())
        result = {
            "revision": self.revision,
            "variants": len(self.routes),
            "eligible_pairs": len(self.pairs),
            **counts,
            "reused_pairs": reused,
            "attempted_pairs": attempted,
        }
        if counts["pending"] or counts["failed"]:
            result["seconds"] = time.monotonic() - started
            return result
        validation_started = time.monotonic()
        totals = {}
        maximum_seconds = 0
        maximum_memory = 0
        graph = self.directory / "graph.jsonl"
        temporary = graph.with_suffix(".tmp")
        graph_digest = hashlib.sha256()
        with temporary.open("wb") as target:
            for pair in self.pairs:
                payload = self.validated_pair(pair)
                maximum_seconds = max(maximum_seconds, payload["seconds"])
                maximum_memory = max(maximum_memory, payload["python_peak_bytes"])
                for key, value in payload["progress"].items():
                    if isinstance(value, int):
                        totals[key] = totals.get(key, 0) + value
                for row in payload["connections"]:
                    line = (json.dumps(row, separators=(",", ":")) + "\n").encode()
                    target.write(line)
                    graph_digest.update(line)
            target.flush()
            os.fsync(target.fileno())
        os.replace(temporary, graph)
        result.update({
            "totals": totals,
            "maximum_pair_seconds": maximum_seconds,
            "maximum_pair_python_bytes": maximum_memory,
            "validation_assembly_seconds": time.monotonic() - validation_started,
            "seconds": time.monotonic() - started,
            "graph_bytes": graph.stat().st_size,
            "graph_sha256": graph_digest.hexdigest(),
        })
        write_json(published, result)
        result["artifact_bytes"] = sum(path.stat().st_size for path in self.directory.iterdir())
        return result

    def connections(self):
        """Stream a fully verified graph for isolated searches without connecting it to Explorer."""
        manifest = read_json(self.directory / "complete.json")
        if (
            manifest["revision"] != self.revision
            or manifest["pending"]
            or manifest["failed"]
            or manifest["complete"] + manifest["empty"] != len(self.pairs)
        ):
            raise ValueError("Graph has no complete matching revision.")
        graph = self.directory / "graph.jsonl"
        hasher = hashlib.sha256()
        with graph.open("rb") as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b""):
                hasher.update(chunk)
        if hasher.hexdigest() != manifest["graph_sha256"]:
            raise ValueError("Graph checksum mismatch.")
        expected = {self.pair_path(pair).name for pair in self.pairs}
        actual = {
            path.name
            for path in self.directory.glob("*.json")
            if path.name not in {"inventory.json", "complete.json"}
        }
        if actual != expected:
            raise ValueError("Graph checkpoint inventory mismatch.")
        for pair in self.pairs:
            self.validated_pair(pair)
        with graph.open("r", encoding="utf-8") as source:
            for line in source:
                row = json.loads(line)
                a, b, af, ap, bf, bp, distance, status = row
                yield RouteConnection(
                    from_variant_id=a,
                    to_variant_id=b,
                    alighting_position=RoutePosition(GEOSGeometry(ap), af),
                    boarding_position=RoutePosition(GEOSGeometry(bp), bf),
                    straight_line_distance_meters=distance,
                    validation_status=TransferValidationStatus(status),
                )

