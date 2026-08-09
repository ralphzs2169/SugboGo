from core.responses import success_response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.admin_operations.taxonomy_management.services.specialty_tag_service import (
    SpecialtyTagService,
)
from apps.authentication.permissions import HasRole
from apps.users.models import User


class SpecialtyTagStatisticsView(APIView):
    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )

    def get(self, request):
        statistics = SpecialtyTagService.get_specialty_tag_statistics()

        return success_response(
            data=statistics,
        )