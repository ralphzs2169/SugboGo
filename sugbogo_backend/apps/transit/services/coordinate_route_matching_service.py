"""Match geometric ride candidates independently of managed transit points."""

import math
from collections.abc import Mapping
from dataclasses import dataclass

from django.contrib.gis.geos import GEOSGeometry, LineString, Point
from django.db import connection
from rest_framework.exceptions import ValidationError

from apps.transit.constants import DIRECT_ROUTE_SEARCH_RADIUS_METERS

MINIMUM_COORDINATE_RIDE_DISTANCE_METERS = 25.0


@dataclass(frozen=True)
class RoutePosition:
    """A centerline candidate and its ordered fraction along the supplied variant."""

    point: Point
    fraction: float


@dataclass(frozen=True)
class CoordinateRouteMatch:
    """A forward ride with straight-line access and egress measurements."""

    variant_id: int
    boarding_position: RoutePosition
    alighting_position: RoutePosition
    ride_geometry: LineString
    access_distance_meters: float
    ride_distance_meters: float
    egress_distance_meters: float


def _is_wgs84_coordinate(coordinate):
    """Check the bounds and dimensionality of a longitude/latitude pair."""
    return (
        len(coordinate) == 2
        and -180 <= coordinate[0] <= 180
        and -90 <= coordinate[1] <= 90
    )


class CoordinateRouteMatchingService:
    """Find forward centerline matches from a caller-supplied set of eligible variants."""

    @staticmethod
    def match_routes(
        *,
        origin: Point,
        destination: Point,
        route_geometries: Mapping[int, LineString],
        search_radius_meters: float = DIRECT_ROUTE_SEARCH_RADIUS_METERS,
        minimum_ride_distance_meters: float = MINIMUM_COORDINATE_RIDE_DISTANCE_METERS,
    ) -> list[CoordinateRouteMatch]:
        """Return ranked geometric matches, skipping unusable variants."""
        for field, point in (
            ("origin", origin),
            ("destination", destination),
        ):
            if (
                not isinstance(point, Point)
                or point.empty
                or point.srid != 4326
                or not _is_wgs84_coordinate(point.coords)
            ):
                raise ValidationError({field: "Provide a valid WGS84 point."})

        for field, distance in (
            ("search_radius_meters", search_radius_meters),
            ("minimum_ride_distance_meters", minimum_ride_distance_meters),
        ):
            if (
                not math.isfinite(distance)
                or distance <= 0
            ):
                raise ValidationError({field: "Provide a positive, finite distance in meters."})

        variant_ids = []
        route_wkts = []
        for variant_id, geometry in route_geometries.items():
            if (
                not isinstance(geometry, LineString)
                or geometry.empty
                or geometry.srid != 4326
                or not all(
                    _is_wgs84_coordinate(coordinate)
                    for coordinate in geometry.coords
                )
                or geometry.length <= 0
                or not geometry.valid
            ):
                continue
            variant_ids.append(variant_id)
            route_wkts.append(geometry.ewkt)

        if not variant_ids:
            return []

        # Use the same ordered 2D measure for projection and slicing, then measure in meters.
        # Adopt a shared vertex once, only when neither adjacent segment is closer.
        query = """
            WITH routes AS (
                SELECT variant_id, ST_GeomFromEWKT(wkt) AS geometry
                FROM unnest(%s::bigint[], %s::text[]) AS variants(variant_id, wkt)
            ),
            endpoints AS (
                SELECT is_boarding, ST_GeomFromEWKT(wkt) AS point
                FROM (VALUES (TRUE, %s), (FALSE, %s)) AS inputs(is_boarding, wkt)
            ),
            vertices AS (
                SELECT
                    variant_id,
                    vertex.path[1] AS vertex_index,
                    vertex.geom AS point,
                    LEAD(vertex.geom) OVER (
                        PARTITION BY variant_id
                        ORDER BY vertex.path[1]
                    ) AS next_point
                FROM routes
                CROSS JOIN LATERAL ST_DumpPoints(routes.geometry) AS vertex
            ),
            segments AS (
                SELECT variant_id, vertex_index, ST_MakeLine(point, next_point) AS geometry
                FROM vertices
                WHERE next_point IS NOT NULL AND NOT ST_Equals(point, next_point)
            ),
            measured_segments AS (
                SELECT
                    segments.*,
                    COALESCE(
                        SUM(ST_Length(geometry)) OVER (
                            PARTITION BY variant_id
                            ORDER BY vertex_index
                            ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                        ),
                        0
                    ) AS length_before
                FROM segments
            ),
            projections AS (
                SELECT
                    segments.*,
                    endpoints.is_boarding,
                    endpoints.point AS input_point,
                    ST_LineLocatePoint(segments.geometry, endpoints.point) AS segment_fraction
                FROM measured_segments AS segments
                CROSS JOIN endpoints
            ),
            adjacent_projections AS (
                SELECT
                    projections.*,
                    LAG(segment_fraction) OVER travel_order AS previous_fraction,
                    LEAD(segment_fraction) OVER travel_order AS next_fraction
                FROM projections
                WINDOW travel_order AS (
                    PARTITION BY variant_id, is_boarding
                    ORDER BY vertex_index
                )
            ),
            route_fractions AS (
                SELECT
                    routes.variant_id,
                    routes.geometry,
                    projection.is_boarding,
                    projection.input_point,
                    LEAST(
                        1.0,
                        (projection.length_before
                            + ST_Length(projection.geometry) * projection.segment_fraction)
                        / ST_Length(routes.geometry)
                    ) AS fraction
                FROM adjacent_projections AS projection
                INNER JOIN routes USING (variant_id)
                WHERE (
                    projection.segment_fraction > 0.0
                    AND projection.segment_fraction < 1.0
                )
                OR (
                    projection.segment_fraction = 0.0
                    AND COALESCE(projection.previous_fraction, 1.0) = 1.0
                )
                OR (
                    projection.segment_fraction = 1.0
                    AND projection.next_fraction IS NULL
                )
            ),
            positions AS (
                SELECT
                    variant_id,
                    is_boarding,
                    input_point::geography AS input_point,
                    fraction,
                    ST_LineInterpolatePoint(geometry, fraction) AS point
                FROM route_fractions
            ),
            nearby_positions AS (
                SELECT
                    variant_id,
                    is_boarding,
                    fraction,
                    point,
                    ST_Distance(point::geography, input_point) AS distance_meters
                FROM positions
                WHERE ST_DWithin(point::geography, input_point, %s)
            ),
            rides AS (
                SELECT
                    routes.variant_id,
                    boarding.fraction AS boarding_fraction,
                    boarding.point AS boarding_point,
                    boarding.distance_meters AS access_distance_meters,
                    alighting.fraction AS alighting_fraction,
                    alighting.point AS alighting_point,
                    alighting.distance_meters AS egress_distance_meters,
                    ST_LineSubstring(
                        routes.geometry, boarding.fraction, alighting.fraction
                    ) AS ride_geometry
                FROM nearby_positions AS boarding
                INNER JOIN nearby_positions AS alighting
                    ON alighting.variant_id = boarding.variant_id
                    AND boarding.fraction < alighting.fraction
                INNER JOIN routes ON routes.variant_id = boarding.variant_id
                WHERE boarding.is_boarding AND NOT alighting.is_boarding
            ),
            measured_rides AS (
                SELECT rides.*, ST_Length(ride_geometry::geography) AS ride_distance_meters
                FROM rides
            )
            SELECT
                variant_id,
                boarding_fraction,
                ST_AsEWKT(boarding_point),
                alighting_fraction,
                ST_AsEWKT(alighting_point),
                ST_AsEWKT(ride_geometry),
                access_distance_meters,
                ride_distance_meters,
                egress_distance_meters
            FROM measured_rides
            WHERE ride_distance_meters >= %s
            ORDER BY
                access_distance_meters + egress_distance_meters,
                ride_distance_meters,
                variant_id,
                boarding_fraction,
                alighting_fraction
        """

        with connection.cursor() as cursor:
            cursor.execute(
                query,
                [
                    variant_ids,
                    route_wkts,
                    origin.ewkt,
                    destination.ewkt,
                    search_radius_meters,
                    minimum_ride_distance_meters,
                ],
            )
            return [
                CoordinateRouteMatch(
                    variant_id=variant_id,
                    boarding_position=RoutePosition(
                        point=GEOSGeometry(boarding_wkt),
                        fraction=boarding_fraction,
                    ),
                    alighting_position=RoutePosition(
                        point=GEOSGeometry(alighting_wkt),
                        fraction=alighting_fraction,
                    ),
                    ride_geometry=GEOSGeometry(ride_wkt),
                    access_distance_meters=access_distance,
                    ride_distance_meters=ride_distance,
                    egress_distance_meters=egress_distance,
                )
                for (
                    variant_id,
                    boarding_fraction,
                    boarding_wkt,
                    alighting_fraction,
                    alighting_wkt,
                    ride_wkt,
                    access_distance,
                    ride_distance,
                    egress_distance,
                ) in cursor.fetchall()
            ]
