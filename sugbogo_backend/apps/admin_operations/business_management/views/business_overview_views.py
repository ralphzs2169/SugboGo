"""Administrator-only Business Management overview."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.admin_operations.business_management.serializers.business_overview_serializers import (
    BusinessOverviewSerializer,
)
from apps.admin_operations.business_management.services.business_overview_service import (
    BusinessOverviewService,
)
from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.responses import success_response


class BusinessOverviewView(APIView):
    """Expose lightweight directory counts to Admin and Super Admin accounts."""

    permission_classes = (
        IsAuthenticated,
        HasRole(
            User.UserRole.ADMIN,
            User.UserRole.SUPER_ADMIN,
        ),
    )

    def get(
        self,
        request,
    ):
        """Return current inventory and backend-owned PHT creation windows."""
        overview = BusinessOverviewService.get_overview()
        return success_response(
            data=BusinessOverviewSerializer(overview).data,
            message="Business overview retrieved successfully.",
        )
