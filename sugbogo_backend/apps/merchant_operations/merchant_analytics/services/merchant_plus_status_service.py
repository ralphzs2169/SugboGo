"""Read paid access alongside preserved preview and demo metadata."""

from django.conf import settings

from apps.payments.services.payment_service import PaymentService

from ..models import DemoMerchantPlusEntitlement
from .mock_plus_service import MockPlusService


class MerchantPlusStatusService:
    """Compose the existing status contract without creating financial or demo records."""

    @staticmethod
    def get_status(user):
        """Expose product, eligibility, and explicit paid access with no provider side effects."""
        business = PaymentService.get_owned_business(user)
        demo = DemoMerchantPlusEntitlement.objects.filter(BUSN_ID=business).first()
        status = MockPlusService.build_status(business, demo)
        eligibility = PaymentService.get_purchase_eligibility(user, business=business)
        paid = eligibility["active_entitlement"]
        status.update({
            "payment_mode": PaymentService.current_mode(),
            "checkout_enabled": settings.PAYMONGO_CHECKOUT_ENABLED,
            "product": PaymentService.get_product(),
            "entitlement_starts_at": None,
            "entitlement_expires_at": None,
            "paid_payment_id": None,
            "paid_payment_reference": None,
            "unresolved_payment_id": None,
            "unresolved_payment_reference": None,
            "purchase_eligible": eligibility["eligible"],
            "purchase_ineligibility_reason": eligibility["reason"],
        })
        unresolved = eligibility["unresolved_payment"]
        if unresolved is not None:
            status["unresolved_payment_id"] = unresolved.pk
            status["unresolved_payment_reference"] = unresolved.PYMT_REFERENCE
        if paid is not None:
            status.update({
                "effective_tier": "plus",
                "has_plus_access": True,
                "access_source": f"paymongo_{paid.PYMT_ID.PYMT_MODE}",
                "is_simulation": paid.PYMT_ID.PYMT_MODE == "test",
                "activated_at": paid.MPPE_STARTS_AT,
                "entitlement_starts_at": paid.MPPE_STARTS_AT,
                "entitlement_expires_at": paid.MPPE_EXPIRES_AT,
                "paid_payment_id": paid.PYMT_ID_id,
                "paid_payment_reference": paid.PYMT_ID.PYMT_REFERENCE,
            })
        return status
