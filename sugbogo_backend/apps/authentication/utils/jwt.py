from rest_framework_simplejwt.tokens import RefreshToken
from datetime import timedelta
from django.db import transaction
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
from rest_framework_simplejwt.utils import datetime_from_epoch
from rest_framework.exceptions import PermissionDenied

from apps.users.models import User
from apps.authentication.models import LoginEvent
from apps.authentication.services.login_history_service import LoginHistoryService
from django.utils import timezone

REMEMBER_ME_OFF_LIFETIME = timedelta(hours=12)


@transaction.atomic
def issue_tokens(user, remember_me: bool, *, request=None, method=None):
    """
    Issues an access + refresh token pair for a user.
    If remember_me is False, the refresh token's lifetime is shortened
    from the SIMPLE_JWT default (30 days) down to 12 hours.
    """
    try:
        account = User.objects.select_for_update().get(pk=user.pk)
    except User.DoesNotExist as exc:
        raise PermissionDenied("This account is no longer available.") from exc
    if (
        not account.is_active
        or not account.EMAIL_VERIFIED
        or account.password != user.password
    ):
        raise PermissionDenied("This account has changed. Please sign in again.")
    refresh = RefreshToken.for_user(account)

    if not remember_me:
        refresh.set_exp(lifetime=REMEMBER_ME_OFF_LIFETIME)

    # for_user registers the token before its optional shorter lifetime is set.
    OutstandingToken.objects.filter(jti=refresh[api_settings.JTI_CLAIM]).update(
        token=str(refresh),
        expires_at=datetime_from_epoch(refresh["exp"]),
    )

    access = refresh.access_token
    access["exp"] = min(access["exp"], refresh["exp"])
    if request is not None:
        account.last_login = timezone.now()
        account.save(update_fields=["last_login"])
        LoginHistoryService.record(
            request=request, method=method, user=account,
            outcome=LoginEvent.Outcome.SUCCESS,
        )
    return {
        "refresh": str(refresh),
        "access": str(access),
    }
