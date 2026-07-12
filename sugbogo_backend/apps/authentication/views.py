from datetime import timedelta

from django.contrib.auth import authenticate
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.views import TokenRefreshView

from .serializers import LoginSerializer, LogoutSerializer

from apps.users.models import User

# "Remember me" unchecked -> short-lived refresh token (approved: 12 hours)
REMEMBER_ME_OFF_LIFETIME = timedelta(hours=12)


def _issue_tokens(user, remember_me: bool):
    """
    Issues an access + refresh token pair for a user.
    If remember_me is False, the refresh token's lifetime is shortened
    from the SIMPLE_JWT default (30 days) down to 12 hours.
    """
    refresh = RefreshToken.for_user(user)

    if not remember_me:
        refresh.set_exp(lifetime=REMEMBER_ME_OFF_LIFETIME)

    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }


@api_view(["POST"])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data["email"]
    password = serializer.validated_data["password"]
    remember_me = serializer.validated_data["remember_me"]

    try:
        user = User.objects.get(USER_EMAIL=email)
    except User.DoesNotExist:
        user = None

    if user is None or not user.check_password(password):
        return Response(
            {"detail": "Invalid email or password."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not user.is_active:
        return Response(
            {"detail": f"Account is {user.USER_STATUS}. Please contact support."},
            status=status.HTTP_403_FORBIDDEN,
        )

    tokens = _issue_tokens(user, remember_me)

    return Response(
        {
            "user": {
                "id": user.USER_ID,
                "email": user.USER_EMAIL,
                "role": user.USER_ROLE,
                "status": user.USER_STATUS,
            },
            **tokens,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
def register_view(request):
    return Response({
        "message": "Register endpoint"
    })


@api_view(["POST"])
def logout_view(request):
    serializer = LogoutSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    refresh_token = serializer.validated_data["refresh"]

    try:
        token = RefreshToken(refresh_token)
        token.blacklist()
    except TokenError:
        return Response(
            {"detail": "Invalid or already-blacklisted token."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response(
        {"detail": "Successfully logged out."},
        status=status.HTTP_205_RESET_CONTENT,
    )


# Token refresh — reuses simplejwt's built-in view directly, no custom
# logic needed since ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION
# in settings.py already handle blacklisting the old token automatically.
token_refresh_view = TokenRefreshView.as_view()