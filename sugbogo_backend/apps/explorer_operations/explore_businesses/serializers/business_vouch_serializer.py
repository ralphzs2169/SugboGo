from rest_framework import serializers


class BusinessVouchSerializer(serializers.Serializer):
    """Validates the request data for adding or removing a business vouch."""

    tag_id = serializers.IntegerField(
        min_value=1,
    )
    device_id = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        allow_null=True,
    )