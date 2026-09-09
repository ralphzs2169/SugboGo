from rest_framework import serializers


class ImpressionBatchSerializer(serializers.Serializer):
    """Validates explicit business-card impression reports."""

    business_ids = serializers.ListField(
        child=serializers.IntegerField(
            min_value=1,
        ),
        allow_empty=False,
    )
