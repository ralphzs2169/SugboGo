from rest_framework import serializers

from apps.business.services.discovery_source import DiscoverySource
from .standard_analytics_serializers import (
    OwnedBusinessSerializer,
    StandardAnalyticsQuerySerializer,
    StandardMetaSerializer,
)


class DiscoverySourcesQuerySerializer(StandardAnalyticsQuerySerializer):
    """Limit this Standard report to the three established mobile periods."""

    period = serializers.ChoiceField(choices=("7", "30", "90"), default="30")
    start_date = None
    end_date = None


class DiscoverySourceCountSerializer(serializers.Serializer):
    """Expose only approved source identifiers and server-owned display labels."""

    source = serializers.ChoiceField(choices=tuple(DiscoverySource))
    label = serializers.CharField()
    count = serializers.IntegerField(min_value=0)


class DiscoverySourcesSerializer(serializers.Serializer):
    """Distinguish incomplete attribution from unavailable recorded activity."""

    business = OwnedBusinessSerializer()
    profile_visits = serializers.IntegerField(allow_null=True)
    sources = DiscoverySourceCountSerializer(many=True, allow_null=True)
    attribution_complete = serializers.BooleanField(allow_null=True)
    meta = StandardMetaSerializer()
