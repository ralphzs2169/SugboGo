from rest_framework.decorators import api_view
from rest_framework import status

from apps.authentication.serializers import LogoutSerializer
from core.responses import error_response, success_response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError


@api_view(["POST"])
def logout_view(request):
    serializer = LogoutSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    refresh_token = serializer.validated_data["refresh"]

    try:
        token = RefreshToken(refresh_token)
        token.blacklist()
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
