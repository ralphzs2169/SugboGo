from rest_framework import serializers

from apps.admin_operations.transit_management.serializers.route_variant_serializers import (
    JeepneyRouteVariantSerializer,
)
from apps.transit.models import JeepneyRoute


class JeepneyRouteSerializer(serializers.ModelSerializer):
    """Serialize a jeepney route for administrator lists."""

    id = serializers.IntegerField(
        source="JRT_ID",
        read_only=True,
    )
    code = serializers.CharField(
        source="JRT_CODE",
        read_only=True,
    )
    variant_count = serializers.IntegerField(
        read_only=True,
    )
    created_at = serializers.DateTimeField(
        source="JRT_CREATED_AT",
        read_only=True,
    )
    updated_at = serializers.DateTimeField(
        source="JRT_UPDATED_AT",
        read_only=True,
    )

    class Meta:
        model = JeepneyRoute
        fields = (
            "id",
            "code",
            "variant_count",
            "created_at",
            "updated_at",
        )


class JeepneyRouteDetailSerializer(JeepneyRouteSerializer):
    """Serialize a jeepney route with directional variants."""

    variants = JeepneyRouteVariantSerializer(
        many=True,
        read_only=True,
    )

    class Meta(JeepneyRouteSerializer.Meta):
        fields = JeepneyRouteSerializer.Meta.fields + (
            "variants",
        )


class JeepneyRouteWriteSerializer(serializers.Serializer):
    """Validate jeepney route create and update payloads."""

    code = serializers.CharField(
        max_length=10,
    )

    def validate_code(self, value):
        """Normalize route codes and enforce case-insensitive uniqueness."""

        value = value.strip().upper()

        queryset = JeepneyRoute.objects.filter(
            JRT_CODE__iexact=value,
        )

        if self.instance is not None:
            queryset = queryset.exclude(
                JRT_ID=self.instance.JRT_ID,
            )

        if queryset.exists():
            raise serializers.ValidationError(
                "A jeepney route with this code already exists.",
            )

        return value
