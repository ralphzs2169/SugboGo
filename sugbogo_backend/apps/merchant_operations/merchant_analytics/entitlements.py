"""Single server-side integration point for future Merchant Plus entitlements."""

from django.conf import settings


def merchant_has_plus_access(user):
    """Allow development access with enforcement off and otherwise fail closed."""
    if not settings.MERCHANT_PLUS_ENFORCED:
        return True
    # Ralph: replace this return with the approved entitlement lookup, not UI state.
    # No subscription/payment model exists yet; enforcement currently denies all Plus access.
    return False
