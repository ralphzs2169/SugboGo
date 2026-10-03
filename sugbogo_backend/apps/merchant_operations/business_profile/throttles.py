"""Rate limiting and observable allowance for merchant cover-photo changes."""

from datetime import datetime, timezone
from math import ceil

from django.core.cache import cache
from rest_framework.throttling import SimpleRateThrottle


class BusinessCoverPhotoThrottle(SimpleRateThrottle):
    """Throttle cover photo changes for merchant businesses."""

    scope = "business_cover_photo_update"

    def get_cache_key(self, request, view):
        """Use the authenticated merchant's user ID as the throttle key."""
        if not request.user or not request.user.is_authenticated:
            return None

        return self.cache_format % {
            "scope": self.scope,
            "ident": request.user.pk,
        }

    @classmethod
    def get_allowance(cls, user):
        """Read the rolling request history used by DRF to enforce PATCH."""
        throttle = cls()
        allowance = {
            "limit": throttle.num_requests,
            "remaining": throttle.num_requests,
            "resets_at": None,
        }

        if not user or not user.is_authenticated:
            return allowance

        key = throttle.cache_format % {
            "scope": cls.scope,
            "ident": user.pk,
        }
        history = cache.get(key)

        if not history:
            return allowance

        now = throttle.timer()
        active_history = [
            timestamp
            for timestamp in history
            if timestamp > now - throttle.duration
        ]

        if not active_history:
            return allowance

        oldest_request = active_history[-1]
        allowance["remaining"] = max(
            0,
            throttle.num_requests - len(active_history),
        )
        allowance["resets_at"] = datetime.fromtimestamp(
            oldest_request + throttle.duration,
            tz=timezone.utc,
        )

        return allowance

    @classmethod
    def get_retry_after(cls, user):
        """Return seconds until the oldest request leaves the rolling window."""
        allowance = cls.get_allowance(user)

        if allowance["remaining"] > 0 or allowance["resets_at"] is None:
            return None

        throttle = cls()
        return max(
            0,
            ceil(
                allowance["resets_at"].timestamp() - throttle.timer()
            ),
        )
