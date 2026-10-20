from django.urls import path

from apps.merchant_operations.dashboard.views.recent_activity_views import (
    RecentActivityView,
)


urlpatterns = [
    path(
        "recent-activity/",
        RecentActivityView.as_view(),
        name="merchant-dashboard-recent-activity",
    ),
]
