from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.utils import get_md5_hash_password

from apps.users.models import User


class SessionRefreshSerializer(serializers.Serializer):
    """Rotates refresh tokens without extending the original absolute session deadline."""

    refresh = serializers.CharField()
    access = serializers.CharField(read_only=True)

    @transaction.atomic
    def validate(self, attrs):
        """Rechecks the locked account and returns a pair bounded by the submitted expiry."""
        refresh = RefreshToken(attrs["refresh"])
        try:
            user = User.objects.select_for_update().get(
                pk=refresh.get(api_settings.USER_ID_CLAIM),
            )
        except (User.DoesNotExist, ValueError, TypeError, OverflowError) as exc:
            raise InvalidToken("The session account is no longer available.") from exc

        # Recheck after the user lock so concurrent rotation/revocation cannot reuse it.
        refresh = RefreshToken(attrs["refresh"])
        if not user.is_active or not user.EMAIL_VERIFIED:
            raise InvalidToken("The session account is no longer active or verified.")
        if api_settings.CHECK_REVOKE_TOKEN and refresh.get(
            api_settings.REVOKE_TOKEN_CLAIM,
        ) != get_md5_hash_password(user.password):
            raise InvalidToken("The password has changed. Please sign in again.")

        access = refresh.access_token
        access["exp"] = min(access["exp"], refresh["exp"])
        data = {"access": str(access)}
        if api_settings.ROTATE_REFRESH_TOKENS:
            if api_settings.BLACKLIST_AFTER_ROTATION:
                refresh.blacklist()
            refresh.set_jti()
            refresh.set_iat()
            # Keep exp unchanged; rotation changes the token, not the session duration.
            refresh.outstand()
            data["refresh"] = str(refresh)
        return data
