"""Aggregate-only transportation report response contracts."""

from rest_framework import serializers

from .platform_analytics_serializers import AnalyticsMetaSerializer


class PlanningMethodSerializer(serializers.Serializer):
    """Describe reconcilable method counts and full-total shares."""

    method = serializers.ChoiceField(choices=("ROAD_ROUTE", "JEEPNEY", "OTHER"))
    label = serializers.CharField()
    count = serializers.IntegerField()
    share_percent = serializers.FloatField(allow_null=True)


class PlanningBucketSerializer(serializers.Serializer):
    """Keep unobserved and pretracking buckets nullable."""

    date = serializers.CharField()
    start = serializers.CharField()
    end_exclusive = serializers.CharField()
    observation_start = serializers.DateTimeField(allow_null=True)
    tracking_started = serializers.BooleanField()
    road_route = serializers.IntegerField(allow_null=True)
    jeepney = serializers.IntegerField(allow_null=True)
    other = serializers.IntegerField(allow_null=True)


class PlanningDestinationSerializer(serializers.Serializer):
    """Expose public current names without dropping missing historical destinations."""

    business_id = serializers.IntegerField(allow_null=True)
    business_name = serializers.CharField(allow_null=True)
    count = serializers.IntegerField()
    road_route = serializers.IntegerField()
    jeepney = serializers.IntegerField()
    other = serializers.IntegerField()


class TransportationPlanningSerializer(serializers.Serializer):
    """Separate recorded planning intent from unavailable observations."""

    total_requests = serializers.IntegerField(allow_null=True)
    distinct_requesting_accounts = serializers.IntegerField(allow_null=True)
    requests_without_account_identity = serializers.IntegerField(allow_null=True)
    methods = PlanningMethodSerializer(many=True, allow_null=True)
    series = PlanningBucketSerializer(many=True, allow_null=True)
    destinations = PlanningDestinationSerializer(many=True, allow_null=True)
    destination_limit = serializers.IntegerField()
    unavailable_destinations_in_ranking = serializers.IntegerField(allow_null=True)
    tracking_started_at = serializers.DateTimeField(allow_null=True)
    interval = serializers.ChoiceField(choices=("daily", "weekly"))
    definitions = serializers.DictField(child=serializers.CharField())
    meta = AnalyticsMetaSerializer()
