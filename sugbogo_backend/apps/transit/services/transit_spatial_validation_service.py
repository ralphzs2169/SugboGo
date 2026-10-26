"""Validate managed transit paths and stops against the active Cebu City boundary."""

import math

from django.contrib.gis.geos import LineString
from django.db import connection
from rest_framework.exceptions import ValidationError

from apps.business.models import ServiceableBoundary
from apps.transit.models import TransitPoint


POINT_PATH_TOLERANCE_METERS = 25
SPATIAL_WRITE_LOCK = 620261026


class TransitSpatialValidationService:
    """Share spatial checks between route authoring, point moves and integrity audits."""

    @staticmethod
    def lock_network():
        """Serialize administrator spatial writes before reading referenced stop locations."""
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_xact_lock(%s)", [SPATIAL_WRITE_LOCK])

    @staticmethod
    def boundary():
        """Require one valid active Cebu City boundary without creating or guessing one."""
        rows = list(
            ServiceableBoundary.objects.filter(
                SBND_NAME__iexact="Cebu City",
                SBND_PSGC_CODE="072217000",
                SBND_IS_ACTIVE=True,
            )[:2],
        )
        if len(rows) != 1:
            raise ValidationError({
                "non_field_errors": (
                    "Configure exactly one active Cebu City boundary (PSGC 072217000) "
                    "before editing locations or paths."
                ),
            })
        geometry = rows[0].SBND_BOUNDARY
        if geometry is None or geometry.empty or geometry.srid != 4326 or not geometry.valid:
            raise ValidationError({
                "non_field_errors": "The active Cebu City boundary must be valid, nonempty WGS84 geometry.",
            })
        return geometry

    @staticmethod
    def validate_point(point, boundary=None, field="latitude"):
        """Require a finite WGS84 roadside location covered by the Cebu City boundary."""
        if (
            point is None or point.geom_type != "Point" or point.empty
            or point.srid != 4326
            or not all(math.isfinite(value) for value in (point.x, point.y))
            or not -180 <= point.x <= 180 or not -90 <= point.y <= 90
            or not point.valid
        ):
            raise ValidationError({field: "Choose a valid latitude and longitude for this stop."})
        boundary = boundary if boundary is not None else TransitSpatialValidationService.boundary()
        if not boundary.covers(point):
            raise ValidationError({field: "Choose a stop within the Cebu City boundary."})

    @staticmethod
    def build_geometry(coordinates):
        """Build a WGS84 path from finite frontend latitude/longitude pairs."""
        try:
            values = [
                (float(item["longitude"]), float(item["latitude"]))
                for item in coordinates
            ]
            if len(values) < 2 or any(
                not math.isfinite(lon) or not math.isfinite(lat)
                or not -180 <= lon <= 180 or not -90 <= lat <= 90
                for lon, lat in values
            ):
                raise ValueError
            return LineString(values, srid=4326)
        except (KeyError, TypeError, ValueError, OverflowError) as exc:
            raise ValidationError({
                "geometry": "Draw a path with at least two valid latitude/longitude locations.",
            }) from exc

    @staticmethod
    def fresh_points(points):
        """Reload serializer references after the spatial-write lock to avoid stale coordinates."""
        points = list(points)
        current = TransitPoint.objects.in_bulk([point.pk for point in points])
        if any(point.pk not in current for point in points):
            raise ValidationError({
                "transit_point_ids": "A selected stop no longer exists. Reload the stop list.",
            })
        return [current[point.pk] for point in points]

    @staticmethod
    def validate_variant(geometry, points, boundary=None, overrides=None):
        """Check containment, endpoint distances and increasing stop projections in meters."""
        if (
            geometry is None or geometry.geom_type != "LineString" or geometry.empty
            or geometry.srid != 4326
            or any(not math.isfinite(value) for pair in geometry.coords for value in pair)
            or any(not -180 <= lon <= 180 or not -90 <= lat <= 90 for lon, lat in geometry.coords)
            or geometry.length <= 0 or not geometry.valid or not geometry.simple
        ):
            raise ValidationError({
                "geometry": "Draw a nonzero path without self-intersections or repeated loops.",
            })
        points = list(points)
        if len(points) < 2 or len({point.pk for point in points}) != len(points):
            raise ValidationError({"transit_point_ids": "Choose at least two distinct stops in travel order."})
        boundary = boundary if boundary is not None else TransitSpatialValidationService.boundary()
        if not boundary.covers(geometry):
            raise ValidationError({
                "geometry": (
                    "The whole route path must stay within Cebu City. "
                    "Cross-city routes are outside the current scope."
                ),
            })
        overrides = overrides or {}
        locations = [overrides.get(point.pk, point.TRPT_POINT) for point in points]
        for point, location in zip(points, locations):
            try:
                TransitSpatialValidationService.validate_point(location, boundary, "transit_point_ids")
            except ValidationError as exc:
                raise ValidationError({
                    "transit_point_ids": (
                        f"Stop {point.pk} ({point.TRPT_NAME}) must have a valid location within Cebu City."
                    ),
                }) from exc
        with connection.cursor() as cursor:
            cursor.execute(
                "WITH path AS (SELECT ST_GeomFromEWKT(%s) AS geom), "
                "stops AS (SELECT ST_GeomFromEWKT(wkt) AS geom, position "
                "FROM unnest(%s::text[]) WITH ORDINALITY AS items(wkt, position)) "
                "SELECT position, ST_Distance(stops.geom::geography, path.geom::geography), "
                "ST_LineLocatePoint(path.geom, stops.geom), "
                "ST_Distance(ST_StartPoint(path.geom)::geography, stops.geom::geography), "
                "ST_Distance(ST_EndPoint(path.geom)::geography, stops.geom::geography) "
                "FROM stops CROSS JOIN path ORDER BY position",
                [geometry.ewkt, [location.ewkt for location in locations]],
            )
            metrics = cursor.fetchall()
        previous_fraction = -1.0
        for point, (position, distance, fraction, start_distance, end_distance) in zip(points, metrics):
            if distance > POINT_PATH_TOLERANCE_METERS:
                raise ValidationError({
                    "transit_point_ids": (
                        f"Stop {point.pk} ({point.TRPT_NAME}) is more than 25 meters "
                        "from the path. Adjust the stop or path."
                    ),
                })
            if position == 1 and start_distance > POINT_PATH_TOLERANCE_METERS:
                raise ValidationError({"geometry": "Start the drawn path within 25 meters of the starting stop."})
            if position == len(points) and end_distance > POINT_PATH_TOLERANCE_METERS:
                raise ValidationError({"geometry": "End the drawn path within 25 meters of the last stop."})
            if fraction <= previous_fraction + 1e-9:
                raise ValidationError({
                    "transit_point_ids": (
                        "Stops must follow the drawn path from start to finish. "
                        "Reorder the stops or redraw the direction."
                    ),
                })
            previous_fraction = fraction
