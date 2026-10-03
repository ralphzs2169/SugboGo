from django.urls import path

from apps.admin_operations.moderation.views.manage_review_report_views import (
    AdminReviewReportListView, AdminReviewReportDetailView,
    AdminReviewReportApproveView, AdminReviewReportRejectView,
)

urlpatterns = [
    path("", AdminReviewReportListView.as_view(), name="admin-review-report-list"),
    path("<int:report_id>/", AdminReviewReportDetailView.as_view(), name="admin-review-report-detail"),
    path("<int:report_id>/approve/", AdminReviewReportApproveView.as_view(), name="admin-review-report-approve"),
    path("<int:report_id>/reject/", AdminReviewReportRejectView.as_view(), name="admin-review-report-reject"),
]
