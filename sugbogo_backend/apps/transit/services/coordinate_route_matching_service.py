"""Match geometric ride candidates independently of managed transit points."""

import math
from collections.abc import Collection, Mapping
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


@dataclass(frozen=True)
class RouteEndpointPosition:
    """A measured origin or destination projection on one variant."""

    variant_id: int
    is_boarding: bool
    position: RoutePosition
    distance_meters: float


RideKey = tuple[int, float, float]


def valid_route_geometries(
    route_geometries: Mapping[int, LineString],
) -> dict[int, LineString]:
    """Keep usable two-dimensional WGS84 lines while preserving their vertex order."""
    return {
        variant_id: geometry
        for variant_id, geometry in route_geometries.items()
        if (
            isinstance(geometry, LineString)
            and not geometry.empty
            and geometry.srid == 4326
            and all(
                _is_wgs84_coordinate(coordinate)
                for coordinate in geometry.coords
            )
            and geometry.length > 0
            and geometry.valid
        )
    }


def route_query_parameters(
    route_geometries: Mapping[int, LineString],
) -> tuple[list[int], list[str]]:
    """Prepare aligned variant and geometry arrays for parameterized PostGIS queries."""
    return (
        list(route_geometries),
        [
            geometry.ewkt
            for geometry in route_geometries.values()
        ],
    )


def validate_distance(
    field: str,
    distance: float,
):
    """Require a positive finite distance in meters for a routing limit."""
    if (
        not math.isfinite(distance)
        or distance <= 0
    ):
        raise ValidationError({field: "Provide a positive, finite distance in meters."})


ROUTES_CTE = """
WITH routes AS (
    SELECT variant_id, ST_GeomFromEWKT(wkt) AS geometry
    FROM unnest(%s::bigint[], %s::text[]) AS variants(variant_id, wkt)
)
"""

ROUTE_SEGMENTS_CTES = """
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
)
"""

_ENDPOINTS_CTE = """
endpoints AS (
    SELECT is_boarding, ST_GeomFromEWKT(wkt) AS point, radius_meters
    FROM (VALUES (TRUE, %s, %s), (FALSE, %s, %s)) AS inputs(is_boarding, wkt, radius_meters)
)
"""

# Adopt a shared vertex once, only when neither adjacent segment is closer.
_ENDPOINT_POSITIONS_CTES = """
projections AS (
    SELECT
        segments.*,
        endpoints.is_boarding,
        endpoints.radius_meters,
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
        projection.radius_meters,
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
        radius_meters,
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
    WHERE ST_DWithin(point::geography, input_point, radius_meters)
)
"""

# All ride requests use the original line's ordered 2D measure and report geography meters.
_RIDE_MEASUREMENT_CTES = """
ride_segments AS (
    SELECT
        requests.*,
        ST_LineSubstring(
            routes.geometry, requests.boarding_fraction, requests.alighting_fraction
        ) AS ride_geometry
    FROM ride_requests AS requests
    INNER JOIN routes USING (variant_id)
    WHERE requests.boarding_fraction >= 0.0
        AND requests.boarding_fraction < requests.alighting_fraction
        AND requests.alighting_fraction <= 1.0
),
measured_rides AS (
    SELECT ride_segments.*, ST_Length(ride_geometry::geography) AS ride_distance_meters
    FROM ride_segments
)
"""


class CoordinateRouteMatchingService:
    """Find forward centerline matches from a caller-supplied set of eligible variants."""

    @staticmethod
    def _validate_endpoints(
        origin: Point,
        destination: Point,
    ):
        """Check both input locations before constructing a spatial query."""
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
        CoordinateRouteMatchingService._validate_endpoints(origin, destination)
        validate_distance("search_radius_meters", search_radius_meters)
        validate_distance("minimum_ride_distance_meters", minimum_ride_distance_meters)
        routes = valid_route_geometries(route_geometries)
        if not routes:
            return []

        query = f"""
            {ROUTES_CTE},
            {_ENDPOINTS_CTE},
            {ROUTE_SEGMENTS_CTES},
            {_ENDPOINT_POSITIONS_CTES},
            ride_requests AS (
                SELECT
                    boarding.variant_id,
                    boarding.fraction AS boarding_fraction,
                    boarding.point AS boarding_point,
                    boarding.distance_meters AS access_distance_meters,
                    alighting.fraction AS alighting_fraction,
                    alighting.point AS alighting_point,
                    alighting.distance_meters AS egress_distance_meters
                FROM nearby_positions AS boarding
                INNER JOIN nearby_positions AS alighting
                    ON alighting.variant_id = boarding.variant_id
                WHERE boarding.is_boarding AND NOT alighting.is_boarding
            ),
            {_RIDE_MEASUREMENT_CTES}
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
                    *route_query_parameters(routes),
                    origin.ewkt,
                    search_radius_meters,
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

    @staticmethod
    def find_endpoint_positions(
        *,
        origin: Point,
        destination: Point,
        route_geometries: Mapping[int, LineString],
        maximum_access_distance_meters: float,
        maximum_egress_distance_meters: float,
    ) -> list[RouteEndpointPosition]:
        """Find nearby positions for each endpoint without requiring both on one route."""
        CoordinateRouteMatchingService._validate_endpoints(origin, destination)
        validate_distance("maximum_access_distance_meters", maximum_access_distance_meters)
        validate_distance("maximum_egress_distance_meters", maximum_egress_distance_meters)
        routes = valid_route_geometries(route_geometries)
        if not routes:
            return []

        query = f"""
            {ROUTES_CTE},
            {_ENDPOINTS_CTE},
            {ROUTE_SEGMENTS_CTES},
            {_ENDPOINT_POSITIONS_CTES}
            SELECT variant_id, is_boarding, fraction, ST_AsEWKT(point), distance_meters
            FROM nearby_positions
            ORDER BY variant_id, is_boarding, fraction
        """
        with connection.cursor() as cursor:
            cursor.execute(
                query,
                [
                    *route_query_parameters(routes),
                    origin.ewkt,
                    maximum_access_distance_meters,
                    destination.ewkt,
                    maximum_egress_distance_meters,
                ],
            )
            return [
                RouteEndpointPosition(
                    variant_id=variant_id,
                    is_boarding=is_boarding,
                    position=RoutePosition(
                        point=GEOSGeometry(wkt),
                        fraction=fraction,
                    ),
                    distance_meters=distance,
                )
                for variant_id, is_boarding, fraction, wkt, distance in cursor.fetchall()
            ]

    @staticmethod
    def measure_rides(
        *,
        route_geometries: Mapping[int, LineString],
        rides: Collection[RideKey],
        minimum_ride_distance_meters: float,
    ) -> dict[RideKey, tuple[LineString, float]]:
        """Slice and measure ordered ride requests in one PostGIS query."""
        validate_distance("minimum_ride_distance_meters", minimum_ride_distance_meters)
        routes = valid_route_geometries(route_geometries)
        if not routes or not rides:
            return {}

        variant_ids, boarding_fractions, alighting_fractions = zip(*rides, strict=True)
        query = f"""
            {ROUTES_CTE},
            ride_requests AS (
                SELECT variant_id, boarding_fraction, alighting_fraction
                FROM unnest(%s::bigint[], %s::float8[], %s::float8[])
                    AS requests(variant_id, boarding_fraction, alighting_fraction)
            ),
            {_RIDE_MEASUREMENT_CTES}
            SELECT
                variant_id,
                boarding_fraction,
                alighting_fraction,
                ST_AsEWKT(ride_geometry),
                ride_distance_meters
            FROM measured_rides
            WHERE ride_distance_meters >= %s
        """
        with connection.cursor() as cursor:
            cursor.execute(
                query,
                [
                    *route_query_parameters(routes),
                    list(variant_ids),
                    list(boarding_fractions),
                    list(alighting_fractions),
                    minimum_ride_distance_meters,
                ],
            )
            return {
                (variant_id, boarding, alighting): (GEOSGeometry(wkt), distance)
                for variant_id, boarding, alighting, wkt, distance in cursor.fetchall()
            }
