from rest_framework.decorators import api_view
from rest_framework import status

from apps.authentication.serializers import LogoutSerializer
from core.responses import error_response, success_response
from apps.authentication.services.session_service import SessionService
from rest_framework_simplejwt.exceptions import TokenError


@api_view(["POST"])
def logout_view(request):
    """Revokes renewal for the supplied refresh token without requiring an access token."""
    serializer = LogoutSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    refresh_token = serializer.validated_data["refresh"]

    try:
        SessionService.revoke_refresh_token(refresh_token)
    except TokenError:
        return error_response(
            message="Invalid refresh token.",
            code="INVALID_TOKEN",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    return success_response(
        message="Successfully logged out.",
        status_code=status.HTTP_205_RESET_CONTENT,
    )
