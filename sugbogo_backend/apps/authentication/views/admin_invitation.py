from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

from apps.authentication.serializers import (
    AdminInvitationTokenSerializer,
    CompleteAdminInvitationSerializer,
)
from apps.authentication.services.admin_invitation_service import (
    AdminInvitationService,
)
from core.responses import error_response, success_response


INVALID_INVITATION_MESSAGE = (
    "This Admin invitation is invalid or has expired."
)


@api_view(["POST"])
@permission_classes([AllowAny])
def validate_admin_invitation_view(request):
    """Validates an Admin invitation without changing account state."""
    serializer = AdminInvitationTokenSerializer(
        data=request.data,
    )
    serializer.is_valid(
        raise_exception=True,
    )

    user = AdminInvitationService.verify_token(
        serializer.validated_data["uid"],
        serializer.validated_data["token"],
    )

    if user is None:
        return error_response(
            message=INVALID_INVITATION_MESSAGE,
            code="INVALID_ADMIN_INVITATION",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    return success_response(
        message="Admin invitation is valid.",
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def complete_admin_invitation_view(request):
    """Completes an Admin invitation without issuing authentication tokens."""
    serializer = CompleteAdminInvitationSerializer(
        data=request.data,
    )
    serializer.is_valid(
        raise_exception=True,
    )

    user = AdminInvitationService.complete_invitation(
        uid=serializer.validated_data["uid"],
        token=serializer.validated_data["token"],
        password=serializer.validated_data["password"],
        confirm_password=serializer.validated_data["confirm_password"],
    )

    if user is None:
        return error_response(
            message=INVALID_INVITATION_MESSAGE,
            code="INVALID_ADMIN_INVITATION",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    return success_response(
        message=(
            "Admin account setup completed. You can now log in."
        ),
    )
