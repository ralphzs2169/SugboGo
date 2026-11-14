from django.db import transaction
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import (
    urlsafe_base64_encode,
    urlsafe_base64_decode,
)
from rest_framework.exceptions import PermissionDenied

from apps.authentication.constants import Platform
from apps.authentication.tokens import email_verification_token_generator
from apps.users.models import User
import logging

from config import settings

logger = logging.getLogger(__name__)


class EmailVerificationService:
    """Service for generating and validating email verification tokens."""

    @staticmethod
    def is_eligible(user: User) -> bool:
        """Limit ordinary email verification to active consumer accounts."""
        return (
            user.is_active
            and user.USER_ROLE in (
                User.UserRole.EXPLORER,
                User.UserRole.MERCHANT,
            )
        )

    @staticmethod
    def generate_verification_link(
        user: User,
        platform: Platform = Platform.MOBILE,
    ) -> str:
        """
        Generate an email verification link for a user.

        Args:
            user: The user to generate a verification link for.

        Returns:
            A signed verification URL containing the user's encoded ID and token.
        """
        if not EmailVerificationService.is_eligible(user):
            raise PermissionDenied("This account cannot use email verification.")

        uid = urlsafe_base64_encode(force_bytes(user.pk))

        token = email_verification_token_generator.make_token(user)

        if platform == Platform.WEB:
            return (
                f"{settings.WEB_APP_URL}/verify-email"
                f"?uid={uid}"
                f"&token={token}"
            )

        return (
            f"{settings.MOBILE_SCHEME}verify-email"
            f"?uid={uid}"
            f"&token={token}"
        )


    @staticmethod
    def verify_token(
        uid: str,
        token: str,
        *,
        lock_user: bool = False,
    ) -> User | None:
        """
        Validate an email verification token.

        Args:
            uid: Base64 encoded user ID.
            token: Verification token.
            lock_user: Acquire the user row lock within an active transaction.

        Returns:
            The matching user if the token is valid; otherwise None.
        """
        try:
            user_id = force_str(
                urlsafe_base64_decode(uid)
            )

            users = User.objects.all()
            if lock_user:
                users = users.select_for_update()
            user = users.get(pk=user_id)

        except (
            TypeError,
            ValueError,
            OverflowError,
            User.DoesNotExist,
        ) as exc:
            logger.warning(
                "Invalid email verification attempt: %s",
                exc,
            )
            return None

        if not EmailVerificationService.is_eligible(user):
            return None

        if email_verification_token_generator.check_token(
            user,
            token,
        ):
            return user

        return None

    @staticmethod
    @transaction.atomic
    def verify_email(
        uid: str,
        token: str,
    ) -> bool | None:
        """Return True on verification, False on replay, or None for invalid proof."""
        user = EmailVerificationService.verify_token(
            uid,
            token,
            lock_user=True,
        )
        if user is None:
            return None

        if user.EMAIL_VERIFIED:
            return False

        user.EMAIL_VERIFIED = True
        user.EMAIL_VERIFIED_AT = timezone.now()
        user.save(
            update_fields=[
                "EMAIL_VERIFIED",
                "EMAIL_VERIFIED_AT",
            ],
        )
        return True
