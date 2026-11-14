from django.db import transaction
from django.utils.encoding import force_bytes, force_str
from django.utils.http import (
    urlsafe_base64_encode,
    urlsafe_base64_decode,
)
from rest_framework.exceptions import PermissionDenied

from apps.users.models import User
import logging

from apps.authentication.services.session_service import SessionService
from apps.authentication.constants import Platform
from apps.authentication.permissions import user_has_role
from apps.authentication.tokens import (
    admin_password_reset_token_generator,
    password_reset_token_generator,
)
from config import settings
from apps.authentication.services.account_lockout_service import AccountLockoutService

logger = logging.getLogger(__name__)


class PasswordResetService:
    """Service for generating and validating password reset tokens."""
    
    def get_reset_expiry_hours():
        return settings.PASSWORD_RESET_TIMEOUT 

    @staticmethod
    def is_eligible(
        user: User,
        platform: str,
    ) -> bool:
        """Restrict recovery to active accounts in the requested portal."""
        if not user.is_active:
            return False

        if platform == Platform.WEB:
            return (
                user.EMAIL_VERIFIED
                and user_has_role(user, User.UserRole.ADMIN)
            )

        return (
            platform == Platform.MOBILE
            and user.USER_ROLE in (
                User.UserRole.EXPLORER,
                User.UserRole.MERCHANT,
            )
        )

    @staticmethod
    def generate_reset_link(
        user: User,
        platform: str = Platform.MOBILE,
    ) -> str:
        """
        Generate a password reset link for a user.

        Args:
            user: The user to generate a reset link for.

        Returns:
            A signed reset URL containing the user's encoded ID and token.
        """
        if not PasswordResetService.is_eligible(user, platform):
            raise PermissionDenied("This account cannot use this password recovery.")

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        if platform == Platform.WEB:
            token = admin_password_reset_token_generator.make_token(user)
            return (
                f"{settings.WEB_APP_URL}/reset-password"
                f"?uid={uid}"
                f"&token={token}"
            )

        token = password_reset_token_generator.make_token(user)
        return (
            f"{settings.MOBILE_SCHEME}reset-password"
            f"?uid={uid}"
            f"&token={token}"
        )

    @staticmethod
    def _has_valid_token(
        user: User,
        token: str,
    ) -> bool:
        """Check the proof against the account's current recovery eligibility."""
        if user_has_role(user, User.UserRole.ADMIN):
            return (
                PasswordResetService.is_eligible(user, Platform.WEB)
                and admin_password_reset_token_generator.check_token(user, token)
            )

        return (
            PasswordResetService.is_eligible(user, Platform.MOBILE)
            and password_reset_token_generator.check_token(user, token)
        )

    @staticmethod
    def verify_token(
        uid: str,
        token: str,
    ) -> User | None:
        """
        Validate a password reset token.

        Args:
            uid: Base64 encoded user ID.
            token: Password reset token.

        Returns:
            The matching user if the token is valid; otherwise None.
        """
        try:
            user_id = force_str(
                urlsafe_base64_decode(uid)
            )

            user = User.objects.get(pk=user_id)

        except (
            TypeError,
            ValueError,
            OverflowError,
            User.DoesNotExist,
        ) as exc:
            logger.warning(
                "Invalid password reset token: %s",
                exc,
            )
            return None

        if PasswordResetService._has_valid_token(user, token):
            return user

        return None

    @staticmethod
    @transaction.atomic
    def reset_password(
        uid: str,
        token: str,
        password: str,
    ) -> User | None:
        """
        Reset a user's password and revoke all active sessions.

        Returns:
            The updated user if successful; otherwise None.
        """
        user = PasswordResetService.verify_token(
            uid,
            token,
        )

        if user is None:
            return None

        # Recheck proof after acquiring the same lock used by sign-in and password changes.
        try:
            user = User.objects.select_for_update().get(pk=user.pk)
        except User.DoesNotExist:
            return None
        if not PasswordResetService._has_valid_token(user, token):
            return None

        user.set_password(password)
        user.save(update_fields=["password"])
        AccountLockoutService.clear(user)

        SessionService.revoke_all_sessions(user)

        return user
