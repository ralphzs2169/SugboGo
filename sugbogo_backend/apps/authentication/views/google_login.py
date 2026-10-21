from core.responses import error_response, success_response
from google.auth.exceptions import GoogleAuthError, TransportError
from rest_framework import status
from rest_framework.decorators import api_view, throttle_classes

from apps.authentication.serializers import (
    GoogleLoginSerializer,
    LoginResponseSerializer,
)
from apps.authentication.services.oauth.account import OAuthAccountService
from apps.authentication.services.oauth.google import GoogleOAuthService
from apps.authentication.throttles import OAuthLoginThrottle
from apps.authentication.utils.jwt import issue_tokens
from apps.authentication.models import LoginEvent
from apps.authentication.utils.login_history import track_login_failure


@api_view(["POST"])
@throttle_classes([OAuthLoginThrottle])
@track_login_failure(LoginEvent.Method.GOOGLE)
def google_login_view(request):
    """Exchange a verified Google identity for an allowed mobile session."""
    serializer = GoogleLoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    
    # Verify the Google ID token and retrieve user information
    try:
        oauth_user = GoogleOAuthService.verify_id_token(
            serializer.validated_data["id_token"]
        )
    except TransportError:
        return error_response(
            message="Unable to verify Google token.",
            code="GOOGLE_SERVICE_UNAVAILABLE",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    except (GoogleAuthError, ValueError):
        return error_response(
            message="Invalid Google token.",
            code="INVALID_GOOGLE_TOKEN",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    request.verified_login_identity = oauth_user
    user = OAuthAccountService.get_or_create_user(oauth_user)

    tokens = issue_tokens(
        user=user,
        remember_me=True,
        request=request,
        method=LoginEvent.Method.GOOGLE,
    )

    response = LoginResponseSerializer(
        {
            "user": user,
            "access": tokens["access"],
            "refresh": tokens["refresh"],
        }
    )

    return success_response(
        message="Google login successful.",
        data=response.data,
    )

