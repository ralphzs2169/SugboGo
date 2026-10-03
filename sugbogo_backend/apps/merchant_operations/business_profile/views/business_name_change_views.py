from core.pagination import StandardPagination
from core.responses import success_response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.merchant_operations.business_profile.serializers.business_name_change_serializers import (
    BusinessNameChangeCreateSerializer,
    MerchantBusinessNameChangeSerializer,
)
from apps.merchant_operations.business_profile.services.business_name_change_service import (
    BusinessNameChangeService,
)
from apps.users.models import User


class MerchantBusinessNameChangeListView(APIView):
    """List the authenticated merchant's name change history."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.MERCHANT),
    )

    def get(self, request):
        """Return newest requests through the standard pagination envelope."""
        requests = BusinessNameChangeService.list_for_merchant(request.user)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(requests, request)
        serializer = MerchantBusinessNameChangeSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class MerchantBusinessNameChangeCreateView(APIView):
    """Submit a proposed name for Admin review."""

    permission_classes = MerchantBusinessNameChangeListView.permission_classes

    def post(self, request):
        """Validate and store a proposal without updating the business."""
        serializer = BusinessNameChangeCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        change_request = BusinessNameChangeService.submit(
            user=request.user,
            proposed_business_name=(
                serializer.validated_data["proposed_business_name"]
            ),
        )
        return success_response(
            data=MerchantBusinessNameChangeSerializer(change_request).data,
            message="Business name change request submitted successfully.",
            status_code=status.HTTP_201_CREATED,
        )


class MerchantBusinessNameChangeDetailView(APIView):
    """Retrieve one request owned by the authenticated merchant."""

    permission_classes = MerchantBusinessNameChangeListView.permission_classes

    def get(self, request, request_id):
        """Return one request without exposing another merchant's history."""
        change_request = BusinessNameChangeService.get_for_merchant(
            request.user,
            request_id,
        )
        return success_response(
            data=MerchantBusinessNameChangeSerializer(change_request).data,
            message="Business name change request retrieved successfully.",
        )


class MerchantBusinessNameChangeWithdrawView(APIView):
    """Withdraw a merchant-owned pending request."""

    permission_classes = MerchantBusinessNameChangeListView.permission_classes

    def post(self, request, request_id):
        """Resolve the pending request without touching the live business."""
        change_request = BusinessNameChangeService.withdraw(
            request.user,
            request_id,
        )
        return success_response(
            data=MerchantBusinessNameChangeSerializer(change_request).data,
            message="Business name change request withdrawn successfully.",
        )
