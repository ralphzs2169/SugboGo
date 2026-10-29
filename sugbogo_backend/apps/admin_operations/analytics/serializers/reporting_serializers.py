"""Explicit shared contracts for SQL report comparisons, durations and intervals."""

from rest_framework import serializers

from .platform_analytics_serializers import (
    AnalyticsComparisonSerializer,
    AnalyticsPeriodQuerySerializer,
)


class ReportingSeriesQuerySerializer(AnalyticsPeriodQuerySerializer):
    """Reuse Manila reporting dates and validate daily or weekly grouping."""

    interval = serializers.ChoiceField(
        choices=("daily", "weekly"),
        default="daily",
    )


class CountComparisonSerializer(AnalyticsComparisonSerializer):
    """Expose the existing absolute-count comparison helper without percentage claims."""

    value = serializers.IntegerField(allow_null=True)
    unit = serializers.ChoiceField(choices=("count",))


class PeriodCountSerializer(serializers.Serializer):
    """Expose a selected-period count and adjacent equal-elapsed comparison."""

    value = serializers.IntegerField()
    previous_value = serializers.IntegerField()
    change = CountComparisonSerializer()


class TurnaroundSummarySerializer(serializers.Serializer):
    """Keep unavailable durations distinct from valid zero-hour administrator decisions."""

    candidate_count = serializers.IntegerField()
    sample_count = serializers.IntegerField()
    median_hours = serializers.FloatField(allow_null=True)
    mean_hours = serializers.FloatField(allow_null=True)
    excluded_count = serializers.IntegerField()
    missing_timestamp_count = serializers.IntegerField()
    invalid_chronology_count = serializers.IntegerField()
    unrelated_record_count = serializers.IntegerField()
