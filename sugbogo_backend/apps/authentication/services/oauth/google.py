from google.auth.transport import requests
from google.oauth2 import id_token

from django.conf import settings

from .base import OAuthUser


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
        payload = id_token.verify_oauth2_token(
            token,
            requests.Request(),
            settings.GOOGLE_OAUTH_CLIENT_ID,
        )
        print(payload)
        return OAuthUser(
            provider="google",
            provider_id=payload["sub"],
            email=payload["email"],
            first_name=payload.get("given_name", ""),
            last_name=payload.get("family_name", ""),
            avatar_url=payload.get("picture", ""),
        )