from django.urls import path

from .discovery_heatmap_views import DiscoveryHeatmapView
from .operations_views import AttentionQueueView, OnboardingAnalyticsView
from .reporting_views import (
    ChangeRequestAnalyticsView,
    DiscoverySourcesView,
    CommunityHealthView,
    PlatformGrowthView,
    SpecialtySupportView,
)

from .views import DiscoveryScoreListView, DiscoveryScoreRecomputeView, DiscoveryTrendView
from .views import DiscoverySummaryView, get_analytics_data
from .views import VisibilityGapDiagnosticView
from .views import BusinessAttentionView, CoverageAnalyticsView, LowExposureView

urlpatterns = [
    path(
        "discovery-sources/",
        DiscoverySourcesView.as_view(),
        name="admin-analytics-discovery-sources",
    ),
    path(
        "platform-growth/",
        PlatformGrowthView.as_view(),
        name="admin-analytics-platform-growth",
    ),
    path(
        "community-health/",
        CommunityHealthView.as_view(),
        name="admin-analytics-community-health",
    ),
    path(
        "specialty-support/",
        SpecialtySupportView.as_view(),
        name="admin-analytics-specialty-support",
    ),
    path(
        "change-requests/",
        ChangeRequestAnalyticsView.as_view(),
        name="admin-analytics-change-requests",
    ),
    path("discovery-heatmap/", DiscoveryHeatmapView.as_view(), name="admin-discovery-heatmap"),
    path("onboarding/", OnboardingAnalyticsView.as_view(), name="admin-analytics-onboarding"),
    path("attention-queue/", AttentionQueueView.as_view(), name="admin-analytics-attention-queue"),
    path("", get_analytics_data, name="get_analytics_data"),
    path("coverage/", CoverageAnalyticsView.as_view(), name="admin-analytics-coverage"),
    path("business-attention/", BusinessAttentionView.as_view(), name="admin-business-attention"),
    path("low-exposure/", LowExposureView.as_view(), name="admin-low-exposure"),
    path(
        "discovery-summary/",
        DiscoverySummaryView.as_view(),
        name="admin-discovery-summary",
    ),
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
    path(
        "discovery-scores/<int:business_id>/visibility-diagnostics/",
        VisibilityGapDiagnosticView.as_view(),
        name="discovery-score-visibility-diagnostics",
    ),
]
