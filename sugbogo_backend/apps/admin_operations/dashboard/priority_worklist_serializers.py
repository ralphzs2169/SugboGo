"""Explicit safe response fields for the Dashboard Priority Worklist."""

from rest_framework import serializers


class WorklistEntitySerializer(serializers.Serializer):
    """Expose the workflow target ID and a current public business or application label."""

    id = serializers.IntegerField(read_only=True)
    label = serializers.CharField(read_only=True)


class WorklistApplicationAgingSerializer(serializers.Serializer):
    """Preserve existing queue states without inventing an age for unclassified applications."""

    status = serializers.CharField(read_only=True)
    business_days = serializers.IntegerField(
        read_only=True,
        allow_null=True,
    )


class PriorityWorkItemSerializer(serializers.Serializer):
    """Serialize workflow identity, real queue time, and minimal actionable metadata."""

    id = serializers.CharField(read_only=True)
    type = serializers.CharField(read_only=True)
    title = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    timestamp = serializers.DateTimeField(
        read_only=True,
        allow_null=True,
    )
    timestamp_source = serializers.CharField(
        read_only=True,
        allow_null=True,
    )
    priority = serializers.CharField(read_only=True)
    entity = WorklistEntitySerializer(read_only=True)
    application_aging = WorklistApplicationAgingSerializer(
        read_only=True,
        allow_null=True,
    )
    pending_report_count = serializers.IntegerField(
        read_only=True,
        allow_null=True,
    )


class PriorityWorklistSerializer(serializers.Serializer):
    """Return a bounded independently assembled pending-work selection with its reference time."""

    as_of = serializers.DateTimeField(read_only=True)
    items = PriorityWorkItemSerializer(
        many=True,
        read_only=True,
    )
