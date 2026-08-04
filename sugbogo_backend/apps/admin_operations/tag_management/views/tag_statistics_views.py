from apps.authentication.permissions import HasRole
from apps.msme.services.specialty_tag_service import SpecialtyTagService
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.users.models import User
from core.responses import success_response


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