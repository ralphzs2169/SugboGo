"""Admin overview for merchant update requests."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.admin_operations.business_management.serializers.update_request_filter_serializers import (
    UpdateRequestSummaryFilterSerializer,
)
from apps.admin_operations.business_management.services.update_request_metrics_service import (
    UpdateRequestMetricsService,
)
from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.responses import success_response


class UpdateRequestSummaryView(APIView):
    """Expose full-queue summaries to Admin and Super Admin accounts."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )

    def get(
        self,
        request,
    ):
        """Validate scope and return the standard success envelope."""
        filters = UpdateRequestSummaryFilterSerializer(data=request.query_params.dict())
        filters.is_valid(raise_exception=True)
        return success_response(
            data=UpdateRequestMetricsService.get_summary(**filters.validated_data),
            message="Update request summary retrieved successfully.",
        )
