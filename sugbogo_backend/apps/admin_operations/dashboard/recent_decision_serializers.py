"""Minimal safe response fields for the Dashboard's recent administrative decisions."""

from rest_framework import serializers


class DecisionEntitySerializer(serializers.Serializer):
    """Identify a recorded decision target with its current display label."""

    type = serializers.CharField(read_only=True)
    id = serializers.IntegerField(
        read_only=True,
        allow_null=True,
    )
    label = serializers.CharField(read_only=True)


class RecentDecisionSerializer(serializers.Serializer):
    """Expose decision identity and display fields without raw audit metadata or actor identifiers."""

    id = serializers.CharField(read_only=True)
    action = serializers.CharField(read_only=True)
    action_label = serializers.CharField(read_only=True)
    entity = DecisionEntitySerializer(read_only=True)
    administrator_name = serializers.CharField(read_only=True)
    timestamp = serializers.DateTimeField(read_only=True)


class RecentDecisionsSerializer(serializers.Serializer):
    """Serialize at most five supported administrative decisions in global recency order."""

    items = RecentDecisionSerializer(many=True, read_only=True)
