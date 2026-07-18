from google.auth.exceptions import GoogleAuthError

from rest_framework.decorators import api_view
from rest_framework import status

from apps.authentication.serializers import GoogleLoginSerializer

from apps.authentication.services.oauth.google import GoogleOAuthService
from apps.authentication.services.oauth.account import OAuthAccountService

from apps.authentication.utils.jwt import issue_tokens

from apps.core.responses import (
    success_response,
    error_response,
)

@api_view(["POST"])
def google_login_view(request):
    serializer = GoogleLoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    try:
        oauth_user = GoogleOAuthService.verify_id_token(
            serializer.validated_data["id_token"]
        )

    except GoogleAuthError as e:
        print("GoogleAuthError:", e)
        raise

    user = OAuthAccountService.get_or_create_user(oauth_user)

    tokens = issue_tokens(
        user=user,
        remember_me=True,
    )

    return success_response(
        message="Google login successful.",
        data={
            "user": {
                "id": user.USER_ID,
                "email": user.USER_EMAIL,
                "role": user.USER_ROLE,
                "status": user.USER_STATUS,
                "has_completed_interest_selection": user.HAS_COMPLETED_INTEREST_SELECTION,
            },
            **tokens,
        },
    )