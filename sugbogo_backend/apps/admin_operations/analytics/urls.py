from django.urls import path

from .views import DiscoveryScoreListView, DiscoveryScoreRecomputeView
from .views import get_analytics_data

urlpatterns = [
    path("", get_analytics_data, name="get_analytics_data"),
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
