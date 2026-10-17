from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.responses import success_response

from ..serializers.standard_analytics_serializers import StandardAnalyticsQuerySerializer, StandardAnalyticsSerializer
from ..services.standard_analytics_service import StandardAnalyticsService


class StandardAnalyticsView(APIView):
    """Serve owned-business aggregates without imposing a Premium entitlement."""

    permission_classes = (IsAuthenticated, HasRole(User.UserRole.MERCHANT))

    def get(self, request):
        """Validate dates and derive the business exclusively from authenticated ownership."""
        query = StandardAnalyticsQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        report = StandardAnalyticsService.get_report(request.user, query.validated_data["report_period"])
        return success_response(
            data=StandardAnalyticsSerializer(report).data,
            message="Merchant Standard analytics retrieved successfully.",
        )
