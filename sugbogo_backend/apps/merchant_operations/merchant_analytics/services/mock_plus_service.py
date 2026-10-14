"""Reversible demo grants without payment collection or external provider side effects."""

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.business.models import Business
from apps.merchant_operations.business_profile.services.business_profile_service import BusinessProfileService

from ..entitlements import demo_plus_access_source
from ..models import DemoMerchantPlusEntitlement
from .premium_common import owned_business_data


class MockPlusDisabled(PermissionDenied):
    """Return the existing error envelope with an explicit disabled-simulation code."""

    default_detail = "Mock Merchant Plus activation is disabled."
    default_code = "mock_plus_disabled"


class MockPlusService:
    """Operate only the authenticated merchant's demo access, separate from listing eligibility."""

    @staticmethod
    def require_mock_enabled():
        """Reject demo mutations before any domain lookup when mock mode is disabled."""
        if not settings.MERCHANT_PLUS_MOCK_ENABLED:
            raise MockPlusDisabled()

    @staticmethod
    def build_status(business, entitlement):
        """Distinguish stored state from effective access using the same gate policy."""
        active = bool(entitlement and entitlement.DMPE_IS_ACTIVE)
        source = demo_plus_access_source(has_mock_grant=active)
        return {
            "business": owned_business_data(business),
            "stored_demo_state": "active" if active else "inactive" if entitlement else "not_created",
            "effective_tier": "plus" if source != "none" else "standard",
            "has_plus_access": source != "none", "access_source": source,
            "enforcement_enabled": settings.MERCHANT_PLUS_ENFORCED,
            "mock_enabled": settings.MERCHANT_PLUS_MOCK_ENABLED,
            "is_simulation": True,
            "activated_at": entitlement.DMPE_ACTIVATED_AT if entitlement else None,
            "reset_at": entitlement.DMPE_RESET_AT if entitlement else None,
            "updated_at": entitlement.DMPE_UPDATED_AT if entitlement else None,
        }

    @classmethod
    def get_status(cls, user):
        """Read the caller's stored demo state without creating or refreshing a grant."""
        business = BusinessProfileService.get_business_for_merchant(user)
        entitlement = DemoMerchantPlusEntitlement.objects.filter(BUSN_ID=business).first()
        return cls.build_status(business, entitlement)

    @staticmethod
    def locked_business(user):
        """Serialize mutations on the owned business even before an entitlement row exists."""
        business = BusinessProfileService.get_business_for_merchant(user)
        try:
            return Business.objects.select_for_update().get(pk=business.pk, USER_ID=user)
        except Business.DoesNotExist:
            raise NotFound("The business could not be found.") from None

    @classmethod
    @transaction.atomic
    def activate(cls, user, outcome):
        """Grant once for simulated success while failed/cancelled attempts leave state untouched."""
        cls.require_mock_enabled()
        if outcome not in {"success", "failure", "cancelled"}:
            raise ValidationError({"outcome": "Choose success, failure, or cancelled."})
        business = cls.locked_business(user)
        entitlement = DemoMerchantPlusEntitlement.objects.filter(BUSN_ID=business).first()
        changed = False
        if outcome == "success":
            if entitlement is None:
                entitlement = DemoMerchantPlusEntitlement(BUSN_ID=business)
            if not entitlement.DMPE_IS_ACTIVE:
                entitlement.DMPE_IS_ACTIVE = True
                entitlement.DMPE_ACTIVATED_AT = timezone.now()
                if entitlement.pk is None:
                    entitlement.save()
                else:
                    entitlement.save(update_fields=["DMPE_IS_ACTIVE", "DMPE_ACTIVATED_AT", "DMPE_UPDATED_AT"])
                changed = True
        return {"outcome": outcome, "changed": changed, "status": cls.build_status(business, entitlement)}

    @classmethod
    @transaction.atomic
    def reset(cls, user):
        """Revoke an active demo grant idempotently without creating rows for absent grants."""
        cls.require_mock_enabled()
        business = cls.locked_business(user)
        entitlement = DemoMerchantPlusEntitlement.objects.filter(BUSN_ID=business).first()
        changed = bool(entitlement and entitlement.DMPE_IS_ACTIVE)
        if changed:
            entitlement.DMPE_IS_ACTIVE = False
            entitlement.DMPE_RESET_AT = timezone.now()
            entitlement.save(update_fields=["DMPE_IS_ACTIVE", "DMPE_RESET_AT", "DMPE_UPDATED_AT"])
        return {"outcome": "reset", "changed": changed, "status": cls.build_status(business, entitlement)}
