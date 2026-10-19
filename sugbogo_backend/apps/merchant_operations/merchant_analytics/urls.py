from django.urls import path
from .views.discovery_sources_views import DiscoverySourcesView

from .views.aged_unanswered_reviews_views import AgedUnansweredReviewsView
from .views.route_planning_views import RoutePlanningAnalyticsView
from .views.report_export_views import MerchantReportExportView
from .views.engagement_heatmap_views import EngagementHeatmapView
from .views.standard_analytics_views import StandardAnalyticsView
from .views.peer_report_views import MerchantReportView, PeerAnalyticsView
from .views.recommendation_views import RecommendationRefreshView, RecommendationView
from .views.premium_analytics_views import (
    PremiumPocketView, PremiumReviewInsightsView, PremiumReviewPerformanceView,
    PremiumSpecialtyView, PremiumVisibilityView,
)


urlpatterns = [
    path(
        "standard/discovery-sources/",
        DiscoverySourcesView.as_view(),
        name="merchant-analytics-discovery-sources",
    ),
    path(
        "standard/route-planning/",
        RoutePlanningAnalyticsView.as_view(),
        name="merchant-analytics-route-planning",
    ),
    path(
        "standard/unanswered-reviews/",
        AgedUnansweredReviewsView.as_view(),
        name="merchant-analytics-aged-unanswered-reviews",
    ),
    path("premium/report/export/", MerchantReportExportView.as_view(), name="merchant-analytics-premium-report-export"),
    path("premium/engagement-heatmap/", EngagementHeatmapView.as_view(), name="merchant-analytics-premium-engagement-heatmap"),
    path("premium/recommendations/", RecommendationView.as_view(), name="merchant-analytics-premium-recommendations"),
    path("premium/recommendations/refresh/", RecommendationRefreshView.as_view(), name="merchant-analytics-premium-recommendations-refresh"),
    path("standard/", StandardAnalyticsView.as_view(), name="merchant-analytics-standard"),
    path("premium/visibility/", PremiumVisibilityView.as_view(), name="merchant-analytics-premium-visibility"),
    path("premium/pocket/", PremiumPocketView.as_view(), name="merchant-analytics-premium-pocket"),
    path("premium/specialties/", PremiumSpecialtyView.as_view(), name="merchant-analytics-premium-specialties"),
    path("premium/review-insights/", PremiumReviewInsightsView.as_view(), name="merchant-analytics-premium-review-insights"),
    path("premium/review-performance/", PremiumReviewPerformanceView.as_view(), name="merchant-analytics-premium-review-performance"),
    path("premium/peers/", PeerAnalyticsView.as_view(), name="merchant-analytics-premium-peers"),
    path("premium/report/", MerchantReportView.as_view(), name="merchant-analytics-premium-report"),
]
