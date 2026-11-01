"""Independent protected Dashboard Priority Worklist endpoint."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.admin_operations.dashboard.priority_worklist_serializers import (
    PriorityWorklistSerializer,
)
from apps.admin_operations.dashboard.priority_worklist_service import (
    PriorityWorklistService,
)
from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.responses import success_response


class DashboardPriorityWorklistView(APIView):
    """Provide at most five real pending workflow items to active administrators."""

    permission_classes = (
        IsAuthenticated,
        HasRole(
            User.UserRole.ADMIN,
            User.UserRole.SUPER_ADMIN,
        ),
    )

    def get(self, request):
        """Return the independent worklist without invoking other Dashboard reports."""
        worklist = PriorityWorklistService.get_worklist()

        return success_response(
            data=PriorityWorklistSerializer(worklist).data,
            message="Dashboard priority worklist retrieved successfully.",
        )
