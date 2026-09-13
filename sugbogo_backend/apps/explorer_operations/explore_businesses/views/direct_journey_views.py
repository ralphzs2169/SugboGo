from apps.authentication.permissions import HasRole
from apps.explorer_operations.explore_businesses.serializers.direct_journey_serializers import (
    DirectJourneyQuerySerializer,
    DirectJourneySearchResultSerializer,
)
from apps.transit.services.direct_journey_service import DirectJourneyService
from apps.users.models import User
from core.responses import success_response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView


class DirectJourneySearchView(APIView):
    """Handle Explorer-facing direct jeepney journey searches."""

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
        """Return ranked zero-transfer journeys to one active business."""

        query_serializer = DirectJourneyQuerySerializer(
            data=request.query_params,
        )
        query_serializer.is_valid(
            raise_exception=True,
        )

        result = DirectJourneyService.search_direct_journeys(
            business_id=business_id,
            latitude=query_serializer.validated_data["latitude"],
            longitude=query_serializer.validated_data["longitude"],
        )
        result_serializer = DirectJourneySearchResultSerializer(
            result,
        )

        return success_response(
            data=result_serializer.data,
            message="Direct jeepney journeys retrieved successfully.",
        )
