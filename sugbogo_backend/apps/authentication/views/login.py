from rest_framework.decorators import api_view
from rest_framework import status

from apps.authentication.serializers import LoginSerializer
from apps.users.models import User
from apps.core.responses import error_response, success_response
from apps.authentication.utils.jwt import issue_tokens
from apps.authentication.models import OAuthAccount



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

    
    if user is not None and not user.has_usable_password():
        oauth_account = OAuthAccount.objects.filter(USER=user).first()

        if oauth_account:
            provider = oauth_account.get_OAUTH_PROVIDER_display()

            return error_response(
                message=f"This account uses {provider} Sign-In. Please continue with {provider}.",
                code="OAUTH_ACCOUNT",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )


    if user is None or not user.check_password(password):
        return error_response(
            message="Invalid email or password.",
            code="INVALID_CREDENTIALS",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    if not user.is_active:
        return error_response(
            message=f"Account is {user.USER_STATUS}. Please contact support.",
            code="ACCOUNT_INACTIVE",
            status_code=status.HTTP_403_FORBIDDEN,
        )
    
    if not user.EMAIL_VERIFIED:
        return error_response(
            message="Please verify your email address before logging in.",
            code="EMAIL_NOT_VERIFIED",
            status_code=status.HTTP_403_FORBIDDEN,
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
                "has_completed_interest_selection": user.HAS_COMPLETED_INTEREST_SELECTION,
            },
            **tokens,
        }
    )
