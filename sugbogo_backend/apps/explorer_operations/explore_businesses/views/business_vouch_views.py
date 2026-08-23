from apps.authentication.permissions import HasRole
from apps.business.services.vouch_service import VouchService
from apps.explorer_operations.explore_businesses.serializers.business_vouch_serializer import (
    BusinessVouchSerializer,
)
from apps.users.models import User
from core.responses import success_response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView


class BusinessVouchView(APIView):
    """Handle creating and removing Explorer business specialty vouches."""

    permission_classes = (
        IsAuthenticated,
        HasRole(
            User.UserRole.EXPLORER,
            User.UserRole.MERCHANT,
        ),
    )

    def post(self, request, business_id):
        """Create a vouch for a business specialty."""

        serializer = BusinessVouchSerializer(
            data=request.data,
        )
        serializer.is_valid(raise_exception=True)

        vouch = VouchService.create_vouch(
            user=request.user,
            business_id=business_id,
            **serializer.validated_data,
        )

        return success_response(
            data={
                "id": vouch.VOUCH_ID,
                "business_id": vouch.BUSN_ID_id,
                "tag_id": vouch.TAG_ID_id,
                "is_vouched": True,
            },
            message="Vouch added successfully.",
        )
    
    def delete(self, request, business_id):
        """Remove the authenticated user's vouch for a business specialty."""

        tag_id = request.data.get("tag_id")

        VouchService.remove_vouch(
            user=request.user,
            business_id=business_id,
            tag_id=tag_id,
        )

        return success_response(
            data={
                "business_id": business_id,
                "tag_id": tag_id,
                "is_vouched": False,
            },
            message="Vouch removed successfully.",
        )