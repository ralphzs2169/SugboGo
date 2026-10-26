"""Read-only reporting for legacy transit records before strict authoring checks."""

from rest_framework.exceptions import ValidationError

from apps.admin_operations.transit_management.services.route_variant_service import RouteVariantService
from apps.transit.models import TransitPoint
from apps.transit.services.transit_spatial_validation_service import TransitSpatialValidationService


class TransitSpatialAuditService:
    """Inspect all managed points and directions without repairing or deleting records."""

    @staticmethod
    def audit():
        """Return invalid point and direction IDs with the same errors used by admin saves."""
        boundary = TransitSpatialValidationService.boundary()
        point_issues = []
        variant_issues = []
        point_count = variant_count = 0
        for point in TransitPoint.objects.order_by("TRPT_ID").iterator():
            point_count += 1
            try:
                TransitSpatialValidationService.validate_point(point.TRPT_POINT, boundary)
            except ValidationError as exc:
                point_issues.append({"point_id": point.pk, "errors": exc.detail})
        for variant in RouteVariantService.list_variants():
            variant_count += 1
            points = [item.TRPT_ID for item in variant.route_transit_points.all()]
            try:
                RouteVariantService._validate_ordered_points(
                    variant.JRV_ORIGIN_ID, variant.JRV_DESTINATION_ID, points,
                )
                TransitSpatialValidationService.validate_variant(
                    variant.JRV_GEOMETRY, points, boundary,
                )
            except ValidationError as exc:
                variant_issues.append({
                    "variant_id": variant.pk,
                    "route_code": variant.JRT_ID.JRT_CODE,
                    "errors": exc.detail,
                })
        return {
            "point_count": point_count,
            "variant_count": variant_count,
            "invalid_points": point_issues,
            "invalid_variants": variant_issues,
            "valid": not point_issues and not variant_issues,
        }
