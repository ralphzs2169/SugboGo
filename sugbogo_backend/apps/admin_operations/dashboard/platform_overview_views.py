"""Independent protected Dashboard platform-overview endpoint."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.admin_operations.dashboard.platform_overview_serializers import (
    PlatformOverviewSerializer,
)
from apps.admin_operations.dashboard.platform_overview_service import (
    PlatformOverviewService,
)
from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.responses import success_response


class DashboardPlatformOverviewView(APIView):
    """Provide recent platform events and current role counts to active administrators."""

    permission_classes = (
        IsAuthenticated,
        HasRole(
            User.UserRole.ADMIN,
            User.UserRole.SUPER_ADMIN,
        ),
    )

    def get(self, request):
        """Return the fixed seven-day overview without invoking other Dashboard sections."""
        overview = PlatformOverviewService.get_overview()

        return success_response(
            data=PlatformOverviewSerializer(overview).data,
            message="Dashboard platform overview retrieved successfully.",
        )
