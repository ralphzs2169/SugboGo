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
    def get_retry_after(cls, user):
        """Return remaining throttle time when the limit is exhausted."""

        if not user or not user.is_authenticated:
            return None

        throttle = cls()

        key = throttle.cache_format % {
            "scope": cls.scope,
            "ident": user.pk,
        }

        history = cache.get(key)

        if not history:
            return None

        now = throttle.timer()

        history = [
            timestamp
            for timestamp in history
            if timestamp > now - throttle.duration
        ]

        if len(history) < throttle.num_requests:
            return None

        oldest_request = history[-1]

        retry_after = throttle.duration - (
            now - oldest_request
        )

        return max(0, int(retry_after))