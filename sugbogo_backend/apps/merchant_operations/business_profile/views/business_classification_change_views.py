from core.pagination import StandardPagination
from core.responses import success_response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.merchant_operations.business_profile.serializers.business_classification_change_serializers import (
    BusinessClassificationChangeCreateSerializer,
    MerchantBusinessClassificationChangeSerializer,
)
from apps.merchant_operations.business_profile.serializers.change_request_eligibility_serializers import (
    BusinessChangeRequestEligibilitySerializer,
)
from apps.merchant_operations.business_profile.services.business_classification_change_service import (
    BusinessClassificationChangeService,
)
from apps.users.models import User


class MerchantBusinessClassificationChangeListCreateView(APIView):
    """List classification history or submit one reviewed proposal."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.MERCHANT),
    )

    def get(self, request):
        """Return merchant-owned classification requests newest first."""
        requests = BusinessClassificationChangeService.list_for_merchant(request.user)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(requests, request)
        serializer = MerchantBusinessClassificationChangeSerializer(page, many=True)
        response = paginator.get_paginated_response(serializer.data)
        eligibility = (
            BusinessClassificationChangeService.get_eligibility_for_merchant(
                request.user,
            )
        )
        response.data["data"]["eligibility"] = (
            BusinessChangeRequestEligibilitySerializer(eligibility).data
        )
        return response

    def post(self, request):
        """Save a proposal while leaving live classification unchanged."""
        serializer = BusinessClassificationChangeCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        change_request = BusinessClassificationChangeService.submit(
            user=request.user,
            proposed_category_id=serializer.validated_data["proposed_category_id"],
            proposed_specialty_tag_ids=(
                serializer.validated_data["proposed_specialty_tag_ids"]
            ),
            reason=serializer.validated_data.get("reason"),
        )
        return success_response(
            data=MerchantBusinessClassificationChangeSerializer(change_request).data,
            message="Classification change request submitted successfully.",
            status_code=status.HTTP_201_CREATED,
        )


class MerchantBusinessClassificationChangeDetailView(APIView):
    """Show one classification request owned by the merchant."""

    permission_classes = MerchantBusinessClassificationChangeListCreateView.permission_classes

    def get(self, request, request_id):
        """Return one owned request without disclosing foreign requests."""
        change_request = BusinessClassificationChangeService.get_for_merchant(
            request.user,
            request_id,
        )
        return success_response(
            data=MerchantBusinessClassificationChangeSerializer(change_request).data,
            message="Classification change request retrieved successfully.",
        )


class MerchantBusinessClassificationChangeWithdrawView(APIView):
    """Withdraw one merchant-owned pending classification proposal."""

    permission_classes = MerchantBusinessClassificationChangeListCreateView.permission_classes

    def post(self, request, request_id):
        """Resolve a request without modifying the live business."""
        change_request = BusinessClassificationChangeService.withdraw(
            request.user,
            request_id,
        )
        return success_response(
            data=MerchantBusinessClassificationChangeSerializer(change_request).data,
            message="Classification change request withdrawn successfully.",
        )
