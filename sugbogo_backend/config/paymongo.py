"""Parse payment settings without loading credentials into application clients."""

from urllib.parse import urlsplit

from django.core.exceptions import ImproperlyConfigured


def load_paymongo_configuration(
    environment,
    *,
    plus_enforced,
    mock_enabled,
):
    """Validate enabled checkout while allowing credential-free foundation work."""
    enabled_value = environment.get("PAYMONGO_CHECKOUT_ENABLED", "False").strip().lower()
    if enabled_value not in {"true", "false"}:
        raise ImproperlyConfigured("PAYMONGO_CHECKOUT_ENABLED must be True or False.")
    mode = environment.get("PAYMONGO_MODE", "test").strip().lower()
    if mode not in {"test", "live"}:
        raise ImproperlyConfigured("PAYMONGO_MODE must be test or live.")
    methods = tuple(
        value.strip()
        for value in environment.get("PAYMONGO_PAYMENT_METHOD_TYPES", "gcash").split(",")
        if value.strip()
    )
    if (
        not methods
        or len(methods) != len(set(methods))
        or not set(methods).issubset({"card", "gcash", "paymaya", "qrph"})
    ):
        raise ImproperlyConfigured(
            "PAYMONGO_PAYMENT_METHOD_TYPES must contain unique supported methods.",
        )
    configuration = {
        "PAYMONGO_CHECKOUT_ENABLED": enabled_value == "true",
        "PAYMONGO_MODE": mode,
        "PAYMONGO_RETURN_BASE_URL": environment.get("PAYMONGO_RETURN_BASE_URL", "").strip(),
        "PAYMONGO_PAYMENT_METHOD_TYPES": methods,
    }
    for prefix in ("TEST", "LIVE"):
        for suffix in ("SECRET_KEY", "WEBHOOK_SECRET"):
            name = f"PAYMONGO_{prefix}_{suffix}"
            configuration[name] = environment.get(name, "").strip()
    if not configuration["PAYMONGO_CHECKOUT_ENABLED"]:
        return configuration
    if (
        not plus_enforced
        or mock_enabled
    ):
        raise ImproperlyConfigured(
            "Enabled checkout requires Plus enforcement and disabled mock access.",
        )
    for prefix in ("TEST", "LIVE"):
        name = f"PAYMONGO_{prefix}_SECRET_KEY"
        key = configuration[name]
        if (
            key
            and not key.startswith(f"sk_{prefix.lower()}_")
        ):
            raise ImproperlyConfigured(f"{name} must match its payment mode.")
    for suffix in ("SECRET_KEY", "WEBHOOK_SECRET"):
        name = f"PAYMONGO_{mode.upper()}_{suffix}"
        if not configuration[name]:
            raise ImproperlyConfigured(f"{name} is required when checkout is enabled.")
    try:
        url = urlsplit(configuration["PAYMONGO_RETURN_BASE_URL"])
        valid_url = (
            url.scheme == "https"
            and bool(url.hostname)
            and not url.username
            and not url.password
            and not url.query
            and not url.fragment
        )
        url.port
    except ValueError:
        valid_url = False
    if not valid_url:
        raise ImproperlyConfigured(
            "PAYMONGO_RETURN_BASE_URL must be an HTTPS URL without credentials or query data.",
        )
    return configuration
