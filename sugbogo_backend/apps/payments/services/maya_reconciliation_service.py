"""Reconcile only the authenticated merchant's current unresolved Maya purchase."""

from django.conf import settings
from django.db import IntegrityError, transaction
from rest_framework.exceptions import APIException, PermissionDenied

from apps.business.models import Business
from apps.shared.services.maya_checkout_service import (
    MayaCheckoutService,
    MayaConfigurationError,
    MayaPaymentRejected,
    MayaPaymentUnavailable,
)

from ..models import Payment, PaymentCheckoutSession, PaymentMode, PaymentProvider
from .maya_payment_verification import (
    matches_maya_purchase,
    mark_verified_maya_payment_paid,
    record_maya_checkout_observation,
)
from .maya_webhook_service import PENDING_STATUSES, SUCCESS, SUPPORTED_EVENTS
from .payment_service import PaymentService


class MayaReconciliationUnavailable(APIException):
    """Keep provider failures recoverable without exposing provider error details."""

    status_code = 503
    default_code = "payment_reconciliation_unavailable"
    default_detail = "We couldn't verify the payment with Maya yet. Check again in a moment."


class MayaReconciliationConflict(APIException):
    """Reject evidence that cannot safely confirm the existing purchase."""

    status_code = 409
    default_code = "payment_verification_mismatch"
    default_detail = "This payment could not be verified. Please check again later."


def reconcile_merchant_plus_payment(user):
    """Retrieve the existing provider identity without holding locks during HTTP."""
    business = PaymentService.get_owned_business(user)
    if (
        settings.PAYMENT_PROVIDER != PaymentProvider.MAYA
        or PaymentService.current_mode() != PaymentMode.TEST
    ):
        raise PermissionDenied("Maya Sandbox reconciliation is unavailable.")
    eligibility = PaymentService.get_purchase_eligibility(user, business=business)
    payment = eligibility["unresolved_payment"]
    if (
        eligibility["active_entitlement"] is not None
        or payment is None
        or payment.PYMT_STATUS == Payment.Status.PAID
    ):
        return
    if payment.PYMT_PROVIDER != PaymentProvider.MAYA:
        return
    checkout = payment.checkout_sessions.order_by("-PCHK_ID").first()
    if (
        checkout is None
        or checkout.PCHK_PROVIDER != PaymentProvider.MAYA
        or checkout.PCHK_MODE != PaymentMode.TEST
        or not MayaCheckoutService.is_checkout_id(checkout.PCHK_PROVIDER_SESSION_ID)
    ):
        return
    try:
        evidence = MayaCheckoutService.retrieve_payment(
            mode=payment.PYMT_MODE,
            payment_id=checkout.PCHK_PROVIDER_SESSION_ID,
        )
    except (MayaPaymentUnavailable, MayaConfigurationError):
        raise MayaReconciliationUnavailable() from None
    except MayaPaymentRejected:
        raise MayaReconciliationConflict() from None
    try:
        _apply_reconciliation(user, payment, checkout, evidence)
    except IntegrityError:
        raise MayaReconciliationConflict() from None


@transaction.atomic
def _apply_reconciliation(
    user,
    target_payment,
    target_checkout,
    evidence,
):
    """Recheck ownership and evidence under the same lock order as webhook fulfilment."""
    business = Business.objects.select_for_update().get(pk=target_payment.BUSN_ID_id)
    payment = Payment.objects.select_for_update().get(pk=target_payment.pk)
    checkout = PaymentCheckoutSession.objects.select_for_update().get(pk=target_checkout.pk)
    if (
        business.USER_ID_id != user.pk
        or payment.USER_ID_id != user.pk
        or not user.is_active
    ):
        raise PermissionDenied("You can only verify your own Merchant Plus payment.")
    PaymentService.require_merchant(business.USER_ID)
    if (
        not matches_maya_purchase(evidence, payment, checkout, business)
        or evidence.status not in SUPPORTED_EVENTS | PENDING_STATUSES
        or (evidence.status == SUCCESS and evidence.paid_at is None)
    ):
        raise MayaReconciliationConflict()
    if payment.PYMT_STATUS == Payment.Status.PAID:
        if payment.PYMT_PROVIDER_PAYMENT_ID != evidence.payment_id:
            raise MayaReconciliationConflict()
        return
    if evidence.status == SUCCESS:
        mark_verified_maya_payment_paid(payment, evidence)
    elif (
        evidence.status in PENDING_STATUSES
        and (
            checkout.PCHK_PROVIDER_STATUS in SUPPORTED_EVENTS
            or checkout.PCHK_STATE == PaymentCheckoutSession.State.EXPIRED
        )
    ):
        return
    record_maya_checkout_observation(checkout, evidence)
