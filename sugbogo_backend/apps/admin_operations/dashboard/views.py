from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.admin_operations.dashboard.serializers import DashboardSummarySerializer
from apps.admin_operations.dashboard.services import DashboardSummaryService
from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.responses import success_response


@api_view(["GET"])
@permission_classes([
    IsAuthenticated,
    HasRole(
        User.UserRole.ADMIN,
        User.UserRole.SUPER_ADMIN,
    ),
])
def get_dashboard_data(request):
    """Return persisted operational counts to active Admin and Super Admin users."""
    summary = DashboardSummaryService.get_summary()

    return success_response(
        data=DashboardSummarySerializer(summary).data,
        message="Dashboard summary retrieved successfully.",
    )
