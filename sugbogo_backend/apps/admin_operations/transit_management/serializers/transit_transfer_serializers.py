from rest_framework import serializers

from apps.admin_operations.transit_management.serializers.route_variant_serializers import (
    JeepneyRouteVariantSummarySerializer,
)
from apps.admin_operations.transit_management.serializers.transit_point_serializers import (
    TransitPointSerializer,
)
from apps.transit.models import (
    JeepneyRouteVariant,
    TransitPoint,
    TransitTransfer,
)


class TransitTransferSerializer(serializers.ModelSerializer):
    """Serialize a directed transfer and its connection points."""

    id = serializers.IntegerField(
        source="TTFR_ID",
        read_only=True,
    )
    source_variant = JeepneyRouteVariantSummarySerializer(
        source="TTFR_FROM_VARIANT_ID",
        read_only=True,
    )
    destination_variant = JeepneyRouteVariantSummarySerializer(
        source="TTFR_TO_VARIANT_ID",
        read_only=True,
    )
    alighting_transit_point = TransitPointSerializer(
        source="TTFR_FROM_TRANSIT_POINT_ID",
        read_only=True,
    )
    boarding_transit_point = TransitPointSerializer(
        source="TTFR_TO_TRANSIT_POINT_ID",
        read_only=True,
    )
    status = serializers.CharField(
        source="TTFR_STATUS",
        read_only=True,
    )
    created_at = serializers.DateTimeField(
        source="TTFR_CREATED_AT",
        read_only=True,
    )
    updated_at = serializers.DateTimeField(
        source="TTFR_UPDATED_AT",
        read_only=True,
    )

    class Meta:
        model = TransitTransfer
        fields = (
            "id",
            "source_variant",
            "alighting_transit_point",
            "boarding_transit_point",
            "destination_variant",
            "status",
            "created_at",
            "updated_at",
        )


class TransitTransferWriteSerializer(serializers.Serializer):
    """Validate directed manual transfer writes."""

    source_variant_id = serializers.PrimaryKeyRelatedField(
        source="TTFR_FROM_VARIANT_ID",
        queryset=JeepneyRouteVariant.objects.all(),
    )
    destination_variant_id = serializers.PrimaryKeyRelatedField(
        source="TTFR_TO_VARIANT_ID",
        queryset=JeepneyRouteVariant.objects.all(),
    )
    alighting_transit_point_id = serializers.PrimaryKeyRelatedField(
        source="TTFR_FROM_TRANSIT_POINT_ID",
        queryset=TransitPoint.objects.all(),
    )
    boarding_transit_point_id = serializers.PrimaryKeyRelatedField(
        source="TTFR_TO_TRANSIT_POINT_ID",
        queryset=TransitPoint.objects.all(),
    )

    def validate(self, attrs):
        """Validate variant direction, memberships, and uniqueness."""

        instance = self.instance

        source_variant = attrs.get(
            "TTFR_FROM_VARIANT_ID",
            getattr(instance, "TTFR_FROM_VARIANT_ID", None),
        )
        destination_variant = attrs.get(
            "TTFR_TO_VARIANT_ID",
            getattr(instance, "TTFR_TO_VARIANT_ID", None),
        )
        alighting_point = attrs.get(
            "TTFR_FROM_TRANSIT_POINT_ID",
            getattr(instance, "TTFR_FROM_TRANSIT_POINT_ID", None),
        )
        boarding_point = attrs.get(
            "TTFR_TO_TRANSIT_POINT_ID",
            getattr(instance, "TTFR_TO_TRANSIT_POINT_ID", None),
        )

        if source_variant.JRV_ID == destination_variant.JRV_ID:
            raise serializers.ValidationError(
                {
                    "destination_variant_id": (
                        "The destination variant must differ from the source."
                    ),
                },
            )

        if not source_variant.route_transit_points.filter(
            TRPT_ID=alighting_point,
        ).exists():
            raise serializers.ValidationError(
                {
                    "alighting_transit_point_id": (
                        "The alighting point must belong to the source variant."
                    ),
                },
            )

        if not destination_variant.route_transit_points.filter(
            TRPT_ID=boarding_point,
        ).exists():
            raise serializers.ValidationError(
                {
                    "boarding_transit_point_id": (
                        "The boarding point must belong to the destination variant."
                    ),
                },
            )

        duplicate_queryset = TransitTransfer.objects.filter(
            TTFR_FROM_VARIANT_ID=source_variant,
            TTFR_TO_VARIANT_ID=destination_variant,
            TTFR_FROM_TRANSIT_POINT_ID=alighting_point,
            TTFR_TO_TRANSIT_POINT_ID=boarding_point,
        )

        if instance is not None:
            duplicate_queryset = duplicate_queryset.exclude(
                TTFR_ID=instance.TTFR_ID,
            )

        if duplicate_queryset.exists():
            raise serializers.ValidationError(
                "This directed transfer connection already exists.",
            )

        return attrs

