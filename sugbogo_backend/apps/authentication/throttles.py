from rest_framework.throttling import SimpleRateThrottle


class ResendVerificationThrottle(SimpleRateThrottle):
    """
    Rate limits resend verification requests by email address.
    """

    scope = "resend_verification"

    def get_cache_key(self, request, view):
        email = request.data.get("email")

        if not email:
            return None

        return self.cache_format % {
            "scope": self.scope,
            "ident": email.lower().strip(),
        }