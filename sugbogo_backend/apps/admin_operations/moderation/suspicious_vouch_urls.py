"""Read-only Admin routes for suspicious vouches."""

from django.urls import path

from apps.admin_operations.moderation.views.suspicious_vouch_views import (
    AdminSuspiciousVouchDetailView,
    AdminSuspiciousVouchListView,
)

urlpatterns = [
    path(
        "",
        AdminSuspiciousVouchListView.as_view(),
        name="admin-suspicious-vouch-list",
    ),
    path(
        "<int:vouch_id>/",
        AdminSuspiciousVouchDetailView.as_view(),
        name="admin-suspicious-vouch-detail",
    ),
]
