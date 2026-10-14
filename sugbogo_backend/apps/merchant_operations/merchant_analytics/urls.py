from django.urls import path

from .views.standard_analytics_views import StandardAnalyticsView
from .views.peer_report_views import MerchantReportView, PeerAnalyticsView
from .views.premium_analytics_views import (
    PremiumPocketView, PremiumReviewInsightsView, PremiumReviewPerformanceView,
    PremiumSpecialtyView, PremiumVisibilityView,
)


urlpatterns = [
    path("standard/", StandardAnalyticsView.as_view(), name="merchant-analytics-standard"),
    path("premium/visibility/", PremiumVisibilityView.as_view(), name="merchant-analytics-premium-visibility"),
    path("premium/pocket/", PremiumPocketView.as_view(), name="merchant-analytics-premium-pocket"),
    path("premium/specialties/", PremiumSpecialtyView.as_view(), name="merchant-analytics-premium-specialties"),
    path("premium/review-insights/", PremiumReviewInsightsView.as_view(), name="merchant-analytics-premium-review-insights"),
    path("premium/review-performance/", PremiumReviewPerformanceView.as_view(), name="merchant-analytics-premium-review-performance"),
    path("premium/peers/", PeerAnalyticsView.as_view(), name="merchant-analytics-premium-peers"),
    path("premium/report/", MerchantReportView.as_view(), name="merchant-analytics-premium-report"),
]
