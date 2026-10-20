from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.business.services.pocket_service import PocketService
from apps.users.models import User
from core.responses import success_response

from ..serializers.pocket_collection_serializers import BusinessPocketMembershipSerializer


class BusinessPocketMembershipView(APIView):
    """Reads or replaces a business's complete private Pocket selection."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.EXPLORER, User.UserRole.MERCHANT),
    )

    def get(self, request, business_id):
        """Returns all selected collection IDs independently of overview pagination."""
        return success_response(
            data=PocketService.get_memberships(request.user, business_id),
            message="Pocket memberships retrieved successfully.",
        )

    def put(self, request, business_id):
        """Commits the complete desired membership set in one transaction."""
        serializer = BusinessPocketMembershipSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return success_response(
            data=PocketService.replace_memberships(
                user=request.user,
                business_id=business_id,
                **serializer.validated_data,
            ),
            message="Pocket memberships updated successfully.",
        )


class PocketBusinessMembershipView(APIView):
    """Removes a business from one owned Pocket without affecting the others."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.EXPLORER, User.UserRole.MERCHANT),
    )

    def delete(self, request, collection_id, business_id):
        """Returns the authoritative remaining selection after idempotent removal."""
        return success_response(
            data=PocketService.remove_membership(
                request.user,
                collection_id,
                business_id,
            ),
            message="Business removed from Pocket successfully.",
        )
