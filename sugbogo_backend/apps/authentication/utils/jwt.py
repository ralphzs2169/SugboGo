from rest_framework_simplejwt.tokens import RefreshToken
from datetime import timedelta
from django.db import transaction
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
from rest_framework_simplejwt.utils import datetime_from_epoch

REMEMBER_ME_OFF_LIFETIME = timedelta(hours=12)


@transaction.atomic
def issue_tokens(user, remember_me: bool):
    """
    Issues an access + refresh token pair for a user.
    If remember_me is False, the refresh token's lifetime is shortened
    from the SIMPLE_JWT default (30 days) down to 12 hours.
    """
    refresh = RefreshToken.for_user(user)

    if not remember_me:
        refresh.set_exp(lifetime=REMEMBER_ME_OFF_LIFETIME)

    # for_user registers the token before its optional shorter lifetime is set.
    OutstandingToken.objects.filter(jti=refresh[api_settings.JTI_CLAIM]).update(
        token=str(refresh),
        expires_at=datetime_from_epoch(refresh["exp"]),
    )

    access = refresh.access_token
    access["exp"] = min(access["exp"], refresh["exp"])
    return {
        "refresh": str(refresh),
        "access": str(access),
    }
