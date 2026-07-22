from rest_framework.decorators import api_view
from rest_framework.permissions import AllowAny

from apps.authentication.serializers import ValidateResetTokenSerializer
from apps.authentication.services.password_reset_service import (
    PasswordResetService,
)
from core.responses import error_response, success_response


@api_view(["POST"])
def validate_reset_token_view(request):
    """
    Validate whether a password reset token is still valid.
    """
    serializer = ValidateResetTokenSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = PasswordResetService.verify_token(
        serializer.validated_data["uid"],
        serializer.validated_data["token"],
    )

    if user is None:
        return error_response(
            message="This password reset link is invalid or has expired.",
            code="INVALID_RESET_TOKEN",
            status_code=400,
        )

    return success_response(
        message="Reset link is valid.",
    )


validate_reset_token_view.permission_classes = [AllowAny]