"""Reconciled profile visits attributed to current business locations."""

import hashlib
import math

from django.contrib.gis.geos import GEOSException
from django.db import DatabaseError

from apps.admin_operations.analytics.services.business_attention_service import BusinessAttentionService
from apps.admin_operations.analytics.services.geographic_grid_service import GeographicGridService, GeographyUnavailable
from apps.business.models import ServiceableBoundary
from apps.shared.analytics.metadata import build_meta


class GeographicAggregationService:
    """Provide service-owned geographic evidence for the subsequent admin heatmap."""

    PSGC_CODE = "072217000"
    EXCLUSION_REASONS = ("missing_location", "invalid_coordinates", "unsupported_srid", "outside_scope")

    @classmethod
    def reporting_scope(cls):
        """Require active valid Cebu polygons whose union matches the reviewed source geometry."""
        try:
            rows = list(ServiceableBoundary.objects.filter(
                SBND_PSGC_CODE=cls.PSGC_CODE, SBND_IS_ACTIVE=True,
            ).order_by("SBND_ID"))
            if not rows:
                raise GeographyUnavailable("approved_boundary_missing")
            combined = None
            for record in rows:
                geometry = record.SBND_BOUNDARY
                if geometry is None or geometry.empty or geometry.srid != 4326 or not geometry.valid:
                    raise GeographyUnavailable("approved_boundary_invalid")
                combined = geometry.clone() if combined is None else combined.union(geometry)
            combined.srid = 4326
            return combined, {
                "psgc_code": cls.PSGC_CODE,
                "boundary_ids": [record.pk for record in rows],
                "boundary_updated_at": [record.SBND_UPDATED_AT.isoformat() for record in rows],
                "boundary_wkb_sha256": hashlib.sha256(bytes(combined.wkb)).hexdigest(),
                "scope_validation": "topological_equality_to_repository_boundary",
                "reference_path": "apps/business/data/cebu_city_boundary.json",
            }
        except (DatabaseError, GEOSException) as exc:
            raise GeographyUnavailable("approved_boundary_unreadable") from exc

    @staticmethod
    def location_reason(point, boundary):
        """Classify each unusable location once before any coordinate transformation."""
        if point is None:
            return "missing_location"
        if point.geom_type != "Point" or point.empty or point.hasz:
            return "invalid_coordinates"
        if point.srid != 4326:
            return "unsupported_srid"
        x, y = point.coords
        if not math.isfinite(x) or not math.isfinite(y) or not (-180 <= x <= 180 and -90 <= y <= 90):
            return "invalid_coordinates"
        if not boundary.covers(point):
            return "outside_scope"
        return None

    @classmethod
    def get_report(cls, period, *, cluster=None, category=None):
        """Aggregate additive visits while keeping unknown geography and visibility distinct."""
        businesses = list(BusinessAttentionService.eligible_businesses(
            cluster=cluster, category=category,
        ).select_related("LOCT_ID"))
        ids = [business.pk for business in businesses]
        visibility, visibility_meta = BusinessAttentionService.read_visibility(period, ids)
        total_visits = sum(row["profile_visits"] for row in visibility.values()) if visibility is not None else None
        result = {
            "definition": GeographicGridService.definition(), "scope": None, "cells": None,
            "attribution": {
                "population": "current_active_businesses", "location": "current_business_location",
                "historical_counts_can_move_with_business": True,
                "metric": "recorded_profile_visits", "physical_arrivals": False,
            },
            "reconciliation": {
                "eligible_businesses": len(ids), "assigned_businesses": None,
                "excluded_businesses": None, "excluded_by_reason": None,
                "inventory_profile_visits": total_visits,
                "assigned_profile_visits": None, "excluded_profile_visits": None,
            },
            "sources": {
                "domain": build_meta(period, coverage_verified=True, data_through=period.end,
                                     partial_reasons=("current_state_reporting",)),
                "visibility": visibility_meta,
            },
            "truncated": False, "empty_cells_included": True,
        }
        try:
            boundary, scope = cls.reporting_scope()
            cells, reference_digest = GeographicGridService.cells(boundary)
            scope["reference_geometry_sha256"] = reference_digest
            exclusions = {reason: {"businesses": 0, "profile_visits": 0 if visibility is not None else None}
                          for reason in cls.EXCLUSION_REASONS}
            points = []
            for business in businesses:
                point = business.LOCT_ID.LOCT_POINT if business.LOCT_ID_id else None
                reason = cls.location_reason(point, boundary)
                if reason:
                    exclusions[reason]["businesses"] += 1
                    if visibility is not None:
                        exclusions[reason]["profile_visits"] += visibility[business.pk]["profile_visits"]
                else:
                    points.append({"id": business.pk, "x": point.x, "y": point.y})
            assignments = GeographicGridService.project_points(points)
            if set(assignments) != {point["id"] for point in points}:
                raise GeographyUnavailable("incomplete_coordinate_transform")
            for business_id, indices in assignments.items():
                if indices not in cells:
                    raise GeographyUnavailable("assignment_outside_grid")
                cell = cells[indices]
                cell["eligible_businesses"] += 1
                if visibility is not None:
                    cell["profile_visits"] += visibility[business_id]["profile_visits"]
            for cell in cells.values():
                if visibility is None:
                    cell["profile_visits"] = None
                cell["measurement_status"] = "coverage_unverified" if visibility is not None else "unavailable"
            excluded_visits = sum(row["profile_visits"] for row in exclusions.values()) if visibility is not None else None
            result["scope"] = scope
            result["cells"] = list(cells.values())
            result["reconciliation"].update({
                "assigned_businesses": len(assignments), "excluded_businesses": len(ids) - len(assignments),
                "excluded_by_reason": exclusions,
                "assigned_profile_visits": total_visits - excluded_visits if visibility is not None else None,
                "excluded_profile_visits": excluded_visits,
            })
            geography_status, geography_reason = "available", ()
        except (GeographyUnavailable, GEOSException) as exc:
            geography_status = "unavailable"
            geography_reason = (str(exc) if isinstance(exc, GeographyUnavailable) else "geometry_operation_failed",)
        result["sources"]["geography"] = build_meta(
            period, availability=geography_status, coverage_verified=True,
            data_through=period.end, partial_reasons=geography_reason + ("current_location_attribution",),
        )
        result["meta"] = build_meta(
            period, availability="unavailable" if geography_status == "unavailable" else "partial",
            partial_reasons=("current_state_reporting", "current_location_attribution", "visibility_coverage_unverified")
            + geography_reason + (("visibility_unavailable",) if visibility is None else ()),
        )
        return result
