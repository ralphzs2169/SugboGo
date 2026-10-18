from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.responses import success_response

from ..serializers.route_planning_serializers import (
    RoutePlanningAnalyticsSerializer,
    RoutePlanningQuerySerializer,
)
from ..services.route_planning_analytics_service import RoutePlanningAnalyticsService


class RoutePlanningAnalyticsView(APIView):
    """Serve an independently refreshable Standard report for the caller's business."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.MERCHANT),
    )

    def get(
        self,
        request,
    ):
        """Capture one Manila reporting window and preserve source-unavailable responses."""
        query = RoutePlanningQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        report = RoutePlanningAnalyticsService.get_report(
            request.user,
            query.validated_data["report_period"],
        )
        return success_response(
            data=RoutePlanningAnalyticsSerializer(report).data,
            message="Recorded route-planning analytics retrieved successfully.",
        )
