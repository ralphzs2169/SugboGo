from core.responses import success_response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.merchant_application.serializers.identity_serializers import (
    ApplicationIdentityReadSerializer,
    ApplicationIdentitySerializer,
)
from apps.merchant_application.services.application_service import ApplicationService
from apps.merchant_application.services.identity_service import IdentityService


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def identity_save_view(request):
    """
    Step 1. Creates the application + identity together on first save,
    updates identity in place on subsequent saves.
    """

    application = ApplicationService.get_current_application(request.user)
    is_update = application is not None and hasattr(application, "identity")
    serializer = ApplicationIdentitySerializer(data=request.data, partial=is_update)
    serializer.is_valid(raise_exception=True)

    _, identity = IdentityService.save_identity(
        request.user,
        serializer.validated_data,
    )

    output_serializer = ApplicationIdentityReadSerializer(identity)

    return success_response(
        data=output_serializer.data,
        message="Business identity saved successfully.",
    )
