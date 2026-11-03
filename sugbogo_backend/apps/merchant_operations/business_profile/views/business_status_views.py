"""Owner-only access to the merchant-facing explanation of current business status."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.admin_operations.business_management.serializers.business_lifecycle_serializers import (
    BusinessStatusSerializer,
)
from apps.admin_operations.business_management.services.business_lifecycle_service import (
    BusinessLifecycleService,
)
from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.responses import success_response


class MerchantBusinessStatusView(APIView):
    """Resolve business identity exclusively from the authenticated merchant."""

    permission_classes = (IsAuthenticated, HasRole(User.UserRole.MERCHANT))

    def get(
        self,
        request,
    ):
        """Return current status and its merchant-facing reason, never administrative notes."""
        result = BusinessLifecycleService.merchant_status(request.user)
        return success_response(
            data=BusinessStatusSerializer(result).data,
            message="Business status retrieved successfully.",
        )
