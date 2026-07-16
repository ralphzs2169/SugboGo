from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import (
    urlsafe_base64_encode,
    urlsafe_base64_decode,
)
from apps.users.models import User
import logging

logger = logging.getLogger(__name__)


class EmailVerificationService:
    """Service for generating and validating email verification tokens."""

    @staticmethod
    def generate_verification_link(user: User) -> str:
        """
        Generate an email verification link for a user.

        Args:
            user: The user to generate a verification link for.

        Returns:
            A signed verification URL containing the user's encoded ID and token.
        """
        uid = urlsafe_base64_encode(force_bytes(user.pk))

        token = default_token_generator.make_token(user)

        return (
            f"{settings.EMAIL_VERIFICATION_URL}"
            f"?uid={uid}&token={token}"
        )


    @staticmethod
    def verify_token(uid: str, token: str) -> User | None:
        """
        Validate an email verification token.

        Args:
            uid: Base64 encoded user ID.
            token: Verification token.

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
                "Invalid email verification attempt: %s",
                exc,
            )
            return None

        if default_token_generator.check_token(
            user,
            token,
        ):
            return user

        return None