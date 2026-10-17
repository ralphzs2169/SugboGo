"""Premium-gated anonymous peer comparisons and merchant report composition."""

from ..serializers.peer_report_serializers import MerchantReportSerializer, PeerAnalyticsSerializer
from ..serializers.premium_analytics_serializers import PremiumVisibilityQuerySerializer
from ..services.merchant_report_service import MerchantReportService
from ..services.peer_analytics_service import PeerAnalyticsService
from .premium_analytics_views import PremiumAnalyticsView


class PeerAnalyticsView(PremiumAnalyticsView):
    """Serve anonymous peer medians through the existing merchant Plus permission chain."""

    response_serializer = PeerAnalyticsSerializer

    def get_report(self, user, query):
        """Resolve the caller's ownership and fixed server-side peer policy."""
        return PeerAnalyticsService.get_report(user, query["report_period"])


class MerchantReportView(PremiumAnalyticsView):
    """Serve composed Standard and Premium data exclusively through a Plus-gated route."""

    query_serializer = PremiumVisibilityQuerySerializer
    response_serializer = MerchantReportSerializer

    def get_report(self, user, query):
        """Compose service results using one validated period and visibility interval."""
        return MerchantReportService.get_report(user, query["report_period"], interval=query["interval"])
