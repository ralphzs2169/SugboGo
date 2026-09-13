from django.contrib.gis.geos import LineString
from django.db import transaction
from django.db.models import Prefetch
from rest_framework.exceptions import NotFound, ValidationError

from apps.transit.models import (
    JeepneyRouteVariant,
    RouteTransitPoint,
)


class RouteVariantService:
    """Manage directional variants and ordered route points atomically."""

    @staticmethod
    def _detail_queryset():
        """Build the optimized queryset for variant responses."""

        route_points = (
            RouteTransitPoint.objects
            .select_related(
                "TRPT_ID",
            )
            .order_by(
                "RVTP_SEQUENCE",
            )
        )

        return (
            JeepneyRouteVariant.objects
            .select_related(
                "JRT_ID",
                "JRV_ORIGIN_ID",
                "JRV_DESTINATION_ID",
            )
            .prefetch_related(
                Prefetch(
                    "route_transit_points",
                    queryset=route_points,
                ),
            )
        )

    @staticmethod
    def list_variants(
        route_id=None,
    ):
        """List directional variants, optionally restricted to one route."""

        queryset = RouteVariantService._detail_queryset()

        if route_id:
            queryset = queryset.filter(
                JRT_ID=route_id,
            )

        return queryset.order_by(
            "JRT_ID__JRT_CODE",
            "JRV_ID",
        )

    @staticmethod
    def get_variant(
        variant_id: int,
    ) -> JeepneyRouteVariant:
        """Retrieve a directional variant with ordered points."""

        try:
            return (
                RouteVariantService
                ._detail_queryset()
                .get(
                    JRV_ID=variant_id,
                )
            )
        except JeepneyRouteVariant.DoesNotExist:
            raise NotFound(
                "The jeepney route variant could not be found.",
            )

    @staticmethod
    def _build_geometry(
        coordinates,
    ) -> LineString:
        """Convert frontend coordinates into a WGS 84 LineString."""

        return LineString(
            [
                (
                    coordinate["longitude"],
                    coordinate["latitude"],
                )
                for coordinate in coordinates
            ],
            srid=4326,
        )

    @staticmethod
    def _validate_ordered_points(
        origin,
        destination,
        transit_points,
    ):
        """Validate the authoritative ordered point sequence."""

        if len(transit_points) < 2:
            raise ValidationError(
                {
                    "transit_point_ids": (
                        "At least two Transit Points are required."
                    ),
                },
            )

        transit_point_ids = [
            transit_point.TRPT_ID
            for transit_point in transit_points
        ]

        if len(transit_point_ids) != len(set(transit_point_ids)):
            raise ValidationError(
                {
                    "transit_point_ids": (
                        "Transit Points cannot be duplicated within a route variant."
                    ),
                },
            )

        if transit_points[0].TRPT_ID != origin.TRPT_ID:
            raise ValidationError(
                {
                    "transit_point_ids": (
                        "The first Transit Point must match the origin."
                    ),
                },
            )

        if transit_points[-1].TRPT_ID != destination.TRPT_ID:
            raise ValidationError(
                {
                    "transit_point_ids": (
                        "The last Transit Point must match the destination."
                    ),
                },
            )

    @staticmethod
    def _replace_ordered_points(
        variant,
        transit_points,
    ):
        """Replace a variant's ordered Transit Points within its transaction."""

        variant.route_transit_points.all().delete()

        RouteTransitPoint.objects.bulk_create(
            [
                RouteTransitPoint(
                    JRV_ID=variant,
                    TRPT_ID=transit_point,
                    RVTP_SEQUENCE=sequence,
                )
                for sequence, transit_point in enumerate(
                    transit_points,
                    start=1,
                )
            ],
        )

    @staticmethod
    @transaction.atomic
    def create_variant(
        validated_data,
    ) -> JeepneyRouteVariant:
        """Create a directional variant and ordered points atomically."""

        validated_data = validated_data.copy()
        coordinates = validated_data.pop("geometry")
        transit_points = validated_data.pop("ordered_transit_points")

        RouteVariantService._validate_ordered_points(
            validated_data["JRV_ORIGIN_ID"],
            validated_data["JRV_DESTINATION_ID"],
            transit_points,
        )

        variant = JeepneyRouteVariant.objects.create(
            JRV_GEOMETRY=(
                RouteVariantService
                ._build_geometry(
                    coordinates,
                )
            ),
            **validated_data,
        )

        RouteVariantService._replace_ordered_points(
            variant,
            transit_points,
        )

        return RouteVariantService.get_variant(
            variant.JRV_ID,
        )

    @staticmethod
    @transaction.atomic
    def update_variant(
        variant_id: int,
        validated_data,
    ) -> JeepneyRouteVariant:
        """Update a directional variant and replace ordered points atomically."""

        try:
            variant = (
                JeepneyRouteVariant.objects
                .select_for_update()
                .get(
                    JRV_ID=variant_id,
                )
            )
        except JeepneyRouteVariant.DoesNotExist:
            raise NotFound(
                "The jeepney route variant could not be found.",
            )

        validated_data = validated_data.copy()
        coordinates = validated_data.pop(
            "geometry",
            None,
        )
        transit_points = validated_data.pop(
            "ordered_transit_points",
            None,
        )

        origin = validated_data.get(
            "JRV_ORIGIN_ID",
            variant.JRV_ORIGIN_ID,
        )
        destination = validated_data.get(
            "JRV_DESTINATION_ID",
            variant.JRV_DESTINATION_ID,
        )

        if transit_points is None:
            transit_points = [
                route_point.TRPT_ID
                for route_point in (
                    variant.route_transit_points
                    .select_related(
                        "TRPT_ID",
                    )
                    .order_by(
                        "RVTP_SEQUENCE",
                    )
                )
            ]
            replace_transit_points = False
        else:
            replace_transit_points = True

        RouteVariantService._validate_ordered_points(
            origin,
            destination,
            transit_points,
        )

        update_fields = []

        for field_name, value in validated_data.items():
            setattr(
                variant,
                field_name,
                value,
            )
            update_fields.append(field_name)

        if coordinates is not None:
            variant.JRV_GEOMETRY = (
                RouteVariantService
                ._build_geometry(
                    coordinates,
                )
            )
            update_fields.append("JRV_GEOMETRY")

        if update_fields:
            update_fields.append("JRV_UPDATED_AT")
            variant.save(
                update_fields=update_fields,
            )

        if replace_transit_points:
            RouteVariantService._replace_ordered_points(
                variant,
                transit_points,
            )

        return RouteVariantService.get_variant(
            variant.JRV_ID,
        )
