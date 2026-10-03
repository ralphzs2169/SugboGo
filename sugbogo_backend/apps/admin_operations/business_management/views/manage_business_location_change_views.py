from core.pagination import StandardPagination
from core.responses import success_response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.merchant_operations.business_profile.serializers.business_location_change_serializers import (
    AdminBusinessLocationChangeSerializer,
    BusinessLocationChangeRejectSerializer,
)
from apps.merchant_operations.business_profile.services.business_location_change_service import (
    BusinessLocationChangeService,
)
from apps.users.models import User


class AdminBusinessLocationChangeListView(APIView):
    """List location proposals for Admin and Super Admin review."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )

    def get(

        self,

        request,

    ):
        """Return the paginated queue with optional status filtering."""
        requests = BusinessLocationChangeService.list_for_admin(
            status=request.query_params.get("status"),
        )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(requests, request)
        serializer = AdminBusinessLocationChangeSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class AdminBusinessLocationChangeDetailView(APIView):
    """Compare current live, captured previous, and proposed location state."""

    permission_classes = AdminBusinessLocationChangeListView.permission_classes

    def get(

        self,

        request,

        request_id,

    ):
        """Return one location proposal with reviewer context."""
        change_request = BusinessLocationChangeService.get_for_admin(request_id)
        return success_response(
            data=AdminBusinessLocationChangeSerializer(change_request).data,
            message="Location change request retrieved successfully.",
        )


class AdminBusinessLocationChangeApproveView(APIView):
    """Atomically apply one pending location and landmark proposal."""

    permission_classes = AdminBusinessLocationChangeListView.permission_classes

    def post(

        self,

        request,

        request_id,

    ):
        """Approve only a fresh and still-serviceable proposal."""
        change_request = BusinessLocationChangeService.approve(
            request_id=request_id,
            reviewer=request.user,
        )
        return success_response(
            data=AdminBusinessLocationChangeSerializer(change_request).data,
            message="Location change request approved successfully.",
        )


class AdminBusinessLocationChangeRejectView(APIView):
    """Reject one pending proposal with a merchant-facing reason."""

    permission_classes = AdminBusinessLocationChangeListView.permission_classes

    def post(

        self,

        request,

        request_id,

    ):
        """Record the decision without changing live location data."""
        serializer = BusinessLocationChangeRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        change_request = BusinessLocationChangeService.reject(
            request_id=request_id,
            reviewer=request.user,
            rejection_reason=serializer.validated_data["rejection_reason"],
        )
        return success_response(
            data=AdminBusinessLocationChangeSerializer(change_request).data,
            message="Location change request rejected successfully.",
        )
