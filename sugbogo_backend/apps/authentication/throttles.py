from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle, UserRateThrottle


class EmailChangeRequestThrottle(UserRateThrottle):
    """Limits verification delivery and password attempts per signed-in account."""

    scope = "email_change"


class EmailChangeConfirmThrottle(SimpleRateThrottle):
    """Limits password attempts for a pending email change across client addresses."""

    scope = "email_change_confirm"

    def get_cache_key(self, request, view):
        """Keys confirmation attempts by the bounded request identifier."""
        ident = str(request.data.get("request_id", ""))[:36]
        return self.cache_format % {"scope": self.scope, "ident": ident}


class LoginThrottle(AnonRateThrottle):
    """Throttle login attempts from anonymous users."""

    scope = "login"

class OAuthLoginThrottle(AnonRateThrottle):
    """Throttle OAuth login attempts."""

    scope = "oauth_login"


class RegisterThrottle(AnonRateThrottle):
    """Throttle account registration attempts."""

    scope = "register"
    
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
    
    
class ForgotPasswordThrottle(AnonRateThrottle):
    """Throttle forgot password requests from anonymous users."""
    scope = "forgot_password"
