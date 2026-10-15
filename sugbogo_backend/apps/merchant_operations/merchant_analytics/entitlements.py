"""Server-side Plus access with explicit preview and demo-only grant modes."""

from django.conf import settings

from .models import DemoMerchantPlusEntitlement


def demo_plus_access_source(*, has_mock_grant):
    """Resolve effective access without treating a stored demo grant as a paid subscription."""
    if not settings.MERCHANT_PLUS_ENFORCED:
        return "preview"
    if settings.MERCHANT_PLUS_MOCK_ENABLED and has_mock_grant:
        return "mock"
    return "none"


def merchant_has_plus_access(user):
    """Keep preview access and consult demo grants only under explicit mock enforcement."""
    if not settings.MERCHANT_PLUS_ENFORCED:
        return True
    if not settings.MERCHANT_PLUS_MOCK_ENABLED:
        # Ralph: future real entitlements belong here; demo grants never confer paid access.
        return False
    if not user or not user.is_authenticated:
        return False
    has_grant = DemoMerchantPlusEntitlement.objects.filter(
        BUSN_ID__USER_ID=user, DMPE_IS_ACTIVE=True,
    ).exists()
    return demo_plus_access_source(has_mock_grant=has_grant) != "none"
