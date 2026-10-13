"""Admin-only grouped review reports and review-level decisions."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.admin_operations.moderation.serializers.reported_review_serializers import (
    ReportedReviewDetailSerializer,
    ReportedReviewFilterSerializer,
    ReportedReviewListSerializer,
    ReportedReviewDecisionSerializer,
)
from apps.admin_operations.moderation.services.manage_reported_review_service import (
    ManageReportedReviewService,
)
from apps.admin_operations.moderation.services.reported_review_service import (
    ReportedReviewService,
)
from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.pagination import StandardPagination
from core.responses import success_response


class AdminReportedReviewListView(APIView):
    """Expose review-grouped pending report summaries to Admins."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )

    def get(
        self,
        request,
    ):
        """Return one paginated queue item per reported review."""
        filters = ReportedReviewFilterSerializer(data=request.query_params)
        filters.is_valid(raise_exception=True)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(
            ReportedReviewService.list_reviews(filters.validated_data),
            request,
        )
        return paginator.get_paginated_response(
            ReportedReviewListSerializer(page, many=True).data,
        )


class AdminReportedReviewDetailView(APIView):
    """Expose one review, report summary, and individual reports."""

    permission_classes = AdminReportedReviewListView.permission_classes

    def get(
        self,
        request,
        review_id,
    ):
        """Return current grouped report context without a decision."""
        review = ReportedReviewService.get_review(review_id)
        return success_response(
            data=ReportedReviewDetailSerializer(review).data,
            message="Reported review retrieved successfully.",
        )


class AdminReportedReviewDecisionView(APIView):
    """Resolve all pending reports through one review-level Admin decision."""

    permission_classes = AdminReportedReviewListView.permission_classes

    def post(
        self,
        request,
        review_id,
    ):
        serializer = ReportedReviewDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = ManageReportedReviewService.resolve(
            review_id,
            actor=request.user,
            **serializer.validated_data,
        )
        return success_response(
            data=result,
            message="Reported review decision saved successfully.",
        )
