from rest_framework.decorators import api_view
from rest_framework import status
  
from apps.authentication.serializers import ResetPasswordSerializer
from apps.core.responses import error_response, success_response
from apps.authentication.services.password_reset_service import PasswordResetService

@api_view(["POST"])
def reset_password_view(request):
    """Reset a user's password using a valid reset token."""
    serializer = ResetPasswordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = PasswordResetService.reset_password(
        uid=serializer.validated_data["uid"],
        token=serializer.validated_data["token"],
        password=serializer.validated_data["password"],
    )

    if user is None:
        return error_response(
            message="This password reset link is invalid or has expired.",
            code="INVALID_RESET_LINK",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    return success_response(message="Password reset successfully.")   