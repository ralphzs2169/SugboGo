from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.responses import success_response
from ..serializers.business_availability_serializers import (
    BusinessAvailabilityRequestSerializer,
)
from ..services.business_availability_service import BusinessAvailabilityService


class BusinessAvailabilityView(APIView):
    """Support saved-content reconciliation without opening restricted detail access."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.EXPLORER, User.UserRole.MERCHANT),
    )

    def post(
        self,
        request,
    ):
        """Return eligibility alone; never expose owner information or suspension reasons."""
        serializer = BusinessAvailabilityRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return success_response(
            data=BusinessAvailabilityService.check(
                serializer.validated_data["business_ids"],
            ),
            message="Business availability checked successfully.",
        )
