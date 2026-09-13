from rest_framework import serializers

from apps.admin_operations.transit_management.serializers.transit_point_serializers import (
    TransitPointSerializer,
)
from apps.transit.models import (
    JeepneyRoute,
    JeepneyRouteVariant,
    TransitPoint,
)


class CoordinateSerializer(serializers.Serializer):
    """Validate one frontend-friendly WGS 84 coordinate."""

    latitude = serializers.FloatField(
        min_value=-90,
        max_value=90,
    )
    longitude = serializers.FloatField(
        min_value=-180,
        max_value=180,
    )


class OrderedTransitPointSerializer(serializers.Serializer):
    """Serialize one ordered point membership on a route variant."""

    sequence = serializers.IntegerField(
        source="RVTP_SEQUENCE",
        read_only=True,
    )
    transit_point = TransitPointSerializer(
        source="TRPT_ID",
        read_only=True,
    )


class JeepneyRouteVariantSerializer(serializers.ModelSerializer):
    """Serialize a directional route variant and its ordered points."""

    id = serializers.IntegerField(
        source="JRV_ID",
        read_only=True,
    )
    route_id = serializers.IntegerField(
        source="JRT_ID_id",
        read_only=True,
    )
    route_code = serializers.CharField(
        source="JRT_ID.JRT_CODE",
        read_only=True,
    )
    origin = TransitPointSerializer(
        source="JRV_ORIGIN_ID",
        read_only=True,
    )
    destination = TransitPointSerializer(
        source="JRV_DESTINATION_ID",
        read_only=True,
    )
    geometry = serializers.SerializerMethodField()
    transit_points = OrderedTransitPointSerializer(
        source="route_transit_points",
        many=True,
        read_only=True,
    )
    created_at = serializers.DateTimeField(
        source="JRV_CREATED_AT",
        read_only=True,
    )
    updated_at = serializers.DateTimeField(
        source="JRV_UPDATED_AT",
        read_only=True,
    )

    class Meta:
        model = JeepneyRouteVariant
        fields = (
            "id",
            "route_id",
            "route_code",
            "origin",
            "destination",
            "geometry",
            "transit_points",
            "created_at",
            "updated_at",
        )

    def get_geometry(self, instance):
        """Return LineString coordinates in map-editor order."""

        return [
            {
                "latitude": latitude,
                "longitude": longitude,
            }
            for longitude, latitude in instance.JRV_GEOMETRY.coords
        ]


class JeepneyRouteVariantSummarySerializer(serializers.ModelSerializer):
    """Serialize identifying information for a route variant."""

    id = serializers.IntegerField(
        source="JRV_ID",
        read_only=True,
    )
    route_id = serializers.IntegerField(
        source="JRT_ID_id",
        read_only=True,
    )
    route_code = serializers.CharField(
        source="JRT_ID.JRT_CODE",
        read_only=True,
    )
    origin = TransitPointSerializer(
        source="JRV_ORIGIN_ID",
        read_only=True,
    )
    destination = TransitPointSerializer(
        source="JRV_DESTINATION_ID",
        read_only=True,
    )

    class Meta:
        model = JeepneyRouteVariant
        fields = (
            "id",
            "route_id",
            "route_code",
            "origin",
            "destination",
        )


class JeepneyRouteVariantWriteSerializer(serializers.Serializer):
    """Validate coherent directional route variant writes."""

    route_id = serializers.PrimaryKeyRelatedField(
        source="JRT_ID",
        queryset=JeepneyRoute.objects.all(),
    )
    origin_transit_point_id = serializers.PrimaryKeyRelatedField(
        source="JRV_ORIGIN_ID",
        queryset=TransitPoint.objects.all(),
    )
    destination_transit_point_id = serializers.PrimaryKeyRelatedField(
        source="JRV_DESTINATION_ID",
        queryset=TransitPoint.objects.all(),
    )
    geometry = CoordinateSerializer(
        many=True,
    )
    transit_point_ids = serializers.PrimaryKeyRelatedField(
        source="ordered_transit_points",
        queryset=TransitPoint.objects.all(),
        many=True,
    )

    def validate_geometry(self, value):
        """Require at least two ordered coordinates for a LineString."""

        if len(value) < 2:
            raise serializers.ValidationError(
                "Route geometry must contain at least two coordinates.",
            )

        return value

    def validate_transit_point_ids(self, value):
        """Require at least two unique ordered Transit Points."""

        if len(value) < 2:
            raise serializers.ValidationError(
                "At least two Transit Points are required.",
            )

        transit_point_ids = [
            transit_point.TRPT_ID
            for transit_point in value
        ]

        if len(transit_point_ids) != len(set(transit_point_ids)):
            raise serializers.ValidationError(
                "Transit Points cannot be duplicated within a route variant.",
            )

        return value

    def validate(self, attrs):
        """Validate endpoints, ordered points, and direction uniqueness."""

        instance = self.instance

        route = attrs.get(
            "JRT_ID",
            getattr(instance, "JRT_ID", None),
        )
        origin = attrs.get(
            "JRV_ORIGIN_ID",
            getattr(instance, "JRV_ORIGIN_ID", None),
        )
        destination = attrs.get(
            "JRV_DESTINATION_ID",
            getattr(instance, "JRV_DESTINATION_ID", None),
        )
        ordered_transit_points = attrs.get("ordered_transit_points")

        if ordered_transit_points is None and instance is not None:
            ordered_transit_points = [
                route_point.TRPT_ID
                for route_point in instance.route_transit_points.all()
            ]

        if (
            origin is not None
            and destination is not None
            and origin.TRPT_ID == destination.TRPT_ID
        ):
            raise serializers.ValidationError(
                {
                    "destination_transit_point_id": (
                        "The destination must differ from the origin."
                    ),
                },
            )

        if ordered_transit_points:
            if ordered_transit_points[0].TRPT_ID != origin.TRPT_ID:
                raise serializers.ValidationError(
                    {
                        "transit_point_ids": (
                            "The first Transit Point must match the origin."
                        ),
                    },
                )

            if ordered_transit_points[-1].TRPT_ID != destination.TRPT_ID:
                raise serializers.ValidationError(
                    {
                        "transit_point_ids": (
                            "The last Transit Point must match the destination."
                        ),
                    },
                )

        direction_queryset = JeepneyRouteVariant.objects.filter(
            JRT_ID=route,
            JRV_ORIGIN_ID=origin,
            JRV_DESTINATION_ID=destination,
        )

        if instance is not None:
            direction_queryset = direction_queryset.exclude(
                JRV_ID=instance.JRV_ID,
            )

        if direction_queryset.exists():
            raise serializers.ValidationError(
                "This route direction already exists.",
            )

        return attrs
