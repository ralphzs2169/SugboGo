from rest_framework import serializers

from .standard_analytics_serializers import (
    OwnedBusinessSerializer,
    StandardAnalyticsQuerySerializer,
    StandardMetaSerializer,
)


class RoutePlanningQuerySerializer(StandardAnalyticsQuerySerializer):
    """Expose the established presets without adding custom dates or comparisons."""

    period = serializers.ChoiceField(
        choices=("7", "30", "90"),
        default="30",
    )
    start_date = None
    end_date = None


class RoutePlanningAnalyticsSerializer(serializers.Serializer):
    """Expose nullable recorded counts and measurement limitations without identities."""

    business = OwnedBusinessSerializer()
    total_requests = serializers.IntegerField(allow_null=True)
    distinct_explorer_accounts = serializers.IntegerField(allow_null=True)
    road_route_requests = serializers.IntegerField(allow_null=True)
    jeepney_requests = serializers.IntegerField(allow_null=True)
    tracking_started_at = serializers.DateTimeField(allow_null=True)
    meta = StandardMetaSerializer()
