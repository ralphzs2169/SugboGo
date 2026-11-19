"""Server-side Plus access with paid entitlements and preview access."""

from django.conf import settings

from apps.payments.services.payment_service import PaymentService
from apps.users.models import User


def merchant_has_plus_access(user):
    """Allow an active merchant with paid or preview access."""
    if (
        not user
        or not user.is_authenticated
        or not user.is_active
        or user.USER_ROLE != User.UserRole.MERCHANT
    ):
        return False
    if PaymentService.get_active_paid_entitlement(user) is not None:
        return True
    return not settings.MERCHANT_PLUS_ENFORCED
