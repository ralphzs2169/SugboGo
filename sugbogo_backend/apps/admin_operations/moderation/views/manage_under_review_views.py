"""Admin-only API for reviewing content held before publication."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.admin_operations.moderation.serializers.manage_under_review_serializers import (
    AdminUnderReviewDetailSerializer,
    AdminUnderReviewFilterSerializer,
    AdminUnderReviewListSerializer,
    AdminUnderReviewRejectSerializer,
)
from apps.admin_operations.moderation.services.manage_under_review_service import (
    ManageUnderReviewService,
)
from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.pagination import StandardPagination
from core.responses import success_response


class AdminUnderReviewListView(APIView):
    """List held reviews for Admin and Super Admin moderation."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )

    def get(self, request):
        """Return filtered, paginated review summaries."""
        filters = AdminUnderReviewFilterSerializer(data=request.query_params)
        filters.is_valid(raise_exception=True)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(
            ManageUnderReviewService.list_reviews(filters.validated_data),
            request,
        )
        return paginator.get_paginated_response(
            AdminUnderReviewListSerializer(page, many=True).data,
        )


class AdminUnderReviewDetailView(APIView):
    """Show structured evidence for one held review."""

    permission_classes = AdminUnderReviewListView.permission_classes

    def get(self, request, review_id):
        """Return full held content and attributed findings."""
        review = ManageUnderReviewService.get_review(review_id)
        return success_response(
            data=AdminUnderReviewDetailSerializer(review).data,
            message="Under-review review retrieved successfully.",
        )


class AdminUnderReviewApproveView(APIView):
    """Publish one held review after a human Admin decision."""

    permission_classes = AdminUnderReviewListView.permission_classes

    def post(self, request, review_id):
        """Apply the canonical publication transition and audit it."""
        review = ManageUnderReviewService.resolve(
            review_id,
            actor=request.user,
            approve=True,
        )
        return success_response(
            data={"id": review.REVW_ID, "status": review.REVW_STATUS},
            message="Review approved and published successfully.",
        )


class AdminUnderReviewRejectView(APIView):
    """Reject one held review after a human Admin decision."""

    permission_classes = AdminUnderReviewListView.permission_classes

    def post(self, request, review_id):
        """Apply the canonical rejection transition and audit it."""
        input_serializer = AdminUnderReviewRejectSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        review = ManageUnderReviewService.resolve(
            review_id,
            actor=request.user,
            approve=False,
            moderation_notes=input_serializer.validated_data["moderation_notes"],
        )
        return success_response(
            data={"id": review.REVW_ID, "status": review.REVW_STATUS},
            message="Review rejected successfully.",
        )
