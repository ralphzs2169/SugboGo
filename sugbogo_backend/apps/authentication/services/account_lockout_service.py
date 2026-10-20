from datetime import timedelta
from math import ceil

from django.conf import settings
from django.utils import timezone

from core.responses import error_response


class AccountLockoutService:
    """Maintains temporary password restrictions under the owning user row lock."""

    fields = [
        "USER_LOGIN_FAILURE_COUNT",
        "USER_LOGIN_WINDOW_STARTED_AT",
        "USER_PASSWORD_LOCKED_UNTIL",
    ]

    @staticmethod
    def clear(account):
        """Clears failure state after authenticated recovery or completed sign-in."""
        account.USER_LOGIN_FAILURE_COUNT = 0
        account.USER_LOGIN_WINDOW_STARTED_AT = None
        account.USER_PASSWORD_LOCKED_UNTIL = None
        account.save(update_fields=AccountLockoutService.fields)

    @staticmethod
    def prepare(account, now):
        """Expires an old lock or observation window without extending active locks."""
        if account.USER_PASSWORD_LOCKED_UNTIL:
            if account.USER_PASSWORD_LOCKED_UNTIL <= now:
                AccountLockoutService.clear(account)
            return
        started = account.USER_LOGIN_WINDOW_STARTED_AT
        if started and started + timedelta(seconds=settings.LOGIN_LOCKOUT_WINDOW_SECONDS) <= now:
            AccountLockoutService.clear(account)

    @staticmethod
    def failure(account, now):
        """Counts one incorrect password in the current fixed observation window."""
        if account.USER_LOGIN_WINDOW_STARTED_AT is None:
            account.USER_LOGIN_WINDOW_STARTED_AT = now
        account.USER_LOGIN_FAILURE_COUNT += 1
        if account.USER_LOGIN_FAILURE_COUNT >= settings.LOGIN_LOCKOUT_THRESHOLD:
            account.USER_PASSWORD_LOCKED_UNTIL = now + timedelta(
                seconds=settings.LOGIN_LOCKOUT_DURATION_SECONDS,
            )
        account.save(update_fields=AccountLockoutService.fields)

    @staticmethod
    def response(account, now=None):
        """Returns a recoverable restriction with a bounded, server-owned retry delay."""
        now = now or timezone.now()
        until = account.USER_PASSWORD_LOCKED_UNTIL
        if until is None or until <= now:
            return None
        seconds = max(1, ceil((until - now).total_seconds()))
        response = error_response(
            message="Password sign-in is temporarily unavailable. Try again later or use Forgot Password.",
            code="ACCOUNT_LOCKED",
            errors={"retry_after": seconds},
            status_code=429,
        )
        response["Retry-After"] = str(seconds)
        return response
