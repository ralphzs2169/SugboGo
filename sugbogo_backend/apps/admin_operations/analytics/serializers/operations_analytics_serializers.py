"""Explicit aggregate contracts for administrator operational analytics."""

from rest_framework import serializers

from apps.admin_operations.analytics.serializers.platform_analytics_serializers import AnalyticsMetaSerializer
from apps.admin_operations.analytics.serializers.reporting_serializers import (
    TurnaroundSummarySerializer,
)


class ApplicationTurnaroundSerializer(TurnaroundSummarySerializer):
    """Describe linked review durations and globally unassignable missing decision times."""

    missing_decision_timestamp_count = serializers.IntegerField()
    missing_decision_timestamp_scope = serializers.CharField()
    measurement_type = serializers.ChoiceField(choices=("review_decision_period",))
    definition = serializers.CharField()


class RejectionSectionSerializer(serializers.Serializer):
    """Count overlapping decision and application populations per persisted section."""

    section = serializers.CharField()
    label = serializers.CharField()
    rejection_decisions = serializers.IntegerField()
    distinct_applications = serializers.IntegerField()
    decision_share_percentage = serializers.FloatField(allow_null=True)
    application_share_percentage = serializers.FloatField(allow_null=True)


class RejectionInsightsSerializer(serializers.Serializer):
    """Keep raw feedback-row multiplicity out of administrator rejection counts."""

    rejected_decisions = serializers.IntegerField()
    distinct_applications = serializers.IntegerField()
    decisions_without_section_feedback = serializers.IntegerField()
    decisions_with_unrecognized_section = serializers.IntegerField()
    sections = RejectionSectionSerializer(many=True)
    definition = serializers.CharField()


class LegacyOnboardingMetaSerializer(serializers.Serializer):
    """Disclose the approved legacy timezone and native-window exception."""

    timezone = serializers.CharField()
    as_of = serializers.CharField()
    selected_period_applies = serializers.BooleanField()
    weekly_window = serializers.DictField(child=serializers.CharField())
    daily_history_days = serializers.IntegerField()
    policy_version = serializers.IntegerField()
    comparison_minimum_sample = serializers.IntegerField()
    definitions = serializers.CharField()
    exception = serializers.CharField()


class PendingApplicationAgingSerializer(serializers.Serializer):
    """Expose pending counts using existing business-day SLA bands."""

    on_time = serializers.IntegerField()
    approaching = serializers.IntegerField()
    overdue = serializers.IntegerField()
    unknown_age = serializers.IntegerField()


class ApplicationAgingMetaSerializer(serializers.Serializer):
    """Label current backlog, timezone and shared SLA thresholds."""

    measurement_type = serializers.CharField()
    timezone = serializers.CharField()
    as_of = serializers.CharField()
    approaching_business_days = serializers.IntegerField()
    overdue_business_days = serializers.IntegerField()
    definition = serializers.CharField()


class OnboardingWeeklyPointSerializer(serializers.Serializer):
    """Expose paired event counts with clipped weekly boundaries."""

    date = serializers.CharField()
    start = serializers.CharField()
    end_exclusive = serializers.CharField()
    submissions = serializers.IntegerField()
    completed_reviews = serializers.IntegerField()


class OnboardingAnalyticsSerializer(serializers.Serializer):
    """Preserve the existing statistics payload and explicitly scope new aggregates."""

    # Approved legacy exception: preserve the existing aggregate-only service contract.
    review_turnaround = ApplicationTurnaroundSerializer()
    rejection_insights = RejectionInsightsSerializer()
    processing_meta = AnalyticsMetaSerializer()
    legacy_statistics = serializers.JSONField()
    legacy_meta = LegacyOnboardingMetaSerializer()
    pending_aging = PendingApplicationAgingSerializer()
    aging_meta = ApplicationAgingMetaSerializer()
    weekly_activity = OnboardingWeeklyPointSerializer(many=True)
    weekly_activity_definition = serializers.CharField()
    meta = AnalyticsMetaSerializer()


class QueueAgingSerializer(serializers.Serializer):
    """Expose exhaustive current pending counts without record identities."""

    total = serializers.IntegerField()
    under_1_day = serializers.IntegerField()
    days_1_to_2 = serializers.IntegerField()
    days_3_plus = serializers.IntegerField()
    unknown_age = serializers.IntegerField()


class QueueMetaSerializer(serializers.Serializer):
    """Disclose snapshot scope and incomplete historical reconstruction."""

    measurement_type = serializers.CharField()
    as_of = serializers.CharField()
    selected_period_applies = serializers.BooleanField()
    age_basis = serializers.CharField()
    history_available = serializers.BooleanField()
    report_history = serializers.CharField()
    dispute_history = serializers.CharField()


class DisputeTurnaroundSerializer(serializers.Serializer):
    """Expose nullable median, sample size and timestamp exclusions."""

    median_hours = serializers.FloatField(allow_null=True)
    sample_count = serializers.IntegerField()
    excluded_invalid_duration_count = serializers.IntegerField()
    missing_resolution_timestamp_count = serializers.IntegerField()
    missing_timestamp_scope = serializers.CharField()
    measurement_type = serializers.CharField()
    definition = serializers.CharField()


class AttentionQueueSerializer(serializers.Serializer):
    """Separate current queues from recorded resolution-period turnaround."""

    open_reports = QueueAgingSerializer()
    open_disputes = QueueAgingSerializer()
    queue_meta = QueueMetaSerializer()
    completed_dispute_turnaround = DisputeTurnaroundSerializer()
    turnaround_meta = AnalyticsMetaSerializer()
    meta = AnalyticsMetaSerializer()
