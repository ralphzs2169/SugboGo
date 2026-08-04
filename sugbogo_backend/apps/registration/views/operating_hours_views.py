from core.responses import error_response, success_response
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.registration.serializers.operating_hours_serializers import (
    MerchantApplicationOperatingHoursReadSerializer,
    MerchantApplicationOperatingHoursSerializer,
)
from apps.registration.services.application_service import ApplicationService
from apps.registration.services.operating_hours_service import OperatingHoursService


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def operating_hours_replace_view(request):
    """Step 3. Replaces the current application's full week of hours."""

    application = ApplicationService.get_current_application(request.user)

    if application is None:
        return error_response(
            message="Complete Step 1 (Business Identity) before setting hours.",
            code="APPLICATION_NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    serializer = MerchantApplicationOperatingHoursSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    hours = OperatingHoursService.replace_hours(
        application,
        serializer.validated_data["hours"],
    )

    output_serializer = MerchantApplicationOperatingHoursReadSerializer(
        hours, many=True
    )

    return success_response(
        data=output_serializer.data,
        message="Operating hours saved successfully.",
    )