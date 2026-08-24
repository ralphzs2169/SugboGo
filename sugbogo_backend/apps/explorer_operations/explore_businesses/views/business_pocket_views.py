from apps.authentication.permissions import HasRole
from apps.business.services.pocket_service import PocketService
from apps.users.models import User
from core.responses import success_response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView


class BusinessPocketView(APIView):
    """Handle adding and removing Explorer business pockets."""

    permission_classes = (
        IsAuthenticated,
        HasRole(
            User.UserRole.EXPLORER,
            User.UserRole.MERCHANT,
        ),
    )

    def post(self, request, business_id):
        """Add a business to the authenticated user's pocket."""

        pocket = PocketService.create_pocket(
            user=request.user,
            business_id=business_id,
        )

        return success_response(
            data={
                "id": pocket.PCKT_ID,
                "business_id": pocket.BUSN_ID_id,
                "is_pocketed": True,
            },
            message="Business added to your pocket successfully.",
        )

    def delete(self, request, business_id):
        """Remove a business from the authenticated user's pocket."""

        PocketService.remove_pocket(
            user=request.user,
            business_id=business_id,
        )

        return success_response(
            data={
                "business_id": business_id,
                "is_pocketed": False,
            },
            message="Business removed from your pocket successfully.",
        )