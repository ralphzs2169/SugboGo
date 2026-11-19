"""Read Merchant Plus status for the authenticated business owner."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.responses import success_response

from ..serializers.plus_checkout_serializers import EmptyPlusInputSerializer
from ..serializers.plus_status_serializers import MerchantPlusAccessStatusSerializer
from ..services.merchant_plus_status_service import MerchantPlusStatusService


class MerchantPlusStatusView(APIView):
    """Expose paid and preview status under Merchant ownership checks."""

    permission_classes = (IsAuthenticated, HasRole(User.UserRole.MERCHANT))

    def get(self, request):
        """Validate the parameter-free status API without mutating entitlement records."""
        query = EmptyPlusInputSerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        return success_response(
            data=MerchantPlusAccessStatusSerializer(
                MerchantPlusStatusService.get_status(request.user),
            ).data,
            message="Merchant Plus status retrieved successfully.",
        )
