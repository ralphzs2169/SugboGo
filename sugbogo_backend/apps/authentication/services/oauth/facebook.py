import requests

from django.conf import settings

from .base import OAuthUser


class FacebookAuthError(Exception):
    """
    Raised when Facebook authentication fails.
    """


class FacebookOAuthService:
    """
    Handles Facebook OAuth access token verification.

    Responsibilities:
    - Verify the access token belongs to this application.
    - Retrieve the authenticated user's profile.
    - Convert it into OAuthUser.
    """

    @staticmethod
    def _get_payload(url: str, params: dict) -> dict:
        """Separate provider outages from rejected or malformed identities."""
        response = requests.get(url, params=params, timeout=10)
        try:
            response.raise_for_status()
        except requests.HTTPError as exc:
            if 400 <= response.status_code < 500:
                raise FacebookAuthError from exc
            raise

        try:
            payload = response.json()
        except ValueError as exc:
            raise FacebookAuthError from exc
        if not isinstance(payload, dict):
            raise FacebookAuthError
        return payload

    @staticmethod
    def verify_access_token(token: str) -> OAuthUser:
        """
        Verifies a Facebook access token and returns the authenticated user.
        """

        # Verify that the access token is valid and was issued
        # for this Facebook application.
        debug_payload = FacebookOAuthService._get_payload(
            "https://graph.facebook.com/debug_token",
            params={
                "input_token": token,
                "access_token": (
                    f"{settings.FACEBOOK_APP_ID}|"
                    f"{settings.FACEBOOK_APP_SECRET}"
                ),
            },
        )

        payload = debug_payload.get("data")
        if not isinstance(payload, dict):
            raise FacebookAuthError

        # Reject invalid access tokens.
        if not payload.get("is_valid"):
            raise FacebookAuthError

        # Ensure the token belongs to this application.
        if payload.get("app_id") != settings.FACEBOOK_APP_ID:
            raise FacebookAuthError

        # Retrieve the authenticated user's Facebook profile.
        profile = FacebookOAuthService._get_payload(
            "https://graph.facebook.com/me",
            params={
                "fields": "id,email,first_name,last_name,picture.type(large)",
                "access_token": token,
            },
        )

        # SugboGo requires an email address to identify users.
        email = profile.get("email")

        if not email or not profile.get("id"):
            raise FacebookAuthError

        picture = profile.get("picture")
        picture_data = picture.get("data") if isinstance(picture, dict) else None

        return OAuthUser(
            provider="facebook",
            provider_id=profile["id"],
            email=email,
            first_name=profile.get("first_name", ""),
            last_name=profile.get("last_name", ""),
            avatar_url=(
                picture_data.get("url")
                if isinstance(picture_data, dict)
                else None
            ),
        )
