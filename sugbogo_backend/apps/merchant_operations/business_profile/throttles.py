from rest_framework.throttling import SimpleRateThrottle


class BusinessCoverPhotoThrottle(SimpleRateThrottle):
    """Throttle cover photo changes for merchant businesses."""

    scope = "business_cover_photo_update"

    # Override the get_cache_key method to use the authenticated user's ID as the cache key.
    def get_cache_key(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return None

        return self.cache_format % {
            "scope": self.scope,
            "ident": request.user.pk,
        }