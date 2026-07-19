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
    def verify_access_token(token: str) -> OAuthUser:
        """
        Verifies a Facebook access token and returns the authenticated user.

        This method:
        1. Confirms the token is valid and belongs to this app.
        2. Retrieves the user's Facebook profile.
        3. Converts the profile into an OAuthUser.
        """

        # Verify that the access token is valid and was issued
        # for this Facebook application.
        debug_response = requests.get(
            "https://graph.facebook.com/debug_token",
            params={
                "input_token": token,
                "access_token": (
                    f"{settings.FACEBOOK_APP_ID}|"
                    f"{settings.FACEBOOK_APP_SECRET}"
                ),
            },
            timeout=10,
        )

        try:
            debug_response.raise_for_status()
        except requests.RequestException as exc:
            raise FacebookAuthError from exc

        payload = debug_response.json()["data"]

        # Reject invalid access tokens.
        if not payload.get("is_valid"):
            raise FacebookAuthError

        # Ensure the token belongs to this application.
        if payload.get("app_id") != settings.FACEBOOK_APP_ID:
            raise FacebookAuthError

        # Retrieve the authenticated user's Facebook profile.
        profile_response = requests.get(
            "https://graph.facebook.com/me",
            params={
                "fields": "id,email,first_name,last_name",
                "access_token": token,
            },
            timeout=10,
        )

        try:
            profile_response.raise_for_status()
        except requests.RequestException as exc:
            raise FacebookAuthError from exc

        profile = profile_response.json()

        # SugboGo requires an email address to identify users.
        email = profile.get("email")

        if not email:
            raise FacebookAuthError

        return OAuthUser(
            provider="facebook",
            provider_id=profile["id"],
            email=email,
            first_name=profile.get("first_name", ""),
            last_name=profile.get("last_name", ""),
        )