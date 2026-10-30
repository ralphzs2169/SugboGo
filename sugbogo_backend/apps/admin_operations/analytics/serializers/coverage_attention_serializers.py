"""Admin coverage and attention query/response contracts."""

from rest_framework import serializers

from apps.admin_operations.analytics.serializers.platform_analytics_serializers import (
    AnalyticsMetaSerializer, AnalyticsPeriodQuerySerializer,
)
from apps.admin_operations.analytics.services.business_attention_service import BusinessAttentionService


ORDERINGS = tuple(
    ordering for field in BusinessAttentionService.ORDER_FIELDS for ordering in (field, "-" + field)
)


class CoverageQuerySerializer(AnalyticsPeriodQuerySerializer):
    """Validate a selectable coverage period and classification IDs."""

    cluster = serializers.IntegerField(min_value=1, required=False)
    category = serializers.IntegerField(min_value=1, required=False)


class BusinessAttentionQuerySerializer(CoverageQuerySerializer):
    """Validate whole-population ordering and standard positive pagination controls."""

    ordering = serializers.ChoiceField(choices=ORDERINGS, default="-profile_visits")
    page = serializers.IntegerField(min_value=1, default=1)
    page_size = serializers.IntegerField(min_value=1, max_value=100, default=10)


class LowExposureQuerySerializer(BusinessAttentionQuerySerializer):
    """Fix the low-exposure window and reject client date or threshold overrides."""

    ordering = serializers.ChoiceField(choices=ORDERINGS, default="profile_visits")

    def get_fields(self):
        """Remove selectable dates from the fixed-window endpoint's accepted inputs."""
        fields = super().get_fields()
        for field in ("period", "start_date", "end_date"):
            fields.pop(field)
        return fields

    def validate(self, attrs):
        """Resolve the server-owned completed-day window after rejecting unknown keys."""
        unknown = set(self.initial_data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError({key: "Unsupported low-exposure query parameter." for key in sorted(unknown)})
        attrs["report_period"] = BusinessAttentionService.fixed_low_exposure_period()
        return attrs


class CoverageCountSerializer(serializers.Serializer):
    """Expose coverage numerator, denominator and explicitly undefined percentages."""

    eligible_businesses = serializers.IntegerField()
    visited_businesses = serializers.IntegerField(allow_null=True)
    zero_recorded_visit_businesses = serializers.IntegerField(allow_null=True)
    coverage_percentage = serializers.FloatField(allow_null=True)


class CoverageGroupSerializer(CoverageCountSerializer):
    """Associate coverage counts with a current taxonomy group."""

    id = serializers.IntegerField()
    name = serializers.CharField()


class CoverageAttentionSourcesSerializer(serializers.Serializer):
    """Keep current SQL population and Mongo observation availability separate."""

    domain = AnalyticsMetaSerializer()
    visibility = AnalyticsMetaSerializer()


class CoverageReportSerializer(serializers.Serializer):
    """Expose pooled and grouped recorded coverage through the existing envelope."""

    label = serializers.CharField()
    description = serializers.CharField()
    overall = CoverageCountSerializer()
    clusters = CoverageGroupSerializer(many=True)
    categories = CoverageGroupSerializer(many=True)
    meta = AnalyticsMetaSerializer()
    sources = CoverageAttentionSourcesSerializer()


class BusinessAttentionRowSerializer(serializers.Serializer):
    """Expose aggregate attention and support without explorer identities or scores."""

    business_id = serializers.IntegerField()
    business_name = serializers.CharField()
    cover_photo_url = serializers.CharField(allow_null=True, allow_blank=True)
    category_id = serializers.IntegerField()
    category_name = serializers.CharField()
    cluster_id = serializers.IntegerField()
    cluster_name = serializers.CharField()
    profile_visits = serializers.IntegerField(allow_null=True)
    saves = serializers.IntegerField(allow_null=True)
    distinct_savers = serializers.IntegerField(allow_null=True)
    valid_vouches = serializers.IntegerField()
    distinct_supporters = serializers.IntegerField()
    specialty_support_as_of = serializers.CharField()
    business_created_at = serializers.CharField()
    has_full_business_window = serializers.BooleanField()
    business_window_days = serializers.FloatField()


class LowExposureThresholdSerializer(serializers.Serializer):
    """Expose the pilot constants actually used to select candidate rows."""

    window_days = serializers.IntegerField()
    policy_version = serializers.IntegerField()
    max_profile_visits = serializers.IntegerField()
    min_distinct_supporters = serializers.IntegerField()
    excludes_today = serializers.BooleanField()
    is_pilot_policy = serializers.BooleanField()


class BusinessAttentionMetadataSerializer(serializers.Serializer):
    """Expose attention metadata alongside standard pagination fields."""

    label = serializers.CharField()
    description = serializers.CharField()
    ordering = serializers.CharField()
    meta = AnalyticsMetaSerializer()
    sources = CoverageAttentionSourcesSerializer()
    selection_status = serializers.ChoiceField(choices=("not_applicable", "provisional", "unavailable"))
    thresholds = LowExposureThresholdSerializer(allow_null=True)
