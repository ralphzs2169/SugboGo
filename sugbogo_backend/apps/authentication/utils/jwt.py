from rest_framework_simplejwt.tokens import RefreshToken
from datetime import timedelta

REMEMBER_ME_OFF_LIFETIME = timedelta(hours=12)


def issue_tokens(user, remember_me: bool):
    """
    Issues an access + refresh token pair for a user.
    If remember_me is False, the refresh token's lifetime is shortened
    from the SIMPLE_JWT default (30 days) down to 12 hours.
    """
    refresh = RefreshToken.for_user(user)

    if not remember_me:
        refresh.set_exp(lifetime=REMEMBER_ME_OFF_LIFETIME)

    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }