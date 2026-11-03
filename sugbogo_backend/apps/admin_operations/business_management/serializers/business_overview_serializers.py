"""Response contract for the Business Management overview."""

from rest_framework import serializers

from apps.admin_operations.dashboard.serializers import (
    BusinessStatusSerializer,
    DashboardChangeRequestsSerializer,
)


class NewBusinessesSerializer(serializers.Serializer):
    """Describe retained additions and optional equal-elapsed prior-month counts."""

    count = serializers.IntegerField(read_only=True)
    previous_count = serializers.IntegerField(read_only=True, allow_null=True)
    difference = serializers.IntegerField(read_only=True, allow_null=True)
    comparison_available = serializers.BooleanField(read_only=True)
    comparison_reason = serializers.CharField(read_only=True, allow_null=True)
    period_start = serializers.DateTimeField(read_only=True)
    period_end = serializers.DateTimeField(read_only=True)
    previous_period_start = serializers.DateTimeField(read_only=True)
    previous_period_end = serializers.DateTimeField(read_only=True, allow_null=True)
    timezone = serializers.CharField(read_only=True)


class BusinessOverviewSerializer(serializers.Serializer):
    """Expose current counts without implying historical inventory snapshots."""

    as_of = serializers.DateTimeField(read_only=True)
    business_status = BusinessStatusSerializer(read_only=True)
    new_businesses = NewBusinessesSerializer(read_only=True)
    change_requests = DashboardChangeRequestsSerializer(read_only=True)
