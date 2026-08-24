from apps.authentication.permissions import HasRole
from apps.explorer_operations.explore_businesses.serializers.explore_business_serializer import (
    ExploreBusinessDetailSerializer,
)
from apps.explorer_operations.explore_businesses.services.explore_business_service import (
    ExploreBusinessService,
)
from apps.users.models import User
from core.responses import success_response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView


class BusinessDetailView(APIView):
    """Handle Explorer-facing business profile details."""

    permission_classes = (
        IsAuthenticated,
        HasRole(
            User.UserRole.EXPLORER,
            User.UserRole.MERCHANT,
        ),
    )

    def get(self, request, business_id):
        """Retrieve an active business for the Explorer profile."""

        business = ExploreBusinessService.get_business_detail(
            business_id,
            request.user,
        )

        serializer = ExploreBusinessDetailSerializer(
            business,
        )

        return success_response(
            data=serializer.data,
            message="Business retrieved successfully.",
        )