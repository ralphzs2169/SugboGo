from core.responses import error_response, success_response
from requests.exceptions import RequestException
from rest_framework import status
from rest_framework.decorators import api_view, throttle_classes

from apps.authentication.serializers import (
    FacebookLoginSerializer,
    LoginResponseSerializer,
)
from apps.authentication.services.oauth.account import OAuthAccountService
from apps.authentication.services.oauth.facebook import (
    FacebookAuthError,
    FacebookOAuthService,
)
from apps.authentication.throttles import OAuthLoginThrottle
from apps.authentication.utils.jwt import issue_tokens


@api_view(["POST"])
@throttle_classes([OAuthLoginThrottle])
def facebook_login_view(request):
    """Exchange a verified Facebook identity for an allowed mobile session."""
    serializer = FacebookLoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    try:
        oauth_user = FacebookOAuthService.verify_access_token(
            serializer.validated_data["access_token"]
        )

    except RequestException:
        return error_response(
            message="Unable to verify Facebook token.",
            code="FACEBOOK_SERVICE_UNAVAILABLE",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    except (FacebookAuthError, ValueError):
        return error_response(
            message="Invalid Facebook token.",
            code="INVALID_FACEBOOK_TOKEN",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    user = OAuthAccountService.get_or_create_user(oauth_user)

    tokens = issue_tokens(
        user=user,
        remember_me=True,
    )

    response = LoginResponseSerializer(
        {
            "user": user,
            "access": tokens["access"],
            "refresh": tokens["refresh"],
        }
    )

    return success_response(
        message="Facebook login successful.",
        data=response.data,
    )
