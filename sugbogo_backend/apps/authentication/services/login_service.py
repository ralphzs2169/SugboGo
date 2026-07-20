from rest_framework import status

from apps.authentication.models import OAuthAccount
from apps.core.responses import error_response
from apps.users.models import User


class LoginService:
    @staticmethod
    def authenticate(email: str, password: str):
        try:
            user = User.objects.get(USER_EMAIL=email)
        except User.DoesNotExist:
            user = None

        if user is not None and not user.has_usable_password():
            oauth_account = OAuthAccount.objects.filter(USER=user).first()

            if oauth_account:
                provider = oauth_account.get_OAUTH_PROVIDER_display()

                return (
                    error_response(
                        message=(
                            f"This account was created with {provider}. "
                            f"Continue with {provider} or use Forgot Password "
                            "to create a password."
                        ),
                        code="OAUTH_ACCOUNT",
                        status_code=status.HTTP_401_UNAUTHORIZED,
                    ),
                    None,
                )

        if user is None or not user.check_password(password):
            return (
                error_response(
                    message="Invalid email or password.",
                    code="INVALID_CREDENTIALS",
                    status_code=status.HTTP_401_UNAUTHORIZED,
                ),
                None,
            )

        if not user.is_active:
            return (
                error_response(
                    message=f"Account is {user.USER_STATUS}. Please contact support.",
                    code="ACCOUNT_INACTIVE",
                    status_code=status.HTTP_403_FORBIDDEN,
                ),
                None,
            )

        if not user.EMAIL_VERIFIED:
            return (
                error_response(
                    message="Please verify your email address before logging in.",
                    code="EMAIL_NOT_VERIFIED",
                    status_code=status.HTTP_403_FORBIDDEN,
                ),
                None,
            )

        return None, user

    @staticmethod
    def require_roles(user: User, allowed_roles: set[str]):
        if user.USER_ROLE not in allowed_roles:
            return error_response(
                message="You do not have permission to access this application.",
                code="ACCESS_DENIED",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        return None