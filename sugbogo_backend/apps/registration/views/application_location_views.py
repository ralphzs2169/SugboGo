from core.responses import error_response, success_response
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.registration.serializers.application_location_serializers import (
    ApplicationLocationReadSerializer,
    ApplicationLocationSerializer,
)
from apps.registration.services.application_service import ApplicationService
from apps.registration.services.location_service import LocationService


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def location_save_view(request):
    """Step 2. Saves the complete location and landmark state."""

    application = ApplicationService.get_current_application(request.user)

    if application is None:
        return error_response(
            message="Complete Step 1 (Business Identity) before adding a location.",
            code="APPLICATION_NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    serializer = ApplicationLocationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    location = LocationService.save_location(
        application,
        serializer.validated_data,
    )

    output_serializer = ApplicationLocationReadSerializer(location)

    return success_response(
        data=output_serializer.data,
        message="Location and landmarks saved successfully.",
    )