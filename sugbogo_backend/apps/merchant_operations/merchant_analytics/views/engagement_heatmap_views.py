"""Premium merchant access to owned-business recorded engagement timing."""

from ..serializers.engagement_heatmap_serializers import EngagementHeatmapQuerySerializer, EngagementHeatmapSerializer
from ..services.engagement_heatmap_service import EngagementHeatmapService
from .premium_analytics_views import PremiumAnalyticsView


class EngagementHeatmapView(PremiumAnalyticsView):
    """Reuse merchant authentication, Plus enforcement and response construction."""

    query_serializer = EngagementHeatmapQuerySerializer
    response_serializer = EngagementHeatmapSerializer

    def get_report(self, user, query):
        """Resolve the caller's business through the timing service using approved reporting dates."""
        return EngagementHeatmapService.get_report(user, query["report_period"])
