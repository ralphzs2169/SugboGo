"""Strict heatmap inputs and aggregate-only administrator output contracts."""

import re

from rest_framework import serializers

from apps.admin_operations.analytics.serializers.coverage_attention_serializers import CoverageQuerySerializer
from apps.admin_operations.analytics.serializers.platform_analytics_serializers import AnalyticsMetaSerializer
from apps.admin_operations.analytics.services.geographic_grid_service import GeographicGridService


CELL_STATES = ("no_businesses", "visibility_unavailable", "zero_recorded_visits", "recorded_visits")


class DiscoveryHeatmapQuerySerializer(CoverageQuerySerializer):
    """Reuse reporting dates and taxonomy while rejecting ambiguous or unsupported inputs."""

    metric = serializers.ChoiceField(choices=("profile_visits",), default="profile_visits")
    cell = serializers.RegexField(
        regex=rf"\A{re.escape(GeographicGridService.VERSION)}:-?(?:0|[1-9][0-9]*):-?(?:0|[1-9][0-9]*)\Z",
        max_length=128, required=False,
    )

    def validate_cell(self, value):
        """Require canonical integer indices so one cell has exactly one spelling."""
        version, column, row = value.split(":")
        if value != GeographicGridService.cell_id(int(column), int(row)):
            raise serializers.ValidationError("Use a canonical cell ID from this reporting grid.")
        return value

    def validate(self, attrs):
        """Reject repeated query parameters before capturing the inherited reporting clock."""
        if hasattr(self.initial_data, "getlist"):
            repeated = [key for key in self.initial_data if len(self.initial_data.getlist(key)) > 1]
            if repeated:
                raise serializers.ValidationError({key: "Provide this parameter only once." for key in repeated})
        return super().validate(attrs)


class HeatmapDefinitionSerializer(serializers.Serializer):
    """Expose the versioned coordinate and cell-size definition."""

    version = serializers.CharField()
    projected_srid = serializers.IntegerField()
    cell_size_metres = serializers.IntegerField()
    origin = serializers.ListField(child=serializers.FloatField())
    assignment = serializers.CharField()
    output_srid = serializers.IntegerField()
    coordinate_order = serializers.CharField()
    max_cells = serializers.IntegerField()


class HeatmapScopeSerializer(serializers.Serializer):
    """Expose approved boundary provenance without business-level inputs."""

    psgc_code = serializers.CharField()
    boundary_ids = serializers.ListField(child=serializers.IntegerField())
    boundary_updated_at = serializers.ListField(child=serializers.CharField())
    boundary_wkb_sha256 = serializers.CharField()
    scope_validation = serializers.CharField()
    reference_path = serializers.CharField()
    reference_geometry_sha256 = serializers.CharField()


class HeatmapCellSerializer(serializers.Serializer):
    """Share one aggregate row between map geometry and the equivalent table."""

    id = serializers.CharField()
    column = serializers.IntegerField()
    row = serializers.IntegerField()
    geometry = serializers.JSONField()
    eligible_businesses = serializers.IntegerField()
    profile_visits = serializers.IntegerField(allow_null=True)
    measurement_status = serializers.ChoiceField(choices=("coverage_unverified", "unavailable"))
    state = serializers.ChoiceField(choices=CELL_STATES)


class HeatmapAttributionSerializer(serializers.Serializer):
    """Disclose current-state attribution and prohibit arrival interpretations."""

    population = serializers.CharField()
    location = serializers.CharField()
    historical_counts_can_move_with_business = serializers.BooleanField()
    metric = serializers.CharField()
    physical_arrivals = serializers.BooleanField()


class HeatmapExclusionSerializer(serializers.Serializer):
    """Keep excluded populations and their additive observations reconcilable."""

    businesses = serializers.IntegerField()
    profile_visits = serializers.IntegerField(allow_null=True)


class HeatmapReconciliationSerializer(serializers.Serializer):
    """Retain full-inventory reconciliation even when selecting one geographic cell."""

    eligible_businesses = serializers.IntegerField()
    assigned_businesses = serializers.IntegerField(allow_null=True)
    excluded_businesses = serializers.IntegerField(allow_null=True)
    excluded_by_reason = serializers.DictField(child=HeatmapExclusionSerializer(), allow_null=True)
    inventory_profile_visits = serializers.IntegerField(allow_null=True)
    assigned_profile_visits = serializers.IntegerField(allow_null=True)
    excluded_profile_visits = serializers.IntegerField(allow_null=True)


class HeatmapSourcesSerializer(serializers.Serializer):
    """Reuse independent metadata for domain, geography and visibility."""

    domain = AnalyticsMetaSerializer()
    geography = AnalyticsMetaSerializer()
    visibility = AnalyticsMetaSerializer()


class HeatmapSelectionSerializer(serializers.Serializer):
    """Describe displayed counts separately from full filtered-inventory totals."""

    cell = serializers.CharField(allow_null=True)
    returned_cells = serializers.IntegerField(allow_null=True)
    total_scope_cells = serializers.IntegerField(allow_null=True)
    eligible_businesses = serializers.IntegerField(allow_null=True)
    profile_visits = serializers.IntegerField(allow_null=True)
    reconciliation_scope = serializers.ChoiceField(choices=("full_filtered_inventory",))


class HeatmapLegendSerializer(serializers.Serializer):
    """Describe continuous counts without inventing popularity or quality thresholds."""

    method = serializers.ChoiceField(choices=("linear_count",))
    unit = serializers.ChoiceField(choices=("recorded_profile_visits",))
    minimum = serializers.IntegerField(allow_null=True)
    maximum = serializers.IntegerField(allow_null=True)
    scope = serializers.ChoiceField(choices=("full_filtered_reporting_scope",))
    zero_range = serializers.BooleanField(allow_null=True)


class DiscoveryHeatmapSerializer(serializers.Serializer):
    """Publish bounded aggregate cells and their evidence through the standard envelope."""

    label = serializers.CharField()
    description = serializers.CharField()
    metric = serializers.ChoiceField(choices=("profile_visits",))
    measurement_type = serializers.ChoiceField(choices=("period_current_state",))
    display_state = serializers.ChoiceField(choices=CELL_STATES + ("geography_unavailable",))
    definition = HeatmapDefinitionSerializer()
    scope = HeatmapScopeSerializer(allow_null=True)
    cells = HeatmapCellSerializer(many=True, allow_null=True)
    attribution = HeatmapAttributionSerializer()
    reconciliation = HeatmapReconciliationSerializer()
    sources = HeatmapSourcesSerializer()
    meta = AnalyticsMetaSerializer()
    selection = HeatmapSelectionSerializer()
    legend = HeatmapLegendSerializer()
    truncated = serializers.BooleanField()
    empty_cells_included = serializers.BooleanField()
