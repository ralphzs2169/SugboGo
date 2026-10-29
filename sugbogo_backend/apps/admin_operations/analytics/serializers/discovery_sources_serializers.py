"""Aggregate-only platform discovery source response."""

from rest_framework import serializers

from apps.business.services.discovery_source import DiscoverySource
from .platform_analytics_serializers import AnalyticsMetaSerializer


class DiscoverySourceRowSerializer(serializers.Serializer):
    """Retain canonical source identities and nullable shares for empty populations."""

    source = serializers.ChoiceField(choices=tuple(DiscoverySource))
    label = serializers.CharField()
    count = serializers.IntegerField()
    share_percent = serializers.FloatField(allow_null=True)


class AdminDiscoverySourcesSerializer(serializers.Serializer):
    """Keep unavailable observations distinct from healthy zero counts."""

    total_profile_visits = serializers.IntegerField(allow_null=True)
    sources = DiscoverySourceRowSerializer(many=True, allow_null=True)
    definitions = serializers.DictField(child=serializers.CharField())
    meta = AnalyticsMetaSerializer()
