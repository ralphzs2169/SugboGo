from core.pagination import StandardPagination
from core.responses import success_response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.merchant_operations.business_profile.serializers.business_name_change_serializers import (
    AdminBusinessNameChangeSerializer,
    BusinessNameChangeRejectSerializer,
)
from apps.merchant_operations.business_profile.services.business_name_change_service import (
    BusinessNameChangeService,
)
from apps.users.models import User


class AdminBusinessNameChangeListView(APIView):
    """List business name change requests for Admin review."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )

    def get(self, request):
        """Return a paginated queue with optional status filtering."""
        requests = BusinessNameChangeService.list_for_admin(
            status=request.query_params.get("status"),
        )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(requests, request)
        serializer = AdminBusinessNameChangeSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class AdminBusinessNameChangeDetailView(APIView):
    """Show a proposal alongside the current live name."""

    permission_classes = AdminBusinessNameChangeListView.permission_classes

    def get(self, request, request_id):
        """Retrieve full review context and prior decision data."""
        change_request = BusinessNameChangeService.get_for_admin(request_id)
        return success_response(
            data=AdminBusinessNameChangeSerializer(change_request).data,
            message="Business name change request retrieved successfully.",
        )


class AdminBusinessNameChangeApproveView(APIView):
    """Approve one pending name change request."""

    permission_classes = AdminBusinessNameChangeListView.permission_classes

    def post(self, request, request_id):
        """Apply the proposed name only if its baseline remains current."""
        change_request = BusinessNameChangeService.approve(
            request_id=request_id,
            reviewer=request.user,
        )
        return success_response(
            data=AdminBusinessNameChangeSerializer(change_request).data,
            message="Business name change request approved successfully.",
        )


class AdminBusinessNameChangeRejectView(APIView):
    """Reject one pending name change request with a merchant-facing reason."""

    permission_classes = AdminBusinessNameChangeListView.permission_classes

    def post(self, request, request_id):
        """Validate and record the rejection without changing the business."""
        serializer = BusinessNameChangeRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        change_request = BusinessNameChangeService.reject(
            request_id=request_id,
            reviewer=request.user,
            rejection_reason=serializer.validated_data["rejection_reason"],
        )
        return success_response(
            data=AdminBusinessNameChangeSerializer(change_request).data,
            message="Business name change request rejected successfully.",
        )
