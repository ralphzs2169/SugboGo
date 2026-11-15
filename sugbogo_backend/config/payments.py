"""Validate payment environment and Maya Sandbox configuration."""

from urllib.parse import urlsplit

from django.core.exceptions import ImproperlyConfigured


MAYA_SANDBOX_API_BASE_URL = "https://pg-sandbox.paymaya.com"


def is_maya_api_key(
    key,
    prefix,
):
    """Validate the credential shape without including its value in errors."""
    return (
        isinstance(key, str)
        and key.startswith(prefix)
        and len(key) > len(prefix)
        and ":" not in key
        and not any(character.isspace() or not character.isprintable() for character in key)
        and key.isascii()
    )


def parse_maya_return_url(
    value,
    *,
    allow_query=False,
):
    """Validate a server-owned HTTPS return URL and return its parsed components."""
    try:
        url = urlsplit(value)
        url.port
        if (
            url.scheme == "https"
            and bool(url.hostname)
            and url.username is None
            and url.password is None
            and not url.netloc.endswith(":")
            and not any(character in value for character in "#\\")
            and (allow_query or "?" not in value)
            and not any(character.isspace() or not character.isprintable() for character in value)
        ):
            return url
    except (TypeError, ValueError):
        pass
    raise ImproperlyConfigured(
        "MAYA_RETURN_BASE_URL must be an HTTPS URL without credentials, a query, or a fragment.",
    )


def load_payment_configuration(
    environment,
    *,
    plus_enforced,
    mock_enabled,
):
    """Load backend-owned settings for the enabled checkout environment."""
    provider = environment.get("PAYMENT_PROVIDER", "maya").strip().lower()
    if provider not in {"maya", "paymongo"}:
        raise ImproperlyConfigured("PAYMENT_PROVIDER must be maya or paymongo.")
    mode = environment.get("PAYMENT_MODE", "test").strip().lower()
    if mode not in {"test", "live"}:
        raise ImproperlyConfigured("PAYMENT_MODE must be test or live.")
    if (
        provider == "maya"
        and mode != "test"
    ):
        raise ImproperlyConfigured("Maya Checkout requires PAYMENT_MODE=test.")

    enabled_value = environment.get("MAYA_CHECKOUT_ENABLED", "False").strip().lower()
    if enabled_value not in {"true", "false"}:
        raise ImproperlyConfigured("MAYA_CHECKOUT_ENABLED must be True or False.")
    enabled = enabled_value == "true"
    configuration = {
        "PAYMENT_PROVIDER": provider,
        "PAYMENT_MODE": mode,
        "MAYA_CHECKOUT_ENABLED": enabled,
        "MAYA_SANDBOX_API_BASE_URL": MAYA_SANDBOX_API_BASE_URL,
        "MAYA_SANDBOX_PUBLIC_KEY": environment.get("MAYA_SANDBOX_PUBLIC_KEY", "").strip(),
        "MAYA_SANDBOX_SECRET_KEY": environment.get("MAYA_SANDBOX_SECRET_KEY", "").strip(),
        "MAYA_RETURN_BASE_URL": environment.get("MAYA_RETURN_BASE_URL", "").strip(),
    }
    if not enabled:
        return configuration
    if provider != "maya":
        raise ImproperlyConfigured("Enabled Maya settings require PAYMENT_PROVIDER=maya.")
    if (
        not plus_enforced
        or mock_enabled
    ):
        raise ImproperlyConfigured(
            "Enabled checkout settings require Plus enforcement and disabled mock access.",
        )
    for name, prefix in (
        ("MAYA_SANDBOX_PUBLIC_KEY", "pk-"),
        ("MAYA_SANDBOX_SECRET_KEY", "sk-"),
    ):
        key = configuration[name]
        if not is_maya_api_key(key, prefix):
            raise ImproperlyConfigured(f"{name} must contain a Maya Sandbox API key.")

    parse_maya_return_url(configuration["MAYA_RETURN_BASE_URL"])
    return configuration
