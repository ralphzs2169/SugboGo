"""Query validation and explicit administrator analytics response contracts."""

from rest_framework import serializers

from apps.shared.analytics.date_ranges import resolve_period


class AnalyticsPeriodQuerySerializer(serializers.Serializer):
    """Validate date selections and capture a single reporting clock."""

    period = serializers.ChoiceField(choices=("7", "30", "90", "custom"), default="30")
    start_date = serializers.DateField(required=False, input_formats=("%Y-%m-%d",))
    end_date = serializers.DateField(required=False, input_formats=("%Y-%m-%d",))

    def validate(self, attrs):
        """Resolve calendar selections using the shared Manila period helper."""
        unknown = set(self.initial_data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError({
                key: "Unsupported analytics query parameter." for key in sorted(unknown)
            })
        attrs["report_period"] = resolve_period(
            preset=attrs["period"],
            start_date=attrs.get("start_date"),
            end_date=attrs.get("end_date"),
        )
        return attrs


class DiscoveryTrendQuerySerializer(AnalyticsPeriodQuerySerializer):
    """Validate the selected discovery metric and bucket interval."""

    metric = serializers.ChoiceField(
        choices=("impressions", "profile_visits", "saves", "distinct_engaged_explorers"),
        default="profile_visits",
    )
    interval = serializers.ChoiceField(choices=("daily", "weekly"), default="daily")


class AnalyticsComparisonSerializer(serializers.Serializer):
    """Expose null comparisons separately from valid zero changes."""

    value = serializers.FloatField(allow_null=True)
    direction = serializers.ChoiceField(choices=("up", "down", "unchanged"), allow_null=True)
    unit = serializers.ChoiceField(choices=("percent", "percentage_points"))
    reason = serializers.CharField(allow_null=True)


class AnalyticsPeriodSerializer(serializers.Serializer):
    """Expose requested dates and effective exclusive UTC boundaries."""

    timezone = serializers.CharField()
    start_date = serializers.CharField()
    end_date = serializers.CharField()
    start = serializers.CharField()
    end_exclusive = serializers.CharField()
    previous_start = serializers.CharField()
    previous_end_exclusive = serializers.CharField()


class AnalyticsMetaSerializer(serializers.Serializer):
    """Expose source freshness and known coverage limitations."""

    period = AnalyticsPeriodSerializer()
    data_through = serializers.CharField(allow_null=True)
    generated_at = serializers.CharField()
    availability = serializers.ChoiceField(choices=("available", "partial", "unavailable"))
    is_partial = serializers.BooleanField()
    partial_reason = serializers.CharField(allow_null=True)
    partial_reasons = serializers.ListField(child=serializers.CharField())
    coverage_verified = serializers.BooleanField()


class AnalyticsKPISerializer(serializers.Serializer):
    """Expose one headline metric with its measurement type and comparison."""

    label = serializers.CharField()
    description = serializers.CharField()
    measurement_type = serializers.ChoiceField(
        choices=("current_snapshot", "period", "period_current_state"),
    )
    as_of = serializers.CharField(required=False)
    value = serializers.IntegerField(allow_null=True)
    previous_value = serializers.IntegerField(allow_null=True)
    change = AnalyticsComparisonSerializer()
    source = serializers.ChoiceField(choices=("domain", "visibility"))


class PlatformKPIsSerializer(serializers.Serializer):
    """Expose only the four approved platform KPI keys."""

    active_businesses = AnalyticsKPISerializer()
    approved_businesses = AnalyticsKPISerializer()
    new_explorer_accounts = AnalyticsKPISerializer()
    discovery_active_explorers = AnalyticsKPISerializer()


class AnalyticsSeriesPointSerializer(serializers.Serializer):
    """Expose a labeled aggregate bucket without explorer identities."""

    date = serializers.CharField()
    start = serializers.CharField()
    end_exclusive = serializers.CharField()
    value = serializers.IntegerField()


class PlatformSourcesSerializer(serializers.Serializer):
    """Keep SQL metadata distinct from current and prior visibility availability."""

    domain = AnalyticsMetaSerializer()
    visibility_current = AnalyticsMetaSerializer()
    visibility_previous = AnalyticsMetaSerializer()


class PlatformAnalyticsSerializer(serializers.Serializer):
    """Expose the admin overview through the existing response envelope."""

    kpis = PlatformKPIsSerializer()
    new_explorer_accounts_weekly = AnalyticsSeriesPointSerializer(many=True)
    registration_series_is_sparse = serializers.BooleanField()
    meta = AnalyticsMetaSerializer()
    sources = PlatformSourcesSerializer()


class DiscoverySourcesSerializer(serializers.Serializer):
    """Expose independent availability for each visibility period."""

    visibility_current = AnalyticsMetaSerializer()
    visibility_previous = AnalyticsMetaSerializer()


class DiscoveryDefinitionsSerializer(serializers.Serializer):
    """Disclose stored-event populations, gap semantics and comparison limitations."""

    profile_visits = serializers.CharField()
    impressions = serializers.CharField()
    saves = serializers.CharField()
    deduplication = serializers.CharField()
    missing_observations = serializers.CharField()
    comparisons = serializers.CharField()


class DiscoverySummaryTotalsSerializer(serializers.Serializer):
    """Keep unavailable totals distinct from successful recorded zeroes."""

    profile_visits = serializers.IntegerField(allow_null=True)
    impressions = serializers.IntegerField(allow_null=True)
    saves = serializers.IntegerField(allow_null=True)


class DiscoverySummarySerializer(serializers.Serializer):
    """Expose one compact selected-period summary with source metadata."""

    totals = DiscoverySummaryTotalsSerializer()
    definitions = DiscoveryDefinitionsSerializer()
    meta = AnalyticsMetaSerializer()


class DiscoveryTimelinePointSerializer(AnalyticsSeriesPointSerializer):
    """Represent unobserved calendar buckets without inventing zero events."""

    value = serializers.IntegerField(allow_null=True)
    in_progress = serializers.BooleanField()


class DiscoveryTrendSerializer(serializers.Serializer):
    """Expose one selectable metric with sparse series and source disclosures."""

    metric = serializers.CharField()
    label = serializers.CharField()
    description = serializers.CharField()
    measurement_type = serializers.CharField()
    value = serializers.IntegerField(allow_null=True)
    previous_value = serializers.IntegerField(allow_null=True)
    change = AnalyticsComparisonSerializer()
    interval = serializers.CharField()
    series = AnalyticsSeriesPointSerializer(many=True, allow_null=True)
    series_is_sparse = serializers.BooleanField()
    meta = AnalyticsMetaSerializer()
    sources = DiscoverySourcesSerializer()
    timeline = DiscoveryTimelinePointSerializer(many=True, allow_null=True, required=False)
    definitions = DiscoveryDefinitionsSerializer(required=False)
