"""Read-only Admin All Reviews routes."""

from django.urls import path

from apps.admin_operations.moderation.views.all_review_views import (
    AdminAllReviewDetailView,
    AdminAllReviewListView,
    AdminAllReviewSummaryView,
)


urlpatterns = [
    path("", AdminAllReviewListView.as_view(), name="admin-all-review-list"),
    path(
        "summary/",
        AdminAllReviewSummaryView.as_view(),
        name="admin-all-review-summary",
    ),
    path(
        "<int:review_id>/",
        AdminAllReviewDetailView.as_view(),
        name="admin-all-review-detail",
    ),
]
