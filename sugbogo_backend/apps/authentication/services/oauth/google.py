from google.auth.transport import requests
from google.oauth2 import id_token

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import validate_email

from .base import OAuthUser


class GoogleOAuthConfigurationError(Exception):
    """Reject Google login when its expected audience is not configured."""


class GoogleOAuthService:
    """
    Handles Google OAuth token verification.

    Responsibilities:
    - Verify Google's ID token
    - Extract user information
    - Convert it into OAuthUser
    """

    @staticmethod
    def verify_id_token(token: str) -> OAuthUser:
        """Verify the audience and identity claims before resolving an account."""
        audience = getattr(settings, "GOOGLE_OAUTH_CLIENT_ID", None)
        if (
            not isinstance(audience, str)
            or not audience.strip()
        ):
            raise GoogleOAuthConfigurationError

        payload = id_token.verify_oauth2_token(
            token,
            requests.Request(),
            audience=audience.strip(),
        )
        if not isinstance(payload, dict):
            raise ValueError("Google did not return a usable account identity.")

        subject = payload.get("sub")
        email = payload.get("email")
        if (
            not isinstance(subject, str)
            or not subject.strip()
            or subject != subject.strip()
            or len(subject) > 255
            or not subject.isascii()
            or not isinstance(email, str)
            or email != email.strip()
            or len(email) > 100
        ):
            raise ValueError("Google did not return a usable account identity.")
        try:
            validate_email(email)
        except ValidationError as exc:
            raise ValueError("Google did not return a usable account identity.") from exc

        # Google's OpenID documentation also shows the literal string "true".
        email_verified = payload.get("email_verified")
        if not (
            email_verified is True
            or email_verified == "true"
        ):
            raise ValueError("Google did not return a verified email address.")

        # Third-party email ownership may change after Google's initial verification.
        hosted_domain = payload.get("hd")
        email_authoritative = (
            email.lower().endswith("@gmail.com")
            or (
                isinstance(hosted_domain, str)
                and bool(hosted_domain.strip())
            )
        )

        return OAuthUser(
            provider="google",
            provider_id=subject,
            email=email,
            first_name=payload.get("given_name", ""),
            last_name=payload.get("family_name", ""),
            avatar_url=payload.get("picture", ""),
            email_authoritative=email_authoritative,
        )
