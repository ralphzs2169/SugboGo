from core.responses import success_response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.merchant_operations.business_profile.serializers.change_request_eligibility_serializers import (
    BusinessChangePendingStatusSerializer,
)
from apps.merchant_operations.business_profile.services.business_change_pending_status_service import (
    BusinessChangePendingStatusService,
)
from apps.users.models import User


class MerchantBusinessChangePendingStatusView(APIView):
    """Expose lightweight pending indicators for merchant business changes."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.MERCHANT),
    )

    def get(self, request):
        """Return pending flags for the authenticated merchant's business."""
        pending_status = BusinessChangePendingStatusService.for_merchant(
            request.user,
        )
        serializer = BusinessChangePendingStatusSerializer(pending_status)
        return success_response(
            data=serializer.data,
            message="Business change pending status retrieved successfully.",
        )
