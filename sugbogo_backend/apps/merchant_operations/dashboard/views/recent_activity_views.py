from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.merchant_operations.dashboard.serializers.recent_activity_serializers import (
    RecentActivityQuerySerializer,
    RecentActivitySerializer,
)
from apps.merchant_operations.dashboard.services.recent_activity_service import (
    RecentActivityService,
)
from apps.users.models import User
from core.responses import success_response


class RecentActivityView(APIView):
    """Serve a merchant's latest business activity without requiring Merchant Plus."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.MERCHANT),
    )

    def get(
        self,
        request,
    ):
        """Validate a filter-free request and return a sanitized activity snapshot."""
        query = RecentActivityQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        snapshot = RecentActivityService.get_snapshot(request.user)
        return success_response(
            data=RecentActivitySerializer(snapshot).data,
            message="Recent business activity retrieved successfully.",
        )
