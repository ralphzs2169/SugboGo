from core.pagination import StandardPagination
from core.responses import success_response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.admin_operations.moderation.serializers import (
    AdminReviewDisputeDetailSerializer,
    AdminReviewDisputeListSerializer,
    AdminReviewDisputeResolutionSerializer,
)
from apps.admin_operations.moderation.services.manage_review_dispute_service import (
    ManageReviewDisputeService,
)
from apps.authentication.permissions import HasRole
from apps.users.models import User


class AdminReviewDisputeListView(APIView):
    """Handle review dispute listing for administrators."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )

    def get(self, request):
        """Retrieve a paginated list of review disputes."""

        disputes = ManageReviewDisputeService.list_disputes(
            status=request.query_params.get("status"),
            reason=request.query_params.get("reason"),
            business_id=request.query_params.get("business"),
            review_id=request.query_params.get("review"),
            ordering=request.query_params.get("ordering"),
        )

        paginator = StandardPagination()

        page = paginator.paginate_queryset(
            disputes,
            request,
        )

        serializer = AdminReviewDisputeListSerializer(
            page,
            many=True,
        )

        return paginator.get_paginated_response(
            serializer.data,
        )


class AdminReviewDisputeDetailView(APIView):
    """Handle administrator viewing of a review dispute."""

    permission_classes = AdminReviewDisputeListView.permission_classes

    def get(self, request, dispute_id):
        """Retrieve a review dispute and its details."""

        dispute = ManageReviewDisputeService.get_dispute_detail(
            dispute_id,
        )

        serializer = AdminReviewDisputeDetailSerializer(
            dispute,
        )

        return success_response(
            data=serializer.data,
            message="Review dispute retrieved successfully.",
        )


class AdminReviewDisputeUpholdView(APIView):
    """Handle administrators upholding review disputes."""

    permission_classes = AdminReviewDisputeListView.permission_classes

    def post(self, request, dispute_id):
        """Uphold a pending review dispute."""

        serializer = AdminReviewDisputeResolutionSerializer(
            data=request.data,
        )

        serializer.is_valid(
            raise_exception=True,
        )

        dispute = ManageReviewDisputeService.uphold_dispute(
            dispute_id,
            **serializer.validated_data,
        )

        return success_response(
            data=AdminReviewDisputeDetailSerializer(
                dispute,
            ).data,
            message="Review dispute upheld successfully.",
        )


class AdminReviewDisputeDismissView(APIView):
    """Handle administrators dismissing review disputes."""

    permission_classes = AdminReviewDisputeListView.permission_classes

    def post(self, request, dispute_id):
        """Dismiss a pending review dispute."""

        serializer = AdminReviewDisputeResolutionSerializer(
            data=request.data,
        )

        serializer.is_valid(
            raise_exception=True,
        )

        dispute = ManageReviewDisputeService.dismiss_dispute(
            dispute_id,
            **serializer.validated_data,
        )

        return success_response(
            data=AdminReviewDisputeDetailSerializer(
                dispute,
            ).data,
            message="Review dispute dismissed successfully.",
        )