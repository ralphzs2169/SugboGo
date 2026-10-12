from django.urls import path

from apps.admin_operations.moderation.views.manage_review_report_views import (
    AdminReviewReportListView, AdminReviewReportDetailView,
    AdminReviewReportApproveView, AdminReviewReportRejectView,
)
from apps.admin_operations.moderation.views.reported_review_views import (
    AdminReportedReviewDetailView,
    AdminReportedReviewListView,
)

urlpatterns = [
    path(
        "reviews/",
        AdminReportedReviewListView.as_view(),
        name="admin-reported-review-list",
    ),
    path(
        "reviews/<int:review_id>/",
        AdminReportedReviewDetailView.as_view(),
        name="admin-reported-review-detail",
    ),
    path("", AdminReviewReportListView.as_view(), name="admin-review-report-list"),
    path(
        "<int:report_id>/",
        AdminReviewReportDetailView.as_view(),
        name="admin-review-report-detail",
    ),
    path(
        "<int:report_id>/approve/",
        AdminReviewReportApproveView.as_view(),
        name="admin-review-report-approve",
    ),
    path(
        "<int:report_id>/reject/",
        AdminReviewReportRejectView.as_view(),
        name="admin-review-report-reject",
    ),
]
