from django.db import transaction
from rest_framework_simplejwt.token_blacklist.models import (
    OutstandingToken,
    BlacklistedToken,
)

from apps.authentication.models import OAuthAccount
from apps.users.models import User
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken


class SessionService:
    """Service for managing user authentication sessions."""

    @staticmethod
    @transaction.atomic
    def revoke_refresh_token(raw_token: str) -> None:
        """Blacklists a refresh token under the same account lock as rotation."""
        refresh = RefreshToken(raw_token)
        try:
            User.objects.select_for_update().get(
                pk=refresh.get(api_settings.USER_ID_CLAIM),
            )
        except (User.DoesNotExist, ValueError, TypeError, OverflowError) as exc:
            raise TokenError("The session account is unavailable.") from exc
        refresh = RefreshToken(raw_token)
        refresh.blacklist()

    @staticmethod
    @transaction.atomic
    def revoke_all_sessions(
        user: User,
        *,
        revoke_oauth_links: bool = False,
    ) -> None:
        """Blacklists refresh tokens and optionally removes external sign-in credentials."""

        # Share the account lock used by refresh rotation and password changes.
        User.objects.select_for_update().get(pk=user.pk)
        if revoke_oauth_links:
            OAuthAccount.objects.filter(USER=user).delete()

        outstanding_tokens = OutstandingToken.objects.filter(user=user)

        for token in outstanding_tokens:
            BlacklistedToken.objects.get_or_create(token=token)
