from rest_framework import serializers


class TaxonomyFilterQuerySerializer(serializers.Serializer):
    """Validate the taxonomy filters shared by Explorer collections."""

    category = serializers.ListField(
        child=serializers.IntegerField(
            min_value=1,
        ),
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


class DiscoveryFeedQuerySerializer(TaxonomyFilterQuerySerializer):
    """Validate optional search and taxonomy filters for discovery."""

    search = serializers.CharField(
        allow_blank=True,
        max_length=200,
        required=False,
        trim_whitespace=True,
    )
