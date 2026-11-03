from rest_framework import serializers


class BusinessAvailabilityRequestSerializer(serializers.Serializer):
    """Bound an authenticated availability probe without disclosing restricted profiles."""

    business_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        min_length=1,
        max_length=100,
    )
