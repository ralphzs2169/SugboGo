from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.users.models import User
from apps.admin_operations.moderation.serializers.manage_review_report_serializers import (
    AdminReviewReportFilterSerializer,
    AdminReviewReportSerializer,
    AdminReviewReportResolutionSerializer,
)
from apps.admin_operations.moderation.services.manage_review_report_service import (
    ManageReviewReportService,
)
from core.pagination import StandardPagination
from core.responses import success_response


class AdminReviewReportListView(APIView):
    """Provides a protected paginated review report queue."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )

    def get(self, request):
        """Returns reports matching validated queue filters."""
        filters = AdminReviewReportFilterSerializer(data=request.query_params)
        filters.is_valid(raise_exception=True)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(
            ManageReviewReportService.list_reports(filters.validated_data),
            request,
        )
        return paginator.get_paginated_response(
            AdminReviewReportSerializer(page, many=True).data,
        )


class AdminReviewReportDetailView(APIView):
    """Provides report evidence and the related report-state counts."""

    permission_classes = AdminReviewReportListView.permission_classes

    def get(self, request, report_id):
        """Returns the selected report and authoritative sibling counts."""
        report = ManageReviewReportService.get_report(report_id)
        data = AdminReviewReportSerializer(report).data
        data["related_report_counts"] = ManageReviewReportService.related_counts(report)
        return success_response(data=data, message="Review report retrieved successfully.")


class AdminReviewReportApproveView(APIView):
    """Resolves valid reports and rejects their review."""

    permission_classes = AdminReviewReportListView.permission_classes
    approve = True

    def post(self, request, report_id):
        """Applies a report decision with the authenticated administrator."""
        serializer = AdminReviewReportResolutionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = ManageReviewReportService.resolve(
            report_id, actor=request.user, approve=self.approve,
            **serializer.validated_data,
        )
        decision = "approved" if self.approve else "rejected"
        return success_response(
            data=AdminReviewReportSerializer(report).data,
            message=f"Review report {decision} successfully.",
        )


class AdminReviewReportRejectView(AdminReviewReportApproveView):
    """Rejects invalid reports while preserving review visibility and flags."""

    approve = False
