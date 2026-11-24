"""Discover provisional connections between directional route centerlines."""

from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum

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
        maximum_transfer_distance_meters: float = MAXIMUM_PROVISIONAL_TRANSFER_DISTANCE_METERS,
        connection_area_meters: float = CONNECTION_AREA_METERS,
        maximum_candidates_per_area: int = MAXIMUM_CANDIDATES_PER_AREA,
        maximum_segment_pairs: int = MAXIMUM_CONNECTION_SEGMENT_PAIRS,
    ) -> list[RouteConnection]:
        """Return provisional candidates with bounded sampling and per-area retention."""
        validate_distance("maximum_transfer_distance_meters", maximum_transfer_distance_meters)
        validate_distance("connection_area_meters", connection_area_meters)
        for field, limit in (
            ("maximum_candidates_per_area", maximum_candidates_per_area),
            ("maximum_segment_pairs", maximum_segment_pairs),
        ):
            if type(limit) is not int or limit < 1:
                raise ValidationError({field: "Provide a positive integer."})
        routes = valid_route_geometries(route_geometries)
        if len(routes) < 2:
            return []

        # Sample projected intervals as well as exact crossings so shared and parallel
        # stretches keep candidate positions between their endpoints.
        query = f"""
            {ROUTES_CTE},
            {ROUTE_SEGMENTS_CTES},
            limits AS (
                SELECT %s::float8 AS radius_meters, %s::float8 AS area_meters
            ),
            route_pairs AS (
                SELECT
                    a.variant_id AS a_id,
                    b.variant_id AS b_id,
                    ST_Length(a.geometry) AS a_length,
                    ST_Length(b.geometry) AS b_length,
                    ST_Length(a.geometry::geography) AS a_meters,
                    ST_Length(b.geometry::geography) AS b_meters
                FROM routes AS a
                INNER JOIN routes AS b ON a.variant_id < b.variant_id
                CROSS JOIN limits
                WHERE NOT ST_OrderingEquals(a.geometry, b.geometry)
                    AND (
                        ST_Intersects(a.geometry, b.geometry)
                        OR ST_DWithin(a.geometry::geography, b.geometry::geography, limits.radius_meters)
                    )
            ),
            segment_pairs AS MATERIALIZED (
                SELECT
                    pairs.*,
                    a.geometry AS a_segment,
                    b.geometry AS b_segment,
                    a.length_before AS a_length_before,
                    b.length_before AS b_length_before
                FROM route_pairs AS pairs
                INNER JOIN measured_segments AS a ON a.variant_id = pairs.a_id
                INNER JOIN measured_segments AS b ON b.variant_id = pairs.b_id
                CROSS JOIN limits
                WHERE ST_Intersects(a.geometry, b.geometry)
                    OR ST_DWithin(a.geometry::geography, b.geometry::geography, limits.radius_meters)
                LIMIT %s
            ),
            discovery_budget AS (
                SELECT COUNT(*) > %s AS exceeded
                FROM segment_pairs
            ),
            eligible_segment_pairs AS MATERIALIZED (
                SELECT pairs.*
                FROM segment_pairs AS pairs
                CROSS JOIN discovery_budget
                WHERE NOT discovery_budget.exceeded
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
                        (TRUE, pairs.a_segment, pairs.b_segment),
                        (FALSE, pairs.b_segment, pairs.a_segment)
                    ) AS sampling(on_a, segment, other_segment)
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
                                    * ST_Length(sampling.segment::geography)
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
            positioned AS (
                SELECT
                    a_id, b_id, a_point, b_point, a_meters, b_meters,
                    LEAST(
                        1.0,
                        (a_length_before + ST_Length(a_segment) * ST_LineLocatePoint(a_segment, a_point))
                        / a_length
                    ) AS a_fraction,
                    LEAST(
                        1.0,
                        (b_length_before + ST_Length(b_segment) * ST_LineLocatePoint(b_segment, b_point))
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
            )
            SELECT
                FALSE AS budget_exceeded,
                from_id, to_id, alighting_fraction, ST_AsEWKT(alighting_point),
                boarding_fraction, ST_AsEWKT(boarding_point), distance_meters
            FROM retained
            WHERE area_rank <= %s
            UNION ALL
            SELECT TRUE, NULL, NULL, NULL, NULL, NULL, NULL, NULL
            FROM discovery_budget
            WHERE exceeded
            ORDER BY from_id, to_id, alighting_fraction, boarding_fraction, distance_meters
        """
        with connection.cursor() as cursor:
            cursor.execute(
                query,
                [
                    *route_query_parameters(routes),
                    maximum_transfer_distance_meters,
                    connection_area_meters,
                    maximum_segment_pairs + 1,
                    maximum_segment_pairs,
                    maximum_candidates_per_area,
                ],
            )
            rows = cursor.fetchall()
            if rows and rows[0][0]:
                raise ValidationError({"connections": "The connection search exceeded its segment-pair budget."})
            return [
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
                    _,
                    from_id,
                    to_id,
                    alighting_fraction,
                    alighting_wkt,
                    boarding_fraction,
                    boarding_wkt,
                    distance,
                ) in rows
            ]
