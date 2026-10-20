from rest_framework import serializers

from apps.business.services.discovery_source import normalize_discovery_source


class ImpressionBatchSerializer(serializers.Serializer):
    """Validates explicit business-card impression reports."""

    business_ids = serializers.ListField(
        child=serializers.IntegerField(
            min_value=1,
        ),
        allow_empty=False,
    )


class DiscoverySourceField(serializers.Field):
    """Normalize malformed optional attribution without rejecting a valid visit."""

    def to_internal_value(
        self,
        data,
    ):
        """Use unknown for every unsupported source, including structured values."""
        return normalize_discovery_source(data)


class ProfileVisitSerializer(serializers.Serializer):
    """Accept legacy empty requests and ignore unrelated previously ignored fields."""

    discovery_source = DiscoverySourceField(required=False, allow_null=True)

    def validate(
        self,
        attrs,
    ):
        """Apply the same unknown fallback for missing, null and invalid values."""
        attrs["discovery_source"] = normalize_discovery_source(
            attrs.get("discovery_source"),
        )
        return attrs
