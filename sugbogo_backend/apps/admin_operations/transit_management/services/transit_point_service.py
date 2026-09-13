from django.contrib.gis.geos import Point
from django.db import transaction
from rest_framework.exceptions import NotFound, ValidationError

from apps.transit.models import TransitPoint


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

        return TransitPoint.objects.create(
            TRPT_NAME=validated_data["name"],
            TRPT_POINT=Point(
                x=validated_data["longitude"],
                y=validated_data["latitude"],
                srid=4326,
            ),
        )

    @staticmethod
    @transaction.atomic
    def update_transit_point(
        transit_point_id: int,
        validated_data,
    ) -> TransitPoint:
        """Update a transit point and any supplied coordinates."""

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
            transit_point.TRPT_POINT = Point(
                x=validated_data["longitude"],
                y=validated_data["latitude"],
                srid=4326,
            )
            update_fields.append("TRPT_POINT")

        if update_fields:
            update_fields.append("TRPT_UPDATED_AT")
            transit_point.save(
                update_fields=update_fields,
            )

        return transit_point

