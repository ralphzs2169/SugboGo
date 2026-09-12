from apps.authentication.permissions import HasRole
from apps.explorer_operations.explore_businesses.serializers.explore_specialty_serializers import (
    ExploreSpecialtySerializer,
)
from apps.explorer_operations.explore_businesses.services.explore_specialty_tag_service import (
    ExploreSpecialtyService,
)
from apps.users.models import User
from core.responses import success_response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView


class ExploreSpecialtyView(APIView):
    """Handle Specialty Tag shortcuts displayed on the Explorer feed."""

    permission_classes = (
        IsAuthenticated,
        HasRole(
            User.UserRole.EXPLORER,
            User.UserRole.MERCHANT,
        ),
    )

    def get(self, request):
        """Retrieve rotating Specialty Tags with active business counts."""

        specialties = ExploreSpecialtyService.list_specialties()

        serializer = ExploreSpecialtySerializer(
            specialties,
            many=True,
        )

        return success_response(
            data=serializer.data,
            message="Explore specialties retrieved successfully.",
        )