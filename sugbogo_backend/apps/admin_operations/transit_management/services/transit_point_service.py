from django.contrib.gis.geos import Point
from django.db import transaction
from django.db.models import Q
from rest_framework.exceptions import NotFound, ValidationError

from apps.transit.models import JeepneyRouteVariant, TransitPoint
from apps.transit.services.transit_spatial_validation_service import TransitSpatialValidationService


class TransitPointService:
    """Manage SugboGo transit-network points."""

    @staticmethod
    def list_transit_points(
        search=None,
        ordering=None,
    ):
        """List transit points with optional search and ordering."""

        queryset = TransitPoint.objects.all()

        if search:
            queryset = queryset.filter(
                TRPT_NAME__icontains=search,
            )

        ordering_map = {
            "name": "TRPT_NAME",
            "-name": "-TRPT_NAME",
            "created_at": "TRPT_CREATED_AT",
            "-created_at": "-TRPT_CREATED_AT",
        }

        return queryset.order_by(
            ordering_map.get(
                ordering,
                "TRPT_NAME",
            ),
            "TRPT_ID",
        )

    @staticmethod
    def get_transit_point(
        transit_point_id: int,
    ) -> TransitPoint:
        """Retrieve a transit point by ID."""

        try:
            return TransitPoint.objects.get(
                TRPT_ID=transit_point_id,
            )
        except TransitPoint.DoesNotExist:
            raise NotFound(
                "The Transit Point could not be found.",
            )

    @staticmethod
    @transaction.atomic
    def create_transit_point(
        validated_data,
    ) -> TransitPoint:
        """Create a transit point from frontend coordinate fields."""

        TransitSpatialValidationService.lock_network()
        location = Point(
            x=validated_data["longitude"],
            y=validated_data["latitude"],
            srid=4326,
        )
        TransitSpatialValidationService.validate_point(location)
        return TransitPoint.objects.create(
            TRPT_NAME=validated_data["name"],
            TRPT_POINT=location,
        )

    @staticmethod
    @transaction.atomic
    def update_transit_point(
        transit_point_id: int,
        validated_data,
    ) -> TransitPoint:
        """Update a transit point and any supplied coordinates."""

        TransitSpatialValidationService.lock_network()
        try:
            transit_point = (
                TransitPoint.objects
                .select_for_update()
                .get(
                    TRPT_ID=transit_point_id,
                )
            )
        except TransitPoint.DoesNotExist:
            raise NotFound(
                "The Transit Point could not be found.",
            )

        update_fields = []

        if "name" in validated_data:
            transit_point.TRPT_NAME = validated_data["name"]
            update_fields.append("TRPT_NAME")

        has_latitude = "latitude" in validated_data
        has_longitude = "longitude" in validated_data

        if has_latitude != has_longitude:
            raise ValidationError(
                {
                    "coordinates": (
                        "Latitude and longitude must be provided together."
                    ),
                },
            )

        if has_latitude and has_longitude:
            location = Point(
                x=validated_data["longitude"],
                y=validated_data["latitude"],
                srid=4326,
            )
            if not location.equals_exact(transit_point.TRPT_POINT, 0):
                boundary = TransitSpatialValidationService.boundary()
                TransitSpatialValidationService.validate_point(location, boundary)
                variants = (
                    JeepneyRouteVariant.objects.filter(
                        Q(JRV_ORIGIN_ID=transit_point)
                        | Q(JRV_DESTINATION_ID=transit_point)
                        | Q(route_transit_points__TRPT_ID=transit_point),
                    )
                    .select_related("JRT_ID", "JRV_ORIGIN_ID", "JRV_DESTINATION_ID")
                    .prefetch_related("route_transit_points__TRPT_ID")
                    .distinct()
                    .order_by("JRV_ID")
                )
                for variant in variants:
                    points = [item.TRPT_ID for item in variant.route_transit_points.all()]
                    if (
                        not points or points[0].pk != variant.JRV_ORIGIN_ID_id
                        or points[-1].pk != variant.JRV_DESTINATION_ID_id
                    ):
                        raise ValidationError({
                            "non_field_errors": (
                                f"Direction {variant.pk} has inconsistent stop memberships. "
                                "Repair its path and stops before moving a shared stop."
                            ),
                        })
                    try:
                        TransitSpatialValidationService.validate_variant(
                            variant.JRV_GEOMETRY, points, boundary,
                            overrides={transit_point.pk: location},
                        )
                    except ValidationError as exc:
                        messages = [str(value) for value in exc.detail.values()]
                        raise ValidationError({
                            "latitude": (
                                f"This move would invalidate {variant.JRT_ID.JRT_CODE} "
                                f"direction {variant.pk}: {' '.join(messages)}"
                            ),
                        }) from exc
            transit_point.TRPT_POINT = location
            update_fields.append("TRPT_POINT")

        if update_fields:
            update_fields.append("TRPT_UPDATED_AT")
            transit_point.save(
                update_fields=update_fields,
            )

        return transit_point

