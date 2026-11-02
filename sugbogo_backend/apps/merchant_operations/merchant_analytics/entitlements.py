"""Server-side Plus access with explicit preview and demo-only grant modes."""

from django.conf import settings

from apps.payments.services.payment_service import PaymentService
from apps.users.models import User

from .models import DemoMerchantPlusEntitlement


def demo_plus_access_source(*, has_mock_grant):
    """Resolve effective access without treating a stored demo grant as a paid subscription."""
    if not settings.MERCHANT_PLUS_ENFORCED:
        return "preview"
    if settings.MERCHANT_PLUS_MOCK_ENABLED and has_mock_grant:
        return "mock"
    return "none"


def merchant_has_plus_access(user):
    """Resolve valid paid access separately from existing preview and mock grants."""
    if (
        not user
        or not user.is_authenticated
        or not user.is_active
        or user.USER_ROLE != User.UserRole.MERCHANT
    ):
        return False
    if PaymentService.get_active_paid_entitlement(user) is not None:
        return True
    if not settings.MERCHANT_PLUS_ENFORCED:
        return True
    if not settings.MERCHANT_PLUS_MOCK_ENABLED:
        return False
    has_grant = DemoMerchantPlusEntitlement.objects.filter(
        BUSN_ID__USER_ID=user, DMPE_IS_ACTIVE=True,
    ).exists()
    return demo_plus_access_source(has_mock_grant=has_grant) != "none"
