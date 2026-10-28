"""Current multi-label specialty evidence without supporter identities."""

from rest_framework import serializers

from .platform_analytics_serializers import AnalyticsMetaSerializer


class SpecialtySupportSummarySerializer(serializers.Serializer):
    """Distinguish endorsement records from global distinct people and businesses."""

    valid_vouches = serializers.IntegerField()
    distinct_supporters = serializers.IntegerField()
    supported_businesses = serializers.IntegerField()
    supported_specialties = serializers.IntegerField()


class SpecialtySupportRowSerializer(serializers.Serializer):
    """Expose one supported specialty and distinct populations within that specialty."""

    specialty_id = serializers.IntegerField()
    name = serializers.CharField()
    valid_vouches = serializers.IntegerField()
    distinct_supporters = serializers.IntegerField()
    supported_businesses = serializers.IntegerField()


class SpecialtySupportSerializer(serializers.Serializer):
    """Label current support independently of selected historical dates."""

    measurement_type = serializers.ChoiceField(choices=("current_snapshot",))
    selected_period_applies = serializers.BooleanField()
    as_of = serializers.CharField()
    summary = SpecialtySupportSummarySerializer()
    specialties = SpecialtySupportRowSerializer(many=True)
    top_supported_specialties = SpecialtySupportRowSerializer(many=True)
    top_limit = serializers.IntegerField()
    definition = serializers.CharField()
    meta = AnalyticsMetaSerializer()
