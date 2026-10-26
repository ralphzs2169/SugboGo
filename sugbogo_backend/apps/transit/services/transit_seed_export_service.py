"""Reuse administrator-drawn geometry without labeling it reviewed automatically."""

from rest_framework.exceptions import ValidationError

from apps.transit.models import JeepneyRouteVariant
from apps.transit.serializers.transit_seed_serializers import TransitSeedDatasetSerializer
from apps.transit.services.transit_seed_service import TransitSeedService


class TransitSeedExportService:
    """Read selected managed directions into an editable, review-required seed draft."""

    @staticmethod
    def export(variant_ids, *, confirmation):
        """Export coordinates and stop order without modifying the source database."""
        TransitSeedService.validate_database(confirmation, seed_target=False)
        if not variant_ids or len(variant_ids) != len(set(variant_ids)):
            raise ValidationError("Select unique --variant-id values explicitly.")
        variants = list(JeepneyRouteVariant.objects.filter(
            pk__in=variant_ids,
        ).select_related("JRT_ID").prefetch_related("route_transit_points__TRPT_ID").order_by("pk"))
        if len(variants) != len(variant_ids):
            raise ValidationError("One or more selected route variants do not exist.")
        points = {}
        routes = {}
        for variant in variants:
            memberships = sorted(
                variant.route_transit_points.all(), key=lambda item: item.RVTP_SEQUENCE,
            )
            if (
                len(memberships) < 2
                or memberships[0].TRPT_ID_id != variant.JRV_ORIGIN_ID_id
                or memberships[-1].TRPT_ID_id != variant.JRV_DESTINATION_ID_id
                or [item.RVTP_SEQUENCE for item in memberships] != list(range(1, len(memberships) + 1))
            ):
                raise ValidationError("Selected direction has incomplete/inconsistent ordered memberships.")
            keys = []
            for membership in memberships:
                point = membership.TRPT_ID
                if point.TRPT_POINT.empty or not point.TRPT_POINT.valid or point.TRPT_POINT.srid != 4326:
                    raise ValidationError("Selected direction contains invalid point geometry.")
                key = f"point-{point.pk}"
                keys.append(key)
                points[key] = {
                    "key": key, "name": point.TRPT_NAME,
                    "latitude": point.TRPT_POINT.y, "longitude": point.TRPT_POINT.x,
                }
            code = variant.JRT_ID.JRT_CODE
            route = routes.setdefault(code, {
                "code": code, "name": f"Route {code}", "vehicle_type": "unknown", "variants": [],
            })
            route["variants"].append({
                "key": f"variant-{variant.pk}", "point_keys": keys,
                "geometry": [
                    {"latitude": latitude, "longitude": longitude}
                    for longitude, latitude in variant.JRV_GEOMETRY.coords
                ],
                "source_ids": [],
                "review": {
                    "status": "needs_review", "reviewer": "", "reviewed_on": None,
                    "observed_on": None, "geometry_method": "admin_export",
                    "evidence": "", "license_reviewed": False,
                },
            })
        payload = {
            "format_version": 1, "kind": "cebu_city_transit_seed",
            "dataset_id": "cebu-city-admin-draft", "scope": "cebu_city",
            "sources": [], "points": list(points.values()), "routes": list(routes.values()),
        }
        serializer = TransitSeedDatasetSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        return payload
