from core.pagination import StandardPagination
from core.responses import success_response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.merchant_operations.business_profile.serializers.business_location_change_serializers import (
    BusinessLocationChangeCreateSerializer,
    MerchantBusinessLocationChangeSerializer,
)
from apps.merchant_operations.business_profile.serializers.change_request_eligibility_serializers import (
    BusinessChangeRequestEligibilitySerializer,
)
from apps.merchant_operations.business_profile.services.business_location_change_service import (
    BusinessLocationChangeService,
)
from apps.users.models import User


class MerchantBusinessLocationChangeListCreateView(APIView):
    """List owned location history or submit a complete proposal."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.MERCHANT),
    )

    def get(

        self,

        request,

    ):
        """Return paginated merchant-owned requests newest first."""
        requests = BusinessLocationChangeService.list_for_merchant(request.user)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(requests, request)
        serializer = MerchantBusinessLocationChangeSerializer(page, many=True)
        response = paginator.get_paginated_response(serializer.data)
        eligibility = BusinessLocationChangeService.get_eligibility_for_merchant(
            request.user,
        )
        response.data["data"]["eligibility"] = (
            BusinessChangeRequestEligibilitySerializer(eligibility).data
        )
        return response

    def post(

        self,

        request,

    ):
        """Submit frozen proposed location and landmark values."""
        serializer = BusinessLocationChangeCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        change_request = BusinessLocationChangeService.submit(
            user=request.user,
            proposed_location=serializer.validated_data["proposed_location"],
            proposed_landmarks=serializer.validated_data["proposed_landmarks"],
        )
        return success_response(
            data=MerchantBusinessLocationChangeSerializer(change_request).data,
            message="Location change request submitted successfully.",
            status_code=status.HTTP_201_CREATED,
        )


class MerchantBusinessLocationChangeDetailView(APIView):
    """Show one location request owned by the merchant."""

    permission_classes = MerchantBusinessLocationChangeListCreateView.permission_classes

    def get(

        self,

        request,

        request_id,

    ):
        """Return frozen request details without disclosing foreign requests."""
        change_request = BusinessLocationChangeService.get_for_merchant(
            request.user,
            request_id,
        )
        return success_response(
            data=MerchantBusinessLocationChangeSerializer(change_request).data,
            message="Location change request retrieved successfully.",
        )


class MerchantBusinessLocationChangeWithdrawView(APIView):
    """Withdraw an owned pending location proposal."""

    permission_classes = MerchantBusinessLocationChangeListCreateView.permission_classes

    def post(

        self,

        request,

        request_id,

    ):
        """Resolve the proposal without modifying live location data."""
        change_request = BusinessLocationChangeService.withdraw(
            request.user,
            request_id,
        )
        return success_response(
            data=MerchantBusinessLocationChangeSerializer(change_request).data,
            message="Location change request withdrawn successfully.",
        )
