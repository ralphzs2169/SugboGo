"""Bounded export selections using the existing report period and interval contract."""

from rest_framework import serializers

from .premium_analytics_serializers import PremiumVisibilityQuerySerializer
from .peer_report_serializers import MerchantReportSerializer
from .discovery_sources_serializers import DiscoverySourcesSerializer
from .route_planning_serializers import RoutePlanningAnalyticsSerializer
from .engagement_heatmap_serializers import EngagementHeatmapSerializer
from .aged_unanswered_reviews_serializers import AgedUnansweredReviewsSerializer


class ExportSectionsSerializer(serializers.Serializer):
    """Allow only existing aggregate contracts in the expanded PDF."""

    discovery_sources = DiscoverySourcesSerializer()
    route_planning = RoutePlanningAnalyticsSerializer()
    profile_timing = EngagementHeatmapSerializer()
    unanswered_reviews = AgedUnansweredReviewsSerializer()


class MerchantExportReportSerializer(MerchantReportSerializer):
    """Extend PDF evidence without changing the composed JSON report contract."""

    export_sections = ExportSectionsSerializer()


class ReportExportQuerySerializer(PremiumVisibilityQuerySerializer):
    """Validate the existing report selection within the synchronous PDF export bounds."""

    MAX_DAYS = 366

    def validate(self, attrs):
        """Reject repeated inputs and resolve one reporting clock before enforcing the export limit."""
        if hasattr(self.initial_data, "getlist"):
            repeated = [key for key in self.initial_data if len(self.initial_data.getlist(key)) > 1]
            if repeated:
                raise serializers.ValidationError({key: "Provide this parameter only once." for key in repeated})
        attrs = super().validate(attrs)
        period = attrs["report_period"]
        if (period.end_date - period.start_date).days + 1 > self.MAX_DAYS:
            raise serializers.ValidationError({"period": "PDF exports support at most 366 calendar days."})
        return attrs
