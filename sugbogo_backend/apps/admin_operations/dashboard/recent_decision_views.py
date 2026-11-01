"""Independent protected read endpoint for the Dashboard's recent administrative decisions."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.admin_operations.dashboard.recent_decision_serializers import (
    RecentDecisionsSerializer,
)
from apps.admin_operations.dashboard.recent_decisions_service import (
    RecentDecisionsService,
)
from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.responses import success_response


class DashboardRecentDecisionsView(APIView):
    """Provide a bounded decision feed to active Admin and Super Admin users."""

    permission_classes = (
        IsAuthenticated,
        HasRole(
            User.UserRole.ADMIN,
            User.UserRole.SUPER_ADMIN,
        ),
    )

    def get(self, request):
        """Return both persisted sources as one safe, independently loadable feed."""
        decisions = RecentDecisionsService.get_recent_decisions()

        return success_response(
            data=RecentDecisionsSerializer(decisions).data,
            message="Recent administrative decisions retrieved successfully.",
        )
