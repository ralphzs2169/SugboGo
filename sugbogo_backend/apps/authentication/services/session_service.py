from rest_framework_simplejwt.token_blacklist.models import (
    OutstandingToken,
    BlacklistedToken,
)

from apps.users.models import User


class SessionService:
    """Service for managing user authentication sessions."""

    @staticmethod
    def revoke_all_sessions(user: User) -> None:
        """
        Revokes all active sessions for a given user by blacklisting their outstanding tokens.
        """

        outstanding_tokens = OutstandingToken.objects.filter(user=user)

        for token in outstanding_tokens:
            BlacklistedToken.objects.get_or_create(token=token)