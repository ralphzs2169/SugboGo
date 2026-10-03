from core.pagination import StandardPagination
from core.responses import success_response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.merchant_operations.business_profile.serializers.business_classification_change_serializers import (
    AdminBusinessClassificationChangeSerializer,
    BusinessClassificationChangeRejectSerializer,
)
from apps.merchant_operations.business_profile.services.business_classification_change_service import (
    BusinessClassificationChangeService,
)
from apps.users.models import User


class AdminBusinessClassificationChangeListView(APIView):
    """List classification proposals for Admin review."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )

    def get(self, request):
        """Return the paginated queue with optional status filtering."""
        requests = BusinessClassificationChangeService.list_for_admin(
            status=request.query_params.get("status"),
        )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(requests, request)
        serializer = AdminBusinessClassificationChangeSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class AdminBusinessClassificationChangeDetailView(APIView):
    """Compare a proposal with captured and current live classification."""

    permission_classes = AdminBusinessClassificationChangeListView.permission_classes

    def get(self, request, request_id):
        """Return review and resolution context."""
        change_request = BusinessClassificationChangeService.get_for_admin(request_id)
        return success_response(
            data=AdminBusinessClassificationChangeSerializer(change_request).data,
            message="Classification change request retrieved successfully.",
        )


class AdminBusinessClassificationChangeApproveView(APIView):
    """Apply one pending classification proposal atomically."""

    permission_classes = AdminBusinessClassificationChangeListView.permission_classes

    def post(self, request, request_id):
        """Approve only when the captured baseline and proposal remain valid."""
        change_request = BusinessClassificationChangeService.approve(
            request_id=request_id,
            reviewer=request.user,
        )
        return success_response(
            data=AdminBusinessClassificationChangeSerializer(change_request).data,
            message="Classification change request approved successfully.",
        )


class AdminBusinessClassificationChangeRejectView(APIView):
    """Reject one pending proposal with a merchant-facing reason."""

    permission_classes = AdminBusinessClassificationChangeListView.permission_classes

    def post(self, request, request_id):
        """Record the decision without changing live classification."""
        serializer = BusinessClassificationChangeRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        change_request = BusinessClassificationChangeService.reject(
            request_id=request_id,
            reviewer=request.user,
            rejection_reason=serializer.validated_data["rejection_reason"],
        )
        return success_response(
            data=AdminBusinessClassificationChangeSerializer(change_request).data,
            message="Classification change request rejected successfully.",
        )
