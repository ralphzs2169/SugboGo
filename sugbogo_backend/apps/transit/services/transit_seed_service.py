"""Preview and replay reviewed Cebu City directions without replacing managed data."""

import hashlib
import json

from django.conf import settings
from django.contrib.gis.geos import Point
from django.db import connection, transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.transit.models import JeepneyRoute, JeepneyRouteVariant, RouteTransitPoint, TransitPoint
from apps.transit.serializers.transit_seed_serializers import TransitSeedDatasetSerializer
from apps.transit.services.transit_spatial_validation_service import TransitSpatialValidationService


SEED_DATABASE = "sugbogo_cebu_city_dev"


class TransitSeedService:
    """Import complete reviewed directions into an explicitly confirmed local database."""

    @staticmethod
    def validate_database(confirmation, *, seed_target=True):
        """Require local debug PostGIS, with a dedicated database for any seed planning."""
        config = connection.settings_dict
        name = str(config.get("NAME", ""))
        allowed_name = name == SEED_DATABASE or name.startswith("test_")
        if (
            not settings.DEBUG
            or config.get("ENGINE") != "django.contrib.gis.db.backends.postgis"
            or config.get("HOST", "") not in {"", "localhost", "127.0.0.1", "::1"}
            or confirmation != name
            or (seed_target and not allowed_name)
        ):
            raise PermissionDenied(
                "Requires DEBUG=True, local PostGIS and exact --confirm-database. "
                "Seed targets must be sugbogo_cebu_city_dev or a Django test_ database."
            )
        return name

    @staticmethod
    def _boundary():
        """Require one existing active Cebu City polygon instead of inventing a bounding box."""
        return TransitSpatialValidationService.boundary()

    @staticmethod
    def _validate_geometry(variant, point_data, boundary):
        """Apply the same path and stop checks used by administrator route authoring."""
        geometry = TransitSpatialValidationService.build_geometry(variant["geometry"])
        points = [
            TransitPoint(TRPT_ID=index, TRPT_NAME=key, TRPT_POINT=point_data[key])
            for index, key in enumerate(variant["point_keys"], start=1)
        ]
        try:
            TransitSpatialValidationService.validate_variant(geometry, points, boundary)
        except ValidationError as exc:
            raise ValidationError({variant["key"]: exc.detail}) from exc
        return geometry

    @staticmethod
    def _plan(data):
        """Read existing rows and reject all collisions without any inserts or updates."""
        boundary = TransitSeedService._boundary()
        points = {}
        point_geometries = {}
        existing_by_name = {}
        existing_by_coordinate = {}
        for existing in TransitPoint.objects.all():
            existing_by_name.setdefault(existing.TRPT_NAME, []).append(existing)
            if existing.TRPT_POINT.empty or not existing.TRPT_POINT.valid:
                continue
            coordinate = (existing.TRPT_POINT.x, existing.TRPT_POINT.y)
            existing_by_coordinate.setdefault(coordinate, []).append(existing)
        for item in data["points"]:
            point = Point(item["longitude"], item["latitude"], srid=4326)
            matches = existing_by_name.get(item["name"], [])
            coordinate_matches = existing_by_coordinate.get((point.x, point.y), [])
            if (
                len(matches) > 1
                or (matches and not matches[0].TRPT_POINT.equals_exact(point, 0))
                or any(row.TRPT_NAME != item["name"] for row in coordinate_matches)
            ):
                raise ValidationError(f"{item['key']}: existing point name/coordinates conflict.")
            points[item["key"]] = matches[0] if matches else None
            point_geometries[item["key"]] = point
        routes = {}
        variants = []
        paths_by_code = {}
        for route_data in data["routes"]:
            matches = list(JeepneyRoute.objects.filter(JRT_CODE__iexact=route_data["code"])[:2])
            if len(matches) > 1 or (matches and matches[0].JRT_CODE != route_data["code"]):
                raise ValidationError(f"{route_data['code']}: ambiguous or noncanonical existing code.")
            route = matches[0] if matches else None
            routes[route_data["code"]] = route
            for item in route_data["variants"]:
                geometry = TransitSeedService._validate_geometry(item, point_geometries, boundary)
                paths = paths_by_code.setdefault(route_data["code"], [])
                if any(previous.equals_exact(geometry, 0) for previous in paths):
                    raise ValidationError(f"{item['key']}: duplicate path for the same route code.")
                paths.append(geometry)
                ordered_points = [points[key] for key in item["point_keys"]]
                existing_variant = None
                if route and all(ordered_points):
                    existing_variant = JeepneyRouteVariant.objects.filter(
                        JRT_ID=route,
                        JRV_ORIGIN_ID=ordered_points[0],
                        JRV_DESTINATION_ID=ordered_points[-1],
                    ).first()
                if route and existing_variant is None and any(
                    other.JRV_GEOMETRY.equals_exact(geometry, 0)
                    for other in route.variants.all()
                ):
                    raise ValidationError(f"{item['key']}: this path already exists with other endpoints.")
                if existing_variant is not None:
                    expected_memberships = [
                        (index, point.pk) for index, point in enumerate(ordered_points, start=1)
                    ]
                    memberships = list(existing_variant.route_transit_points.order_by(
                        "RVTP_SEQUENCE",
                    ).values_list("RVTP_SEQUENCE", "TRPT_ID_id"))
                    if (
                        not existing_variant.JRV_GEOMETRY.equals_exact(geometry, 0)
                        or memberships != expected_memberships
                    ):
                        raise ValidationError(
                            f"{item['key']}: existing direction differs; no overwrite allowed."
                        )
                variants.append({
                    "code": route_data["code"], "data": item,
                    "geometry": geometry, "existing": existing_variant,
                })
        return {"points": points, "routes": routes, "variants": variants}

    @staticmethod
    def _report(data, plan, database, applied):
        """Expose review status, stable IDs and proposed record counts for human inspection."""
        counts = {"create": 0, "reuse": 0}
        for record in [*plan["points"].values(), *plan["routes"].values()]:
            counts["reuse" if record is not None else "create"] += 1
        directions = []
        for entry in plan["variants"]:
            item = entry["data"]
            existing = entry["existing"]
            count = 1 + len(item["point_keys"])
            counts["reuse" if existing is not None else "create"] += count
            observed = item["review"]["observed_on"]
            directions.append({
                "key": item["key"], "code": entry["code"],
                "review_status": item["review"]["status"],
                "observation_age_days": (timezone.localdate() - observed).days if observed else None,
                "variant_id": existing.pk if existing is not None else None,
                "boarding_point_id": plan["points"][item["point_keys"][0]].pk
                if plan["points"][item["point_keys"][0]] is not None else None,
                "alighting_point_id": plan["points"][item["point_keys"][-1]].pk
                if plan["points"][item["point_keys"][-1]] is not None else None,
            })
        canonical = json.dumps(data, sort_keys=True, separators=(",", ":"), default=str)
        return {
            "database": database, "dataset_id": data["dataset_id"],
            "dataset_sha256": hashlib.sha256(canonical.encode()).hexdigest(),
            "applied": applied, "planned_records": counts, "directions": directions,
            "boundary_checked": bool(data["routes"]),
            "reviewed_direction_count": sum(
                entry["review_status"] == "reviewed" for entry in directions
            ),
        }

    @staticmethod
    def seed(payload, *, confirmation, apply=False):
        """Preview complete directions or atomically apply only human-reviewed local data."""
        database = TransitSeedService.validate_database(confirmation)
        serializer = TransitSeedDatasetSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if not data["routes"]:
            if apply:
                raise ValidationError(
                    "No reviewed directions are bundled yet; an empty seed cannot be applied."
                )
            return TransitSeedService._report(
                data, {"points": {}, "routes": {}, "variants": []}, database, False,
            )
        if apply:
            if any(
                variant["review"]["status"] != "reviewed"
                for route in data["routes"] for variant in route["variants"]
            ):
                raise ValidationError("Apply requires every supplied direction to be reviewed.")
            return TransitSeedService._apply(data, database)
        plan = TransitSeedService._plan(data)
        return TransitSeedService._report(data, plan, database, False)

    @staticmethod
    @transaction.atomic
    def _apply(data, database):
        """Recheck the plan under the shared network lock and never update or delete existing rows."""
        TransitSpatialValidationService.lock_network()
        plan = TransitSeedService._plan(data)
        before = TransitSeedService._report(data, plan, database, True)
        for item in data["points"]:
            if plan["points"][item["key"]] is None:
                point = TransitPoint(
                    TRPT_NAME=item["name"],
                    TRPT_POINT=Point(item["longitude"], item["latitude"], srid=4326),
                )
                point.full_clean()
                point.save()
                plan["points"][item["key"]] = point
        for code, route in plan["routes"].items():
            if route is None:
                route = JeepneyRoute(JRT_CODE=code)
                route.full_clean()
                route.save()
                plan["routes"][code] = route
        for entry in plan["variants"]:
            if entry["existing"] is not None:
                continue
            ordered = [plan["points"][key] for key in entry["data"]["point_keys"]]
            variant = JeepneyRouteVariant(
                JRT_ID=plan["routes"][entry["code"]],
                JRV_ORIGIN_ID=ordered[0], JRV_DESTINATION_ID=ordered[-1],
                JRV_GEOMETRY=entry["geometry"],
            )
            variant.full_clean()
            variant.save()
            for index, point in enumerate(ordered, start=1):
                membership = RouteTransitPoint(
                    JRV_ID=variant, TRPT_ID=point, RVTP_SEQUENCE=index,
                )
                membership.full_clean()
                membership.save()
            entry["existing"] = variant
        result = TransitSeedService._report(data, plan, database, True)
        result["planned_records"] = before["planned_records"]
        return result
