from dataclasses import dataclass


@dataclass
class OAuthUser:
    """
    Standardized user information returned by any OAuth provider.

    Every provider (Google, Facebook, Apple) should convert its
    response into this model before passing it to the rest of the
    authentication system.
    """

    provider: str
    provider_id: str
    email: str
    first_name: str
    last_name: str
    avatar_url: str | None = None