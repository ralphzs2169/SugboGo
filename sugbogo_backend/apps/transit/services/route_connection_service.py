"""Discover provisional connections between directional route centerlines."""

import math
from collections import defaultdict
from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from itertools import combinations, islice

from django.contrib.gis.geos import GEOSGeometry, LineString
from django.db import connection
from rest_framework.exceptions import ValidationError

from apps.transit.services.coordinate_route_matching_service import (
    ROUTES_CTE,
    ROUTE_SEGMENTS_CTES,
    RoutePosition,
    route_query_parameters,
    valid_route_geometries,
    validate_distance,
)

MAXIMUM_PROVISIONAL_TRANSFER_DISTANCE_METERS = 120.0
CONNECTION_AREA_METERS = 75.0
MAXIMUM_CANDIDATES_PER_AREA = 6
MAXIMUM_CONNECTION_SEGMENT_PAIRS = 20_000
# Count cheap grid memberships/scans separately from the unchanged exact-pair cap.
MAXIMUM_CONNECTION_BROAD_PHASE_WORK = 2_000_000
EXACT_CHECK_BATCH_SIZE = 2_048


@dataclass
class RouteConnectionDiscoveryProgress:
    """Count completed discovery work independently of itinerary expansion."""

    route_pair_candidates: int = 0
    segment_count: int = 0
    broad_phase_work: int = 0
    broad_phase_segment_candidates: int = 0
    exact_spatial_checks: int = 0
    accepted_segment_pairs: int = 0
    generated_connection_positions: int = 0
    retained_connection_areas: int = 0
    retained_connections: int = 0
    stop_reason: str | None = None


@dataclass(frozen=True)
class _Segment:
    """Preserve the original variant and vertex index through the broad phase."""

    variant_id: int
    vertex_index: int
    ewkt: str
    envelope: tuple[float, float, float, float]


def _segment_envelope(
    start,
    end,
    radius_meters,
):
    """Conservatively cover planar segments and WGS84 geodesics with padded bounds."""
    longitude_span = abs(start[0] - end[0])
    longitude_span = min(longitude_span, 360.0 - longitude_span)
    # A meridian/parallel path bounds the shortest WGS84 geodesic from above.
    # These radii bound WGS84 curvature below/above, rather than converting
    # longitude degrees to meters using a fixed equatorial scale.
    length_bound = 6_400_000.0 * math.radians(
        abs(start[1] - end[1]) + longitude_span
    )
    # Each geodesic point is within half its length of an endpoint. Padding
    # both envelopes by half the transfer radius also covers nearby arcs.
    latitude_pad = math.degrees(
        (length_bound / 2.0 + radius_meters / 2.0) / 6_300_000.0
    ) + 1e-10
    maximum_latitude = min(
        90.0,
        max(abs(start[1]), abs(end[1])) + latitude_pad,
    )
    if maximum_latitude >= 90.0:
        longitude_pad = 180.0
    else:
        longitude_pad = min(
            180.0,
            latitude_pad / math.cos(math.radians(maximum_latitude)),
        )
    minimum_longitude = min(start[0], end[0]) - longitude_pad
    maximum_longitude = max(start[0], end[0]) + longitude_pad
    if minimum_longitude < -180.0 or maximum_longitude > 180.0:
        # Wrapped/polar bounds remain conservative; the work budget prevents
        # unusually large envelopes from allocating an unbounded grid.
        minimum_longitude = -180.0
        maximum_longitude = 180.0
    return (
        minimum_longitude,
        max(-90.0, min(start[1], end[1]) - latitude_pad),
        maximum_longitude,
        min(90.0, max(start[1], end[1]) + latitude_pad),
    )


def _charge_broad_phase(
    progress,
    amount,
    maximum_work,
):
    """Stop before large grid spans, bucket scans or envelope comparisons grow unchecked."""
    if progress.broad_phase_work + amount > maximum_work:
        progress.stop_reason = "broad_phase_budget"
        raise RouteConnectionBudgetExceeded(reason="broad_phase_budget")
    progress.broad_phase_work += amount


def _candidate_segment_pairs(
    segments,
    eligible_route_pairs,
    radius_meters,
    maximum_work,
    progress,
):
    """Stream unique envelope-overlapping pairs from a bounded conservative grid."""
    step = math.degrees(radius_meters / 6_300_000.0)
    grid = defaultdict(list)
    for segment_id, segment in enumerate(segments):
        minimum_x, minimum_y, maximum_x, maximum_y = (
            math.floor(value / step)
            for value in segment.envelope
        )
        cell_count = (
            (maximum_x - minimum_x + 1)
            * (maximum_y - minimum_y + 1)
        )
        _charge_broad_phase(progress, cell_count, maximum_work)
        nearby = set()
        for x in range(minimum_x, maximum_x + 1):
            for y in range(minimum_y, maximum_y + 1):
                bucket = grid[x, y]
                _charge_broad_phase(progress, len(bucket), maximum_work)
                nearby.update(bucket)
                bucket.append(segment_id)
        _charge_broad_phase(progress, len(nearby), maximum_work)
        for other_id in sorted(nearby):
            other = segments[other_id]
            if (other.variant_id, segment.variant_id) not in eligible_route_pairs:
                continue
            a = other.envelope
            b = segment.envelope
            if (
                a[0] <= b[2]
                and a[2] >= b[0]
                and a[1] <= b[3]
                and a[3] >= b[1]
            ):
                progress.broad_phase_segment_candidates += 1
                yield other_id, segment_id


def _exact_segment_pairs(
    segments,
    candidates,
    radius_meters,
    maximum_segment_pairs,
    progress,
):
    """Verify bounded batches with the original exact planar/geographic predicates."""
    accepted = []
    iterator = iter(candidates)
    while batch := list(islice(iterator, EXACT_CHECK_BATCH_SIZE)):
        identifiers = sorted({
            identifier
            for pair in batch
            for identifier in pair
        })
        with connection.cursor() as cursor:
            cursor.execute(
                """
                WITH segments AS MATERIALIZED (
                    SELECT id, ST_GeomFromEWKT(wkt) AS geometry
                    FROM unnest(%s::bigint[], %s::text[]) AS input(id, wkt)
                ),
                checked AS MATERIALIZED (
                    SELECT input.a_id, input.b_id, input.ordinality,
                        ST_Intersects(a.geometry, b.geometry)
                        OR ST_DWithin(a.geometry::geography, b.geometry::geography, %s) AS eligible
                    FROM unnest(%s::bigint[], %s::bigint[]) WITH ORDINALITY AS input(a_id, b_id, ordinality)
                    JOIN segments a ON a.id = input.a_id
                    JOIN segments b ON b.id = input.b_id
                )
                SELECT a_id, b_id FROM checked WHERE eligible ORDER BY ordinality
                """,
                [
                    identifiers,
                    [segments[identifier].ewkt for identifier in identifiers],
                    radius_meters,
                    [pair[0] for pair in batch],
                    [pair[1] for pair in batch],
                ],
            )
            rows = cursor.fetchall()
        progress.exact_spatial_checks += len(batch)
        progress.accepted_segment_pairs += len(rows)
        if progress.accepted_segment_pairs > maximum_segment_pairs:
            progress.stop_reason = "segment_pair_budget"
            raise RouteConnectionBudgetExceeded()
        accepted.extend(rows)
    return accepted


class RouteConnectionBudgetExceeded(ValidationError):
    """Signal that discovery could not finish within a bounded processing limit."""

    def __init__(
        self,
        *,
        reason="segment_pair_budget",
    ):
        """Keep segment-budget errors compatible and identify earlier broad-phase stops."""
        self.reason = reason
        if reason == "broad_phase_budget":
            message = "The connection search exceeded its spatial broad-phase budget."
        else:
            message = "The connection search exceeded its segment-pair budget."
        super().__init__({
            "connections": message,
        })


class TransferValidationStatus(StrEnum):
    """Describe the available pedestrian evidence for a directed connection."""

    PROVISIONAL = "provisional"
    PEDESTRIAN_VALIDATED = "pedestrian_validated"
    NON_WALKABLE = "non_walkable"


@dataclass(frozen=True)
class RouteConnection:
    """A directed pair of centerline positions with an explicit pedestrian status."""

    from_variant_id: int
    to_variant_id: int
    alighting_position: RoutePosition
    boarding_position: RoutePosition
    straight_line_distance_meters: float
    validation_status: TransferValidationStatus


class RouteConnectionService:
    """Find separate geometric connection areas along both routes' ordered measures."""

    @staticmethod
    def discover(
        *,
        route_geometries: Mapping[int, LineString],
        route_codes: Mapping[int, str] | None = None,
        maximum_transfer_distance_meters: float = MAXIMUM_PROVISIONAL_TRANSFER_DISTANCE_METERS,
        connection_area_meters: float = CONNECTION_AREA_METERS,
        maximum_candidates_per_area: int = MAXIMUM_CANDIDATES_PER_AREA,
        maximum_segment_pairs: int = MAXIMUM_CONNECTION_SEGMENT_PAIRS,
        maximum_broad_phase_work: int = MAXIMUM_CONNECTION_BROAD_PHASE_WORK,
        progress: RouteConnectionDiscoveryProgress | None = None,
    ) -> list[RouteConnection]:
        """Return provisional candidates with bounded sampling and per-area retention."""
        validate_distance("maximum_transfer_distance_meters", maximum_transfer_distance_meters)
        validate_distance("connection_area_meters", connection_area_meters)
        for field, limit in (
            ("maximum_candidates_per_area", maximum_candidates_per_area),
            ("maximum_segment_pairs", maximum_segment_pairs),
            ("maximum_broad_phase_work", maximum_broad_phase_work),
        ):
            if type(limit) is not int or limit < 1:
                raise ValidationError({field: "Provide a positive integer."})
        routes = valid_route_geometries(route_geometries)
        if progress is None:
            progress = RouteConnectionDiscoveryProgress()
        if len(routes) < 2:
            return []
        eligible_route_pairs = {
            (first, second)
            for first, second in combinations(sorted(routes), 2)
            if (
                not (
                    route_codes is not None
                    and route_codes.get(first) is not None
                    and route_codes.get(first) == route_codes.get(second)
                )
                and not routes[first].equals_exact(routes[second])
            )
        }
        progress.route_pair_candidates = len(eligible_route_pairs)
        if not eligible_route_pairs:
            return []
        segments = []
        for variant_id in sorted(routes):
            # Match the EWKT precision used by route_query_parameters and the
            # final PostGIS slicing query, including threshold-edge checks.
            coordinates = GEOSGeometry(routes[variant_id].ewkt).coords
            for vertex_index, (start, end) in enumerate(
                zip(coordinates, coordinates[1:]),
                start=1,
            ):
                if start == end:
                    continue
                segments.append(_Segment(
                    variant_id=variant_id,
                    vertex_index=vertex_index,
                    ewkt=(
                        f"SRID=4326;LINESTRING({start[0]} {start[1]},"
                        f"{end[0]} {end[1]})"
                    ),
                    envelope=_segment_envelope(start, end, maximum_transfer_distance_meters),
                ))
        progress.segment_count = len(segments)
        candidates = _candidate_segment_pairs(
            segments,
            eligible_route_pairs,
            maximum_transfer_distance_meters,
            maximum_broad_phase_work,
            progress,
        )
        accepted = _exact_segment_pairs(
            segments,
            candidates,
            maximum_transfer_distance_meters,
            maximum_segment_pairs,
            progress,
        )
        if not accepted:
            return []

        # Sample projected intervals as well as exact crossings so shared and parallel
        # stretches keep candidate positions between their endpoints.
        query = f"""
            {ROUTES_CTE},
            {ROUTE_SEGMENTS_CTES},
            limits AS (
                SELECT %s::float8 AS radius_meters, %s::float8 AS area_meters
            ),
            route_measures AS MATERIALIZED (
                SELECT variant_id, ST_Length(geometry) AS length,
                    ST_Length(geometry::geography) AS meters
                FROM routes
            ),
            prepared_segments AS MATERIALIZED (
                SELECT measured_segments.*, ST_Length(geometry) AS length,
                    ST_Length(geometry::geography) AS meters
                FROM measured_segments
            ),
            accepted_pairs AS (
                SELECT * FROM unnest(%s::bigint[], %s::integer[], %s::bigint[], %s::integer[])
                    AS pairs(a_id, a_index, b_id, b_index)
            ),
            segment_pairs AS MATERIALIZED (
                SELECT
                    pairs.a_id, pairs.b_id,
                    a_route.length AS a_length, b_route.length AS b_length,
                    a_route.meters AS a_meters, b_route.meters AS b_meters,
                    a.geometry AS a_segment,
                    b.geometry AS b_segment,
                    a.length AS a_segment_length, b.length AS b_segment_length,
                    a.meters AS a_segment_meters, b.meters AS b_segment_meters,
                    a.length_before AS a_length_before,
                    b.length_before AS b_length_before
                FROM accepted_pairs AS pairs
                JOIN prepared_segments a ON a.variant_id = pairs.a_id AND a.vertex_index = pairs.a_index
                JOIN prepared_segments b ON b.variant_id = pairs.b_id AND b.vertex_index = pairs.b_index
                JOIN route_measures a_route ON a_route.variant_id = pairs.a_id
                JOIN route_measures b_route ON b_route.variant_id = pairs.b_id
            ),
            eligible_segment_pairs AS MATERIALIZED (
                SELECT * FROM segment_pairs
            ),
            candidate_points AS (
                SELECT pairs.*, points.a_point, points.b_point
                FROM eligible_segment_pairs AS pairs
                CROSS JOIN limits
                CROSS JOIN LATERAL (
                    SELECT ST_StartPoint(line) AS a_point, ST_EndPoint(line) AS b_point
                    FROM (SELECT ST_ShortestLine(pairs.a_segment, pairs.b_segment) AS line) closest
                    UNION ALL
                    SELECT
                        CASE WHEN sampling.on_a THEN sample.point ELSE projected.point END,
                        CASE WHEN sampling.on_a THEN projected.point ELSE sample.point END
                    FROM (VALUES
                        (TRUE, pairs.a_segment, pairs.b_segment, pairs.a_segment_meters),
                        (FALSE, pairs.b_segment, pairs.a_segment, pairs.b_segment_meters)
                    ) AS sampling(on_a, segment, other_segment, meters)
                    CROSS JOIN LATERAL (
                        SELECT
                            ST_LineLocatePoint(sampling.segment, ST_StartPoint(sampling.other_segment)) AS start,
                            ST_LineLocatePoint(sampling.segment, ST_EndPoint(sampling.other_segment)) AS finish
                    ) AS bounds
                    CROSS JOIN LATERAL (
                        SELECT LEAST(
                            64,
                            GREATEST(
                                1,
                                CEIL(
                                    ABS(bounds.finish - bounds.start)
                                    * sampling.meters
                                    / limits.area_meters
                                )
                            )
                        )::integer AS steps
                    ) AS intervals
                    CROSS JOIN LATERAL generate_series(0, intervals.steps) AS step(index)
                    CROSS JOIN LATERAL (
                        SELECT ST_LineInterpolatePoint(
                            sampling.segment,
                            CASE
                                WHEN step.index = 0 THEN bounds.start
                                WHEN step.index = intervals.steps THEN bounds.finish
                                ELSE bounds.start + (bounds.finish - bounds.start) * step.index / intervals.steps
                            END
                        ) AS point
                    ) AS sample
                    CROSS JOIN LATERAL (
                        SELECT ST_ClosestPoint(sampling.other_segment, sample.point) AS point
                    ) AS projected
                ) AS points
                WHERE ST_DWithin(points.a_point::geography, points.b_point::geography, limits.radius_meters)
            ),
            positioned AS MATERIALIZED (
                SELECT
                    a_id, b_id, a_point, b_point, a_meters, b_meters,
                    LEAST(
                        1.0,
                        (a_length_before + a_segment_length * ST_LineLocatePoint(a_segment, a_point))
                        / a_length
                    ) AS a_fraction,
                    LEAST(
                        1.0,
                        (b_length_before + b_segment_length * ST_LineLocatePoint(b_segment, b_point))
                        / b_length
                    ) AS b_fraction,
                    ST_Distance(a_point::geography, b_point::geography) AS distance_meters
                FROM candidate_points
            ),
            directed AS (
                SELECT
                    a_id AS from_id, b_id AS to_id, a_point AS alighting_point, b_point AS boarding_point,
                    a_fraction AS alighting_fraction, b_fraction AS boarding_fraction,
                    a_meters AS from_meters, b_meters AS to_meters, distance_meters
                FROM positioned
                UNION ALL
                SELECT
                    b_id, a_id, b_point, a_point, b_fraction, a_fraction, b_meters, a_meters, distance_meters
                FROM positioned
            ),
            unique_positions AS (
                SELECT *, ROW_NUMBER() OVER (
                    PARTITION BY from_id, to_id,
                        ROUND(alighting_fraction::numeric, 12), ROUND(boarding_fraction::numeric, 12)
                    ORDER BY distance_meters, alighting_fraction, boarding_fraction
                ) AS duplicate_rank
                FROM directed
                WHERE alighting_fraction > 0.0 AND boarding_fraction < 1.0
            ),
            areas AS (
                SELECT
                    unique_positions.*,
                    FLOOR(alighting_fraction * from_meters / limits.area_meters) AS from_area,
                    FLOOR(boarding_fraction * to_meters / limits.area_meters) AS to_area
                FROM unique_positions
                CROSS JOIN limits
                WHERE duplicate_rank = 1
            ),
            area_extremes AS (
                SELECT
                    areas.*,
                    ROW_NUMBER() OVER (
                        area ORDER BY alighting_fraction DESC, boarding_fraction, distance_meters
                    ) AS latest_alighting_rank,
                    ROW_NUMBER() OVER (
                        area ORDER BY boarding_fraction, alighting_fraction DESC, distance_meters
                    ) AS earliest_boarding_rank,
                    ROW_NUMBER() OVER (
                        area ORDER BY distance_meters, alighting_fraction DESC, boarding_fraction
                    ) AS nearest_rank
                FROM areas
                WINDOW area AS (PARTITION BY from_id, to_id, from_area, to_area)
            ),
            retained AS (
                SELECT area_extremes.*, ROW_NUMBER() OVER (
                    PARTITION BY from_id, to_id, from_area, to_area
                    ORDER BY
                        CASE
                            WHEN latest_alighting_rank = 1 OR earliest_boarding_rank = 1 THEN 0
                            WHEN nearest_rank = 1 THEN 1
                            ELSE 2
                        END,
                        distance_meters,
                        alighting_fraction DESC,
                        boarding_fraction
                ) AS area_rank
                FROM area_extremes
            ),
            final_connections AS (
                SELECT * FROM retained WHERE area_rank <= %s
            ),
            statistics AS (
                SELECT (SELECT COUNT(*) FROM positioned) AS generated,
                    (SELECT COUNT(DISTINCT (from_id, to_id, from_area, to_area)) FROM areas) AS areas
            )
            SELECT
                from_id, to_id, alighting_fraction, ST_AsEWKT(alighting_point),
                boarding_fraction, ST_AsEWKT(boarding_point), distance_meters,
                statistics.generated, statistics.areas
            FROM statistics LEFT JOIN final_connections ON TRUE
            ORDER BY from_id, to_id, alighting_fraction, boarding_fraction, distance_meters
        """
        with connection.cursor() as cursor:
            cursor.execute(
                query,
                [
                    *route_query_parameters(routes),
                    maximum_transfer_distance_meters,
                    connection_area_meters,
                    [segments[first].variant_id for first, _ in accepted],
                    [segments[first].vertex_index for first, _ in accepted],
                    [segments[second].variant_id for _, second in accepted],
                    [segments[second].vertex_index for _, second in accepted],
                    maximum_candidates_per_area,
                ],
            )
            rows = cursor.fetchall()
            progress.generated_connection_positions = rows[0][-2]
            progress.retained_connection_areas = rows[0][-1]
            results = [
                RouteConnection(
                    from_variant_id=from_id,
                    to_variant_id=to_id,
                    alighting_position=RoutePosition(
                        point=GEOSGeometry(alighting_wkt),
                        fraction=alighting_fraction,
                    ),
                    boarding_position=RoutePosition(
                        point=GEOSGeometry(boarding_wkt),
                        fraction=boarding_fraction,
                    ),
                    straight_line_distance_meters=distance,
                    validation_status=TransferValidationStatus.PROVISIONAL,
                )
                for (
                    from_id,
                    to_id,
                    alighting_fraction,
                    alighting_wkt,
                    boarding_fraction,
                    boarding_wkt,
                    distance,
                    _,
                    _,
                ) in rows
                if from_id is not None
            ]
            progress.retained_connections = len(results)
            return results
