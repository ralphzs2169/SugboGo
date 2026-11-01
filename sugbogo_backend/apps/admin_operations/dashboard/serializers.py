"""Response contract for current Admin Dashboard operational counts."""

from rest_framework import serializers


class ApplicationAgingSerializer(serializers.Serializer):
    """Expose disjoint queue age groups and unclassified submitted applications."""

    on_time = serializers.IntegerField(read_only=True)
    approaching = serializers.IntegerField(read_only=True)
    overdue = serializers.IntegerField(read_only=True)
    unknown_age = serializers.IntegerField(read_only=True)


class DashboardApplicationsSerializer(serializers.Serializer):
    """Describe submitted application inventory and its existing weekday queue ages."""

    pending_review = serializers.IntegerField(read_only=True)
    aging = ApplicationAgingSerializer(read_only=True)


class PendingChangeRequestTypesSerializer(serializers.Serializer):
    """Expose pending request counts independently for each persisted workflow."""

    business_name = serializers.IntegerField(read_only=True)
    classification = serializers.IntegerField(read_only=True)
    location = serializers.IntegerField(read_only=True)


class DashboardChangeRequestsSerializer(serializers.Serializer):
    """Describe the pending request total and its additive type breakdown."""

    pending_total = serializers.IntegerField(read_only=True)
    by_type = PendingChangeRequestTypesSerializer(read_only=True)


class DashboardSummarySerializer(serializers.Serializer):
    """Serialize assembled current counts without implying an atomic database snapshot."""

    as_of = serializers.DateTimeField(read_only=True)
    applications = DashboardApplicationsSerializer(read_only=True)
    change_requests = DashboardChangeRequestsSerializer(read_only=True)
    reviews_under_review = serializers.IntegerField(read_only=True)
    reported_review_cases = serializers.IntegerField(read_only=True)
    pending_disputes = serializers.IntegerField(read_only=True)
    active_businesses = serializers.IntegerField(read_only=True)
