"""Administrator-only queue summaries for moderation metric cards."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.admin_operations.moderation.serializers.moderation_metrics_serializers import (
    ModerationMetricsFilterSerializer,
)
from apps.admin_operations.moderation.services.moderation_metrics_service import (
    ModerationMetricsService,
)
from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.responses import success_response


class AdminModerationSummaryView(APIView):
    """Expose active-tab metrics using the existing moderation permissions."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )

    def get(
        self,
        request,
    ):
        """Validate the tab and return its full-queue aggregates."""
        filters = ModerationMetricsFilterSerializer(data=request.query_params.dict())
        filters.is_valid(raise_exception=True)
        return success_response(
            data=ModerationMetricsService.get_summary(filters.validated_data["tab"]),
            message="Moderation summary retrieved successfully.",
        )
