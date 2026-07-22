from google.auth.exceptions import GoogleAuthError
from apps.users.models import User
from rest_framework.decorators import api_view

from apps.authentication.serializers import GoogleLoginSerializer

from apps.authentication.services.oauth.google import GoogleOAuthService
from apps.authentication.services.oauth.account import OAuthAccountService

from apps.authentication.utils.jwt import issue_tokens
from rest_framework import status

from core.responses import error_response, success_response
from apps.authentication.permissions import user_has_role

@api_view(["POST"])
def google_login_view(request):
    serializer = GoogleLoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    
    # Verify the Google ID token and retrieve user information
    try:
        oauth_user = GoogleOAuthService.verify_id_token(
            serializer.validated_data["id_token"]
        )
    except GoogleAuthError:
        return error_response(
            message="Invalid Google token.",
            code="INVALID_GOOGLE_TOKEN",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    # Check if the user already exists and has an admin role
    existing_user = User.objects.filter(
        USER_EMAIL=oauth_user.email
    ).first()

    if existing_user and user_has_role(
        existing_user,
        User.UserRole.ADMIN,
    ):
        return error_response(
            message="Admin accounts cannot use OAuth login.",
            code="OAUTH_LOGIN_DENIED",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    # If the user does not exist or is not an admin, proceed to get or create the user
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

