"""Validate payment environment and staged Maya Sandbox configuration."""

from urllib.parse import urlsplit

from django.core.exceptions import ImproperlyConfigured


def load_payment_configuration(
    environment,
    *,
    plus_enforced,
    mock_enabled,
):
    """Load backend-owned provider settings while keeping gateway I/O disabled in M2."""
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
        "MAYA_SANDBOX_API_BASE_URL": "https://pg-sandbox.paymaya.com",
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
        if (
            not key.startswith(prefix)
            or len(key) == len(prefix)
            or ":" in key
            or any(character.isspace() for character in key)
        ):
            raise ImproperlyConfigured(f"{name} must contain a Maya Sandbox API key.")

    base_url = configuration["MAYA_RETURN_BASE_URL"]
    try:
        url = urlsplit(base_url)
        valid_url = (
            url.scheme == "https"
            and bool(url.hostname)
            and url.username is None
            and url.password is None
            and not url.netloc.endswith(":")
            and not any(character in base_url for character in "?#\\")
            and not any(character.isspace() for character in base_url)
        )
        url.port
    except ValueError:
        valid_url = False
    if not valid_url:
        raise ImproperlyConfigured(
            "MAYA_RETURN_BASE_URL must be an HTTPS URL without credentials, a query, or a fragment.",
        )
    return configuration
