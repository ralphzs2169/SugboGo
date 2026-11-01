from django.urls import path

from . import views
from .platform_overview_views import DashboardPlatformOverviewView
from .recent_decision_views import DashboardRecentDecisionsView

urlpatterns = [
    path("", views.get_dashboard_data, name="get_dashboard_data"),
    path(
        "recent-decisions/",
        DashboardRecentDecisionsView.as_view(),
        name="admin-dashboard-recent-decisions",
    ),
    path(
        "platform-overview/",
        DashboardPlatformOverviewView.as_view(),
        name="admin-dashboard-platform-overview",
    ),
]
