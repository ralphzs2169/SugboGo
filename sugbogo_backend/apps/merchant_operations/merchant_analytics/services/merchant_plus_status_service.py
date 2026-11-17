"""Read paid access alongside preserved preview and demo metadata."""

from apps.payments.models import Payment, PaymentCheckoutSession, PaymentMode, PaymentProvider
from apps.payments.services.checkout_service import CheckoutService
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
            "checkout_enabled": CheckoutService.is_enabled(),
            "checkout_can_resume": False,
            "checkout_retry_reference": None,
            "product": PaymentService.get_product(),
            "entitlement_starts_at": None,
            "entitlement_expires_at": None,
            "paid_payment_id": None,
            "paid_payment_reference": None,
            "unresolved_payment_id": None,
            "unresolved_payment_reference": None,
            "unresolved_payment_provider": None,
            "unresolved_payment_mode": None,
            "unresolved_payment_status": None,
            "unresolved_fulfilment_status": None,
            "unresolved_checkout_status": None,
            "checkout_outcome": None,
            "purchase_eligible": eligibility["eligible"],
            "purchase_ineligibility_reason": eligibility["reason"],
        })
        unresolved = eligibility["unresolved_payment"]
        if unresolved is not None:
            status["unresolved_payment_id"] = unresolved.pk
            status["unresolved_payment_reference"] = unresolved.PYMT_REFERENCE
            status["unresolved_payment_provider"] = unresolved.PYMT_PROVIDER
            status["unresolved_payment_mode"] = unresolved.PYMT_MODE
            status["unresolved_payment_status"] = unresolved.PYMT_STATUS
            status["unresolved_fulfilment_status"] = unresolved.PYMT_FULFILMENT_STATUS
            checkout = unresolved.checkout_sessions.order_by("-PCHK_ID").first()
            status["checkout_outcome"] = MerchantPlusStatusService.checkout_outcome(
                unresolved,
                checkout,
            )
            if checkout is not None:
                status["unresolved_checkout_status"] = checkout.PCHK_STATE
                status["checkout_can_resume"] = (
                    paid is None
                    and CheckoutService.can_resume(unresolved, checkout)
                )
                if (
                    status["checkout_enabled"]
                    and paid is None
                    and CheckoutService.can_retry(unresolved, checkout)
                ):
                    status["checkout_retry_reference"] = checkout.PCHK_OPERATION_REFERENCE
        if paid is not None:
            payment = paid.PYMT_ID
            status.update({
                "effective_tier": "plus",
                "has_plus_access": True,
                "access_source": f"{payment.PYMT_PROVIDER}_{payment.PYMT_MODE}",
                "is_simulation": payment.PYMT_MODE == PaymentMode.TEST,
                "activated_at": paid.MPPE_STARTS_AT,
                "entitlement_starts_at": paid.MPPE_STARTS_AT,
                "entitlement_expires_at": paid.MPPE_EXPIRES_AT,
                "paid_payment_id": paid.PYMT_ID_id,
                "paid_payment_reference": payment.PYMT_REFERENCE,
            })
        return status

    @staticmethod
    def checkout_outcome(
        payment,
        checkout,
    ):
        """Normalize stored unpaid checkout evidence independently of financial confirmation."""
        if payment.PYMT_STATUS == Payment.Status.PAID:
            return None
        if checkout is None:
            return "unknown"
        if checkout.PCHK_PROVIDER == PaymentProvider.MAYA:
            terminal = CheckoutService.TERMINAL_MAYA_OUTCOMES.get(
                checkout.PCHK_PROVIDER_STATUS,
            )
            if terminal is not None:
                return terminal
        if checkout.PCHK_STATE == PaymentCheckoutSession.State.EXPIRED:
            return "expired"
        if (
            checkout.PCHK_STATE in (
                PaymentCheckoutSession.State.CREATING,
                PaymentCheckoutSession.State.READY,
            )
            and checkout.PCHK_PROVIDER_STATUS in ("", "PENDING_TOKEN", "PENDING_PAYMENT")
        ):
            return "pending"
        return "unknown"
