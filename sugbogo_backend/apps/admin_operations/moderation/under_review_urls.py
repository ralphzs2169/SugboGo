"""Admin routes for pre-publication review decisions."""

from django.urls import path

from apps.admin_operations.moderation.views.manage_under_review_views import (
    AdminUnderReviewApproveView,
    AdminUnderReviewDetailView,
    AdminUnderReviewListView,
    AdminUnderReviewRejectView,
)


urlpatterns = [
    path("", AdminUnderReviewListView.as_view(), name="admin-under-review-list"),
    path(
        "<int:review_id>/",
        AdminUnderReviewDetailView.as_view(),
        name="admin-under-review-detail",
    ),
    path(
        "<int:review_id>/approve/",
        AdminUnderReviewApproveView.as_view(),
        name="admin-under-review-approve",
    ),
    path(
        "<int:review_id>/reject/",
        AdminUnderReviewRejectView.as_view(),
        name="admin-under-review-reject",
    ),
]
