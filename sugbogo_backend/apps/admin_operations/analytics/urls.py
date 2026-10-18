from django.urls import path

from .discovery_heatmap_views import DiscoveryHeatmapView
from .operations_views import AttentionQueueView, OnboardingAnalyticsView

from .views import DiscoveryScoreListView, DiscoveryScoreRecomputeView, DiscoveryTrendView
from .views import get_analytics_data
from .views import BusinessAttentionView, CoverageAnalyticsView, LowExposureView

urlpatterns = [
    path("discovery-heatmap/", DiscoveryHeatmapView.as_view(), name="admin-discovery-heatmap"),
    path("onboarding/", OnboardingAnalyticsView.as_view(), name="admin-analytics-onboarding"),
    path("attention-queue/", AttentionQueueView.as_view(), name="admin-analytics-attention-queue"),
    path("", get_analytics_data, name="get_analytics_data"),
    path("coverage/", CoverageAnalyticsView.as_view(), name="admin-analytics-coverage"),
    path("business-attention/", BusinessAttentionView.as_view(), name="admin-business-attention"),
    path("low-exposure/", LowExposureView.as_view(), name="admin-low-exposure"),
    path(
        "discovery-trend/",
        DiscoveryTrendView.as_view(),
        name="admin-discovery-trend",
    ),
    path(
        "discovery-scores/",
        DiscoveryScoreListView.as_view(),
        name="discovery-score-list",
    ),
    path(
        "discovery-scores/recompute/",
        DiscoveryScoreRecomputeView.as_view(),
        name="discovery-score-recompute",
    ),
]
