from rest_framework.decorators import api_view

from apps.authentication.serializers import LoginResponseSerializer, LoginSerializer
from apps.authentication.services.login_service import LoginService
from apps.authentication.utils.jwt import issue_tokens
from core.responses import error_response, success_response
from apps.users.models import User
from rest_framework import status

@api_view(["POST"])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data["email"]
    password = serializer.validated_data["password"]
    remember_me = serializer.validated_data["remember_me"]

    response, user = LoginService.authenticate(
        email=email,
        password=password,
    )

    if response:
        return response

    if user.USER_ROLE not in {
        User.UserRole.EXPLORER,
        User.UserRole.MERCHANT,
    }:
        return error_response(
            message="This account cannot be used in the mobile application.",
            code="MOBILE_ACCESS_DENIED",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    if not user.EMAIL_VERIFIED:
        return error_response(
            message="Please verify your email address before logging in.",
            code="EMAIL_NOT_VERIFIED",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    tokens = issue_tokens(user, remember_me)

    response = LoginResponseSerializer(
        {
            "user": user,
            "access": tokens["access"],
            "refresh": tokens["refresh"],
        }
    )
    return success_response(
        message="Login successful.",
        data=response.data,
    )