from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from core.responses import error_response, success_response

from apps.registration.serializers.application_location_serializers import (
    MerchantApplicationLandmarkReadSerializer,
    MerchantApplicationLandmarkSerializer,
    MerchantApplicationLocationReadSerializer,
    MerchantApplicationLocationSerializer,
)
from apps.registration.services.application_service import ApplicationService
from apps.registration.services.location_service import LocationService


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def location_save_view(request):
    """Step 2. Creates or updates the location tied to the current application."""

    application = ApplicationService.get_current_application(request.user)

    if application is None:
        return error_response(
            message="Complete Step 1 (Business Identity) before adding a location.",
            code="APPLICATION_NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    serializer = MerchantApplicationLocationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    location = LocationService.save_location(application, serializer.validated_data)
    output_serializer = MerchantApplicationLocationReadSerializer(location)

    return success_response(
        data=output_serializer.data,
        message="Location saved successfully.",
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def landmark_add_view(request):
    """Step 3. Adds one landmark to the current application's location."""

    application = ApplicationService.get_current_application(request.user)

    if application is None or getattr(application, "location", None) is None:
        return error_response(
            message="Complete Step 2 (Location) before adding landmarks.",
            code="LOCATION_NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    serializer = MerchantApplicationLandmarkSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    landmark = LocationService.add_landmark(
        application.location, serializer.validated_data
    )
    output_serializer = MerchantApplicationLandmarkReadSerializer(landmark)

    return success_response(
        data=output_serializer.data,
        message="Landmark added successfully.",
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def landmark_delete_view(request, landmark_id):
    """Step 3. Removes one landmark from the current application's location."""

    application = ApplicationService.get_current_application(request.user)

    if application is None or getattr(application, "location", None) is None:
        return error_response(
            message="No location found for this application.",
            code="LOCATION_NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    landmark = LocationService.get_landmark_for_location(
        application.location, landmark_id
    )
    LocationService.delete_landmark(landmark)

    return success_response(message="Landmark deleted successfully.")