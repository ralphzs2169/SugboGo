"""Read-only Admin routes for suspicious review investigation."""

from django.urls import path

from apps.admin_operations.moderation.views.suspicious_review_views import (
    AdminSuspiciousReviewDetailView,
    AdminSuspiciousReviewListView,
)


urlpatterns = [
    path("", AdminSuspiciousReviewListView.as_view(), name="admin-suspicious-review-list"),
    path(
        "<int:review_id>/",
        AdminSuspiciousReviewDetailView.as_view(),
        name="admin-suspicious-review-detail",
    ),
]
