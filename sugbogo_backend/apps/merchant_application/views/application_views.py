from core.responses import error_response, success_response
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.merchant_application.serializers.application_serializers import (
    ApplicationDetailSerializer,
)
from apps.merchant_application.services.application_service import ApplicationService


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def application_detail_view(request):
    """Return the merchant's current application, fully nested."""

    application = ApplicationService.get_current_application(request.user)

    if application is None:
        return error_response(
            message="No application found. Start by submitting your business identity.",
            code="APPLICATION_NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    serializer = ApplicationDetailSerializer(application)

    return success_response(
        data=serializer.data,
        message="Application retrieved successfully.",
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def application_submit_view(request):
    """Final submit — flips the application status to SUBMITTED."""

    application = ApplicationService.get_current_application(request.user)

    if application is None:
        return error_response(
            message="No application found to submit.",
            code="APPLICATION_NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    application = ApplicationService.submit_application(application)
    serializer = ApplicationDetailSerializer(application)

    return success_response(
        data=serializer.data,
        message="Application submitted successfully.",
    )