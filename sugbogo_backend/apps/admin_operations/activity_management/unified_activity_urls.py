from django.urls import path

from .unified_activity_views import UnifiedActivityDetailView, UnifiedActivityListView


urlpatterns = [
    path("", UnifiedActivityListView.as_view(), name="unified-activity-list"),
    path(
        "<str:event_id>/",
        UnifiedActivityDetailView.as_view(),
        name="unified-activity-detail",
    ),
]
