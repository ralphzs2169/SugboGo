from rest_framework import serializers


class DiscoveryFeedQuerySerializer(serializers.Serializer):
    """Validates optional taxonomy filters for the discovery feed."""

    category = serializers.IntegerField(
        min_value=1,
        required=False,
    )
    cluster = serializers.IntegerField(
        min_value=1,
        required=False,
    )
    specialty_tag = serializers.IntegerField(
        min_value=1,
        required=False,
    )
