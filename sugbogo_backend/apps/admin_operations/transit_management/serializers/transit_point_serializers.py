from rest_framework import serializers

from apps.transit.models import TransitPoint


class TransitPointSerializer(serializers.ModelSerializer):
    """Serialize a managed transit point with latitude and longitude."""

    id = serializers.IntegerField(
        source="TRPT_ID",
        read_only=True,
    )
    name = serializers.CharField(
        source="TRPT_NAME",
        read_only=True,
    )
    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(
        source="TRPT_CREATED_AT",
        read_only=True,
    )
    updated_at = serializers.DateTimeField(
        source="TRPT_UPDATED_AT",
        read_only=True,
    )

    class Meta:
        model = TransitPoint
        fields = (
            "id",
            "name",
            "latitude",
            "longitude",
            "created_at",
            "updated_at",
        )

    def get_latitude(self, instance):
        """Return the point latitude."""

        return instance.TRPT_POINT.y

    def get_longitude(self, instance):
        """Return the point longitude."""

        return instance.TRPT_POINT.x


class TransitPointWriteSerializer(serializers.Serializer):
    """Validate transit point create and update payloads."""

    name = serializers.CharField(
        max_length=150,
    )
    latitude = serializers.FloatField(
        min_value=-90,
        max_value=90,
    )
    longitude = serializers.FloatField(
        min_value=-180,
        max_value=180,
    )

    def validate_name(self, value):
        """Normalize the managed transit point name."""

        return value.strip()
