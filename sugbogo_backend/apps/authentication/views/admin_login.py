from rest_framework.decorators import api_view

from apps.authentication.serializers import LoginSerializer
from apps.authentication.services.login_service import LoginService
from apps.authentication.utils.jwt import issue_tokens
from apps.core.responses import success_response, error_response
from apps.users.models import User


@api_view(["POST"])
def admin_login_view(request):
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
        User.UserRole.ADMIN,
        User.UserRole.SUPER_ADMIN,
    }:
        return error_response(
            message="You do not have permission to access the admin portal.",
            code="ADMIN_ACCESS_DENIED",
            status_code=403,
        )

    tokens = issue_tokens(user, remember_me)

    return success_response(
        message="Login successful.",
        data={
            "user": {
                "id": user.USER_ID,
                "email": user.USER_EMAIL,
                "role": user.USER_ROLE,
                "status": user.USER_STATUS,
            },
            **tokens,
        },
    )