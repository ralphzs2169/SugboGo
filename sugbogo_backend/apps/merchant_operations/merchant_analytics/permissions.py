"""Premium permission scaffolding; Standard views must not use this permission."""

from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission

from . import entitlements


class MerchantPlusRequired(PermissionDenied):
    """Preserve PLUS_REQUIRED through the existing global exception envelope."""

    default_detail = "Merchant Plus is required to access this feature."
    default_code = "plus_required"


class HasMerchantPlus(BasePermission):
    """Require server-side entitlement in addition to auth, role and ownership checks."""

    def has_permission(self, request, view):
        """Reject missing authentication and raise the dedicated Plus error when denied."""
        if not request.user or not request.user.is_authenticated:
            return False
        if not entitlements.merchant_has_plus_access(request.user):
            raise MerchantPlusRequired()
        return True
