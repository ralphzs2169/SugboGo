from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.explorer_operations.explore_businesses.serializers.road_route_serializers import (
    RoadRouteQuerySerializer,
    RoadRouteSearchResultSerializer,
)
from apps.explorer_operations.explore_businesses.services.road_route_service import (
    RoadRouteService,
)
from apps.users.models import User
from core.responses import success_response


class RoadRouteView(APIView):
    """Handle Explorer-facing road-route requests to one business."""

    permission_classes = (
        IsAuthenticated,
        HasRole(
            User.UserRole.EXPLORER,
            User.UserRole.MERCHANT,
        ),
    )

    def get(
        self,
        request,
        business_id,
    ):
        """Return one normalized traffic-unaware driving route."""

        query_serializer = RoadRouteQuerySerializer(
            data=request.query_params,
        )
        query_serializer.is_valid(
            raise_exception=True,
        )

        result = RoadRouteService.get_road_route(
            business_id=business_id,
            latitude=query_serializer.validated_data["latitude"],
            longitude=query_serializer.validated_data["longitude"],
        )
        result_serializer = RoadRouteSearchResultSerializer(
            result,
        )

        return success_response(
            data=result_serializer.data,
            message="Road route retrieved successfully.",
        )
