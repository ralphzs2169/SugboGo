"""Routes for shared moderation queue metrics."""

from django.urls import path

from apps.admin_operations.moderation.views.moderation_metrics_views import (
    AdminModerationSummaryView,
)


urlpatterns = [
    path(
        "summary/",
        AdminModerationSummaryView.as_view(),
        name="admin-moderation-summary",
    ),
]
