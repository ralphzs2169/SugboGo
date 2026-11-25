"""Measure bounded journey ride batches using the existing PostGIS semantics."""

from collections.abc import Collection, Mapping

from django.contrib.gis.geos import GEOSGeometry, LineString
from django.db import connection

from apps.transit.services.coordinate_route_matching_service import RideKey, route_query_parameters

RIDE_MEASUREMENT_BATCH_SIZE = 512

# Keep this query separate from the matching source fingerprinted by graph generation.
# Materialization prevents the filter, distance projection, and EWKT output from
# repeating route parsing, slicing, or spheroidal length calculations.
_JOURNEY_RIDE_SQL = """
    WITH routes AS MATERIALIZED (
        SELECT variant_id, ST_GeomFromEWKT(wkt) AS geometry
        FROM unnest(%s::bigint[], %s::text[]) AS variants(variant_id, wkt)
    ),
    ride_segments AS MATERIALIZED (
        SELECT
            requests.*,
            ST_LineSubstring(
                routes.geometry, requests.boarding_fraction, requests.alighting_fraction
            ) AS ride_geometry
        FROM unnest(%s::bigint[], %s::float8[], %s::float8[])
            AS requests(variant_id, boarding_fraction, alighting_fraction)
        INNER JOIN routes USING (variant_id)
        WHERE requests.boarding_fraction >= 0.0
            AND requests.boarding_fraction < requests.alighting_fraction
            AND requests.alighting_fraction <= 1.0
    ),
    measured_rides AS MATERIALIZED (
        SELECT ride_segments.*, ST_Length(ride_geometry::geography) AS ride_distance_meters
        FROM ride_segments
    )
    SELECT
        variant_id,
        boarding_fraction,
        alighting_fraction,
        ST_AsEWKT(ride_geometry),
        ride_distance_meters
    FROM measured_rides
    WHERE ride_distance_meters >= %s
"""


def measure_journey_rides(
    *,
    route_geometries: Mapping[int, LineString],
    rides: Collection[RideKey],
    minimum_ride_distance_meters: float,
) -> dict[RideKey, tuple[LineString, float]]:
    """Measure one bounded batch against the search's already validated route geometries."""
    keys = tuple(dict.fromkeys(rides))
    if not keys:
        return {}
    if len(keys) > RIDE_MEASUREMENT_BATCH_SIZE:
        raise ValueError("Journey ride measurement batch exceeds its limit.")

    variant_ids, boarding_fractions, alighting_fractions = zip(*keys, strict=True)
    routes = {
        variant_id: route_geometries[variant_id]
        for variant_id in dict.fromkeys(variant_ids)
        if variant_id in route_geometries
    }
    with connection.cursor() as cursor:
        cursor.execute(
            _JOURNEY_RIDE_SQL,
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
