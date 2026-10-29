"""Listing-change backlog, outcomes and administrator turnaround contracts."""

from rest_framework import serializers

from .operations_analytics_serializers import QueueAgingSerializer
from .platform_analytics_serializers import AnalyticsMetaSerializer
from .reporting_serializers import TurnaroundSummarySerializer


class ChangeRequestBacklogMetaSerializer(serializers.Serializer):
    """Disclose current elapsed-hour aging independently of selected resolution dates."""

    measurement_type = serializers.ChoiceField(choices=("current_snapshot",))
    selected_period_applies = serializers.BooleanField()
    as_of = serializers.CharField()
    age_basis = serializers.CharField()


class ChangeRequestOutcomesSerializer(serializers.Serializer):
    """Keep merchant withdrawals distinct from approved and rejected decisions."""

    approved = serializers.IntegerField()
    rejected = serializers.IntegerField()
    withdrawn = serializers.IntegerField()


class ChangeRequestTypeSerializer(serializers.Serializer):
    """Expose aggregates for one persisted listing-change request type."""

    type = serializers.ChoiceField(choices=("name", "classification", "location"))
    label = serializers.CharField()
    backlog = QueueAgingSerializer()
    period_outcomes = ChangeRequestOutcomesSerializer()
    turnaround = TurnaroundSummarySerializer()
    missing_resolution_timestamp_count = serializers.IntegerField()


class ChangeRequestAnalyticsSerializer(serializers.Serializer):
    """Keep current backlog, period outcomes and pooled duration samples separate."""

    backlog = QueueAgingSerializer()
    backlog_meta = ChangeRequestBacklogMetaSerializer()
    period_outcomes = ChangeRequestOutcomesSerializer()
    turnaround = TurnaroundSummarySerializer()
    types = ChangeRequestTypeSerializer(many=True)
    missing_resolution_timestamp_count = serializers.IntegerField()
    missing_resolution_timestamp_scope = serializers.CharField()
    definition = serializers.CharField()
    meta = AnalyticsMetaSerializer()
