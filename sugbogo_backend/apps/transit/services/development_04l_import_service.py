"""Match provisional 04L stop identities without putting OSM IDs in display names."""

from django.contrib.gis.geos import Point
from django.db.models import Q
from rest_framework.exceptions import ValidationError

from apps.admin_operations.transit_management.services.jeepney_route_service import (
    JeepneyRouteService,
)
from apps.admin_operations.transit_management.services.route_variant_service import (
    RouteVariantService,
)
from apps.admin_operations.transit_management.services.transit_point_service import (
    TransitPointService,
)
from apps.transit.models import JeepneyRoute, JeepneyRouteVariant, TransitPoint
from apps.transit.serializers.transit_seed_serializers import (
    TransitSeedDatasetSerializer,
)
from apps.transit.services.transit_seed_service import TransitSeedService


class Development04LSeedSerializer(TransitSeedDatasetSerializer):
    """Allow shared display names while retaining every other seed validation."""

    def validate(
        self,
        attrs,
    ):
        """Use unique OSM keys for the inherited name-uniqueness check only."""
        validation_data = attrs.copy()
        validation_data["points"] = [
            dict(point, name=point["key"])
            for point in attrs["points"]
        ]
        super().validate(validation_data)
        return attrs


class Development04LImportService:
    """Plan and apply only coordinate-exact 04L imports under the command's lock."""

    @staticmethod
    def plan(
        data,
    ):
        """Reject ambiguous physical matches and preserve existing direction records."""
        boundary = TransitSeedService._boundary()
        routes = list(
            JeepneyRoute.objects.filter(JRT_CODE__iexact="04L")[:2],
        )
        if len(routes) > 1:
            raise ValidationError("Route 04L has ambiguous existing route codes.")
        route = None
        if routes:
            route = routes[0]
            if route.JRT_CODE != "04L":
                raise ValidationError("The existing 04L route code is noncanonical.")

        by_coordinate = {}
        for point in TransitPoint.objects.all():
            if point.TRPT_POINT.empty or not point.TRPT_POINT.valid:
                continue
            coordinate = (point.TRPT_POINT.x, point.TRPT_POINT.y)
            by_coordinate.setdefault(coordinate, []).append(point)

        points = {}
        geometries = {}
        renames = []
        for item in data["points"]:
            location = Point(
                item["longitude"],
                item["latitude"],
                srid=4326,
            )
            matches = by_coordinate.get((location.x, location.y), [])
            if len(matches) > 1:
                raise ValidationError(f"{item['key']}: ambiguous existing coordinates.")
            point = None
            if matches:
                point = matches[0]
                node_id = item["key"].removeprefix("osm-node-")
                legacy_name = f"{item['name']} (OSM node {node_id})"
                if point.TRPT_NAME not in {item["name"], legacy_name}:
                    raise ValidationError(
                        f"{item['key']}: existing point name conflicts.",
                    )
                if point.TRPT_NAME == legacy_name:
                    memberships = point.route_memberships.all()
                    other_directions = JeepneyRouteVariant.objects.filter(
                        Q(JRV_ORIGIN_ID=point)
                        | Q(JRV_DESTINATION_ID=point)
                        | Q(route_transit_points__TRPT_ID=point),
                    ).exclude(JRT_ID=route)
                    if (
                        route is None
                        or not memberships.filter(JRV_ID__JRT_ID=route).exists()
                        or other_directions.exists()
                    ):
                        raise ValidationError(
                            f"{item['key']}: legacy point is not exclusive "
                            "to Route 04L.",
                        )
                    renames.append(item["key"])
            points[item["key"]] = point
            geometries[item["key"]] = location

        variants = []
        paths = []
        for item in data["routes"][0]["variants"]:
            geometry = TransitSeedService._validate_geometry(
                item,
                geometries,
                boundary,
            )
            if any(path.equals_exact(geometry, 0) for path in paths):
                raise ValidationError(f"{item['key']}: duplicate 04L path.")
            paths.append(geometry)
            ordered = [
                points[key]
                for key in item["point_keys"]
            ]
            existing = None
            if route is not None and all(ordered):
                existing = route.variants.filter(
                    JRV_ORIGIN_ID=ordered[0],
                    JRV_DESTINATION_ID=ordered[-1],
                ).first()
            if existing is not None:
                memberships = list(
                    existing.route_transit_points.order_by("RVTP_SEQUENCE")
                    .values_list("RVTP_SEQUENCE", "TRPT_ID_id"),
                )
                expected = [
                    (index, point.pk)
                    for index, point in enumerate(ordered, start=1)
                ]
                if (
                    not existing.JRV_GEOMETRY.equals_exact(geometry, 0)
                    or memberships != expected
                ):
                    raise ValidationError(f"{item['key']}: existing direction differs.")
            elif route is not None and any(
                variant.JRV_GEOMETRY.equals_exact(geometry, 0)
                for variant in route.variants.all()
            ):
                raise ValidationError(
                    f"{item['key']}: path exists with other endpoints.",
                )
            variants.append({
                "code": "04L",
                "data": item,
                "geometry": geometry,
                "existing": existing,
            })
        return {
            "points": points,
            "routes": {"04L": route},
            "variants": variants,
            "renames": renames,
        }

    @staticmethod
    def apply(
        data,
        plan,
    ):
        """Apply the locked plan through existing creation and name-update services."""
        for item in data["points"]:
            point = plan["points"][item["key"]]
            if point is None:
                point = TransitPointService.create_transit_point({
                    "name": item["name"],
                    "latitude": item["latitude"],
                    "longitude": item["longitude"],
                })
                plan["points"][item["key"]] = point
            elif item["key"] in plan["renames"]:
                TransitPointService.update_transit_point(
                    point.pk,
                    {"name": item["name"]},
                )

        route = plan["routes"]["04L"]
        if route is None:
            route = JeepneyRouteService.create_route({"code": "04L"})
            plan["routes"]["04L"] = route
        for entry in plan["variants"]:
            if entry["existing"] is not None:
                continue
            ordered = [
                plan["points"][key]
                for key in entry["data"]["point_keys"]
            ]
            entry["existing"] = RouteVariantService.create_variant({
                "JRT_ID": route,
                "JRV_ORIGIN_ID": ordered[0],
                "JRV_DESTINATION_ID": ordered[-1],
                "geometry": entry["data"]["geometry"],
                "ordered_transit_points": ordered,
            })
