from core.responses import error_response, success_response
from rest_framework.decorators import api_view, throttle_classes

from apps.authentication.permissions import user_has_role
from apps.authentication.serializers import LoginSerializer
from apps.authentication.services.login_service import LoginService
from apps.authentication.throttles import LoginThrottle
from apps.authentication.utils.jwt import issue_tokens
from apps.authentication.models import LoginEvent
from apps.authentication.utils.login_history import track_login_failure
from apps.users.models import User
from django.db import transaction


@api_view(["POST"])
@throttle_classes([LoginThrottle])
@track_login_failure(LoginEvent.Method.ADMIN)
@transaction.atomic
def admin_login_view(request):
    """Authenticates an allowed administrative account and records the outcome."""
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data["email"]
    request.login_history_email = email
    password = serializer.validated_data["password"]
    remember_me = serializer.validated_data["remember_me"]

    response, user = LoginService.authenticate(
        email=email,
        password=password,
    )

    if response:
        return response

    if not user_has_role(user, User.UserRole.ADMIN):
        return error_response(
            message="You do not have permission to access the admin portal.",
            code="ADMIN_ACCESS_DENIED",
            status_code=403,
        )

    tokens = issue_tokens(
        user, remember_me, request=request, method=LoginEvent.Method.ADMIN,
    )

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
