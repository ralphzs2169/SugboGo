from core.responses import success_response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.reviews.models import ReviewReport
from apps.reviews.serializers.review_serializers import (
    ReviewReportSerializer,
)
from apps.reviews.services.review_report_service import ReviewReportService
from apps.users.models import User


class ReviewReportView(APIView):
    """Handle reporting business reviews."""

    permission_classes = (
        IsAuthenticated,
        HasRole(
            User.UserRole.EXPLORER,
            User.UserRole.MERCHANT,
        ),
    )

    def get(
        self,
        request,
        review_id,
    ):
        """Return only the current user's existing report receipt."""
        report = ReviewReportService.get_user_report(
            user=request.user,
            review_id=review_id,
        )

        if report.RREP_STATUS == ReviewReport.ReportStatus.PENDING:
            state = "submitted"
        elif report.RREP_STATUS == ReviewReport.ReportStatus.WITHDRAWN:
            state = "withdrawn"
        else:
            state = "reviewed"

        return success_response(
            data={
                "id": report.RREP_ID,
                "review_id": report.REVW_ID_id,
                "reason": report.RREP_TYPE,
                "explanation": report.RREP_EXPLANATION,
                "submitted_at": report.RREP_CREATED_AT,
                "state": state,
            },
            message="Your report retrieved successfully.",
        )

    def post(self, request, review_id):
        """Submit a report against a business review."""

        serializer = ReviewReportSerializer(
            data=request.data,
        )
        serializer.is_valid(raise_exception=True)

        report = ReviewReportService.create_report(
            user=request.user,
            review_id=review_id,
            **serializer.validated_data,
        )

        return success_response(
            data={
                "id": report.RREP_ID,
                "review_id": report.REVW_ID_id,
                "status": report.RREP_STATUS,
            },
            message="Review reported successfully.",
        )

