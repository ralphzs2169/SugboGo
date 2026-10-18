from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.business.services.route_planning_event_service import RoutePlanningEventService
from apps.explorer_operations.explore_businesses.serializers.route_intent_serializer import (
    RouteIntentSerializer,
)
from apps.users.models import User
from core.responses import success_response


class RouteIntentView(APIView):
    """Collect explicit guidance requests without changing the guidance APIs."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.EXPLORER, User.UserRole.MERCHANT),
    )

    def post(
        self,
        request,
        business_id,
    ):
        """Validate the method and use only the authenticated account as the actor."""
        serializer = RouteIntentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = RoutePlanningEventService.record_intent(
            user=request.user,
            business_id=business_id,
            navigation_method=serializer.validated_data["navigation_method"],
        )
        return success_response(
            data=result,
            message="Route-planning request recorded.",
        )
