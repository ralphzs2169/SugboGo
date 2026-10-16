"""Merchant timing query validation and aggregate-only heatmap output."""

from rest_framework import serializers

from .premium_analytics_serializers import PremiumReportSerializer
from .standard_analytics_serializers import StandardAnalyticsQuerySerializer


class EngagementHeatmapQuerySerializer(StandardAnalyticsQuerySerializer):
    """Accept reporting dates and the approved metric without ownership overrides."""

    metric = serializers.ChoiceField(choices=("profile_visits",), default="profile_visits")

    def validate(self, attrs):
        """Reject repeated parameters before resolving one inherited reporting clock."""
        if hasattr(self.initial_data, "getlist"):
            repeated = [key for key in self.initial_data if len(self.initial_data.getlist(key)) > 1]
            if repeated:
                raise serializers.ValidationError({key: "Provide this parameter only once." for key in repeated})
        return super().validate(attrs)


class EngagementWeekdaySerializer(serializers.Serializer):
    """Expose ordered ISO weekday identities and labels."""

    weekday = serializers.IntegerField()
    label = serializers.CharField()


class EngagementCellSerializer(serializers.Serializer):
    """Expose one timing aggregate while retaining unavailable and unselected slots."""

    id = serializers.CharField()
    weekday = serializers.IntegerField()
    hour = serializers.IntegerField()
    profile_visits = serializers.IntegerField(allow_null=True)
    state = serializers.ChoiceField(choices=("outside_period", "visibility_unavailable", "zero_recorded_visits", "recorded_visits"))
    period_occurrences = serializers.IntegerField()
    includes_partial_hour = serializers.BooleanField()


class EngagementSampleSerializer(serializers.Serializer):
    """Disclose count sparsity without inventing a conclusion threshold."""

    nonzero_cells = serializers.IntegerField(allow_null=True)
    in_period_cells = serializers.IntegerField()
    outside_period_cells = serializers.IntegerField()
    conclusions_available = serializers.BooleanField()
    reason = serializers.CharField()


class EngagementLegendSerializer(serializers.Serializer):
    """Describe a continuous count scale with explicit zero and unavailable ranges."""

    method = serializers.ChoiceField(choices=("linear_count",))
    minimum = serializers.IntegerField(allow_null=True)
    maximum = serializers.IntegerField(allow_null=True)
    zero_range = serializers.BooleanField(allow_null=True)


class EngagementSourcesSerializer(serializers.Serializer):
    """Reuse visibility coverage and freshness metadata without identity-level observations."""

    visibility = serializers.JSONField()


class EngagementHeatmapSerializer(PremiumReportSerializer):
    """Publish the owned-business timing matrix using the existing Premium envelope."""

    label = serializers.CharField()
    metric = serializers.ChoiceField(choices=("profile_visits",))
    timezone = serializers.CharField()
    grid_version = serializers.CharField()
    weekdays = EngagementWeekdaySerializer(many=True)
    hours = serializers.ListField(child=serializers.IntegerField())
    cells = EngagementCellSerializer(many=True)
    total_profile_visits = serializers.IntegerField(allow_null=True)
    display_state = serializers.ChoiceField(choices=("visibility_unavailable", "recorded_visits", "zero_recorded_visits"))
    sample = EngagementSampleSerializer()
    legend = EngagementLegendSerializer()
    deduplication = serializers.CharField()
    measurement_note = serializers.CharField()
    period_occurrences_note = serializers.CharField()
    sources = EngagementSourcesSerializer()
