from apps.explorer_operations.explore_businesses.serializers.business_map_serializers import (
    ExploreMapPreviewBusinessSerializer,
    ExploreMapPreviewQuerySerializer,
)
from apps.explorer_operations.explore_businesses.services.explore_map_preview_service import (
    ExploreMapPreviewService,
)
from core.responses import success_response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView


class ExploreMapPreviewView(APIView):
    """Handle nearby business markers for the Explore map preview."""

    permission_classes = (
        IsAuthenticated,
    )

    def get(self, request):
        """Retrieve lightweight nearby business marker data."""

        query_serializer = ExploreMapPreviewQuerySerializer(
            data=request.query_params,
        )
        query_serializer.is_valid(
            raise_exception=True,
        )

        businesses = ExploreMapPreviewService.list_nearby_preview_businesses(
            latitude=query_serializer.validated_data["latitude"],
            longitude=query_serializer.validated_data["longitude"],
        )

        serializer = ExploreMapPreviewBusinessSerializer(
            businesses,
            many=True,
        )

        return success_response(
            data=serializer.data,
            message="Nearby map businesses retrieved successfully.",
        )