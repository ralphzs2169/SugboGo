from core.responses import success_response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.registration.serializers.identity_serializers import (
    ApplicationIdentityReadSerializer,
    ApplicationIdentitySerializer,
)
from apps.registration.services.identity_service import IdentityService


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def identity_save_view(request):
    """
    Step 1. Creates the application + identity together on first save,
    updates identity in place on subsequent saves.
    """

    serializer = ApplicationIdentitySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    _, identity = IdentityService.save_identity(
        request.user, serializer.validated_data
    )

    output_serializer = ApplicationIdentityReadSerializer(identity)

    return success_response(
        data=output_serializer.data,
        message="Business identity saved successfully.",
    )