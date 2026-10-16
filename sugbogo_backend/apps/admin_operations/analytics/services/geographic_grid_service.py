"""Versioned, metre-based geography for current business-location analytics."""

import hashlib
import json
import math
from pathlib import Path

from django.conf import settings
from django.db import DatabaseError, connection, transaction


class GeographyUnavailable(Exception):
    """Indicate that approved geographic attribution cannot be established."""


class GeographicGridService:
    """Derive fixed UTM cells using PostGIS without changing stored locations."""

    SRID = 32651
    CELL_SIZE = 1000
    VERSION = "cebu-utm51n-1000m-origin0-floor-v1"
    MAX_CELLS = 10000
    BATCH_SIZE = 1000

    @classmethod
    def definition(cls):
        """Describe the immutable lattice and its output coordinate convention."""
        return {
            "version": cls.VERSION, "projected_srid": cls.SRID,
            "cell_size_metres": cls.CELL_SIZE, "origin": [0, 0],
            "assignment": "floor_half_open", "output_srid": 4326,
            "coordinate_order": "longitude_latitude", "max_cells": cls.MAX_CELLS,
        }

    @classmethod
    def indices(cls, x, y):
        """Assign finite projected coordinates to one half-open square."""
        if not math.isfinite(x) or not math.isfinite(y):
            raise GeographyUnavailable("coordinate_transform_failed")
        return math.floor(x / cls.CELL_SIZE), math.floor(y / cls.CELL_SIZE)

    @classmethod
    def cell_id(cls, column, row):
        """Build a stable identity that cannot omit the grid definition."""
        return f"{cls.VERSION}:{column}:{row}"

    @staticmethod
    def reference_geometry():
        """Load the reviewed repository boundary rather than infer scope from its label."""
        path = Path(settings.BASE_DIR) / "apps/business/data/cebu_city_boundary.json"
        try:
            with path.open(encoding="utf-16") as source:
                geometry = json.load(source)["geometry"]
            encoded = json.dumps(geometry, sort_keys=True, separators=(",", ":"))
        except (OSError, ValueError, KeyError, TypeError) as exc:
            raise GeographyUnavailable("reference_boundary_unavailable") from exc
        return encoded, hashlib.sha256(encoded.encode()).hexdigest()

    @classmethod
    def cells(cls, boundary):
        """Validate approved scope and return every intersecting cell, including empty cells."""
        reference, digest = cls.reference_geometry()
        try:
            # The savepoint keeps a capability failure from poisoning a caller's transaction.
            with transaction.atomic(), connection.cursor() as cursor:
                cursor.execute(
                    "SELECT ST_Equals(ST_GeomFromWKB(%s, 4326), ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326))",
                    [bytes(boundary.wkb), reference],
                )
                if not cursor.fetchone()[0]:
                    raise GeographyUnavailable("boundary_reference_mismatch")
                cursor.execute(
                    """
                    WITH scope AS (
                        SELECT ST_Transform(ST_GeomFromWKB(%s, 4326), %s) AS geom
                    )
                    SELECT tile.i, tile.j, ST_AsGeoJSON(ST_Transform(tile.geom, 4326), 9)
                    FROM scope CROSS JOIN LATERAL ST_SquareGrid(%s, scope.geom) AS tile
                    WHERE ST_Intersects(tile.geom, scope.geom)
                    ORDER BY tile.i, tile.j LIMIT %s
                    """,
                    [bytes(boundary.wkb), cls.SRID, cls.CELL_SIZE, cls.MAX_CELLS + 1],
                )
                rows = cursor.fetchall()
        except DatabaseError as exc:
            raise GeographyUnavailable("spatial_runtime_unavailable") from exc
        if not rows:
            raise GeographyUnavailable("empty_reporting_grid")
        if len(rows) > cls.MAX_CELLS:
            raise GeographyUnavailable("cell_limit_exceeded")
        return {
            (column, row): {
                "id": cls.cell_id(column, row), "column": column, "row": row,
                "geometry": json.loads(geometry), "eligible_businesses": 0,
                "profile_visits": 0,
            }
            for column, row, geometry in rows
        }, digest

    @classmethod
    def project_points(cls, points):
        """Transform validated longitude/latitude inputs in bounded read-only SQL batches."""
        projected = {}
        try:
            with transaction.atomic(), connection.cursor() as cursor:
                for offset in range(0, len(points), cls.BATCH_SIZE):
                    cursor.execute(
                        """
                        SELECT p.id, ST_X(p.geom), ST_Y(p.geom) FROM (
                            SELECT value.id, ST_Transform(
                                ST_SetSRID(ST_MakePoint(value.x, value.y), 4326), %s
                            ) AS geom
                            FROM jsonb_to_recordset(%s::jsonb)
                                AS value(id bigint, x double precision, y double precision)
                        ) AS p
                        """,
                        [cls.SRID, json.dumps(points[offset:offset + cls.BATCH_SIZE], allow_nan=False)],
                    )
                    for business_id, x, y in cursor.fetchall():
                        projected[business_id] = cls.indices(x, y)
        except DatabaseError as exc:
            raise GeographyUnavailable("coordinate_transform_failed") from exc
        return projected
