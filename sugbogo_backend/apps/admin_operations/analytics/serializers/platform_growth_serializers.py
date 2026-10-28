"""Current inventory and retained acquisition event contracts."""

from rest_framework import serializers

from .platform_analytics_serializers import AnalyticsMetaSerializer
from .reporting_serializers import PeriodCountSerializer


class GrowthInventorySerializer(serializers.Serializer):
    """Label current consumer-role and business inventory independently of reporting dates."""

    measurement_type = serializers.ChoiceField(choices=("current_snapshot",))
    as_of = serializers.CharField()
    selected_period_applies = serializers.BooleanField()
    consumer_accounts = serializers.IntegerField()
    current_explorer_accounts = serializers.IntegerField()
    current_merchant_accounts = serializers.IntegerField()
    total_businesses = serializers.IntegerField()
    active_businesses = serializers.IntegerField()
    suspended_businesses = serializers.IntegerField()


class GrowthActivitySerializer(serializers.Serializer):
    """Keep acquisition event counts separate from current Merchant-role inventory."""

    new_consumer_accounts = PeriodCountSerializer()
    new_businesses = PeriodCountSerializer()
    newly_approved_businesses = PeriodCountSerializer()


class GrowthSeriesSerializer(serializers.Serializer):
    """Expose three related counts on one clipped Manila time axis."""

    date = serializers.CharField()
    start = serializers.CharField()
    end_exclusive = serializers.CharField()
    new_consumer_accounts = serializers.IntegerField()
    new_businesses = serializers.IntegerField()
    newly_approved_businesses = serializers.IntegerField()


class PlatformGrowthSerializer(serializers.Serializer):
    """Serialize source-aware inventory and acquisition without private account identifiers."""

    inventory = GrowthInventorySerializer()
    activity = GrowthActivitySerializer()
    interval = serializers.ChoiceField(choices=("daily", "weekly"))
    series = GrowthSeriesSerializer(many=True)
    series_is_sparse = serializers.BooleanField()
    definitions = serializers.DictField(child=serializers.CharField())
    meta = AnalyticsMetaSerializer()
