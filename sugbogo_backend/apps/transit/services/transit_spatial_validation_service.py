"""Validate the geometry and stop alignment of managed transit paths."""

import math

from django.contrib.gis.geos import LineString
from django.db import connection
from rest_framework.exceptions import ValidationError

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
    def validate_point(
        point,
        field="latitude",
    ):
        """Require a valid WGS84 stop location with finite coordinates in range."""
        if (
            point is None or point.geom_type != "Point" or point.empty
            or point.srid != 4326
            or not all(math.isfinite(value) for value in (point.x, point.y))
            or not -180 <= point.x <= 180 or not -90 <= point.y <= 90
            or not point.valid
        ):
            raise ValidationError({field: "Choose a valid latitude and longitude for this stop."})

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
    def validate_geometry(geometry):
        """Require a usable two-dimensional WGS84 LineString."""
        if (
            not isinstance(geometry, LineString) or geometry.empty
            or geometry.srid != 4326
            or any(
                len(pair) != 2 or any(not math.isfinite(value) for value in pair)
                for pair in geometry.coords
            )
            or any(not -180 <= lon <= 180 or not -90 <= lat <= 90 for lon, lat in geometry.coords)
            or geometry.length <= 0 or not geometry.valid or not geometry.simple
        ):
            raise ValidationError({
                "geometry": "Draw a nonzero path without self-intersections or repeated loops.",
            })

    @staticmethod
    def validate_variant(
        geometry,
        points,
        overrides=None,
    ):
        """Check path geometry, stop and endpoint distances, and travel order."""
        TransitSpatialValidationService.validate_geometry(geometry)
        points = list(points)
        if len(points) < 2 or len({point.pk for point in points}) != len(points):
            raise ValidationError({"transit_point_ids": "Choose at least two distinct stops in travel order."})
        overrides = overrides or {}
        locations = [overrides.get(point.pk, point.TRPT_POINT) for point in points]
        for point, location in zip(points, locations):
            try:
                TransitSpatialValidationService.validate_point(
                    location,
                    field="transit_point_ids",
                )
            except ValidationError as exc:
                raise ValidationError({
                    "transit_point_ids": f"Stop {point.pk} ({point.TRPT_NAME}) must have a valid location.",
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
