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
    ):
        return
    recover_identity = not checkout.PCHK_PROVIDER_SESSION_ID
    if recover_identity:
        if checkout.PCHK_STATE == PaymentCheckoutSession.State.CREATION_FAILED:
            return
        if checkout.PCHK_STATE != PaymentCheckoutSession.State.CREATION_UNKNOWN:
            raise MayaReconciliationUnavailable()
    elif not MayaCheckoutService.is_checkout_id(checkout.PCHK_PROVIDER_SESSION_ID):
        raise MayaReconciliationConflict()
    try:
        provider_id = checkout.PCHK_PROVIDER_SESSION_ID
        if recover_identity:
            reference_evidence = MayaCheckoutService.retrieve_payment_by_reference(
                mode=payment.PYMT_MODE,
                operation_reference=checkout.PCHK_OPERATION_REFERENCE,
            )
            if reference_evidence is None:
                # Absence alone must not release an uncertain purchase for another POST.
                raise MayaReconciliationUnavailable()
            provider_id = reference_evidence.payment_id
        evidence = MayaCheckoutService.retrieve_payment(
            mode=payment.PYMT_MODE,
            payment_id=provider_id,
        )
        if evidence.payment_id != provider_id:
            raise MayaReconciliationConflict()
    except (MayaPaymentUnavailable, MayaConfigurationError):
        raise MayaReconciliationUnavailable() from None
    except MayaPaymentRejected:
        raise MayaReconciliationConflict() from None
    try:
        _apply_reconciliation(
            user,
            payment,
            checkout,
            evidence,
            recover_identity=recover_identity,
        )
    except IntegrityError:
        raise MayaReconciliationConflict() from None


@transaction.atomic
def _apply_reconciliation(
    user,
    target_payment,
    target_checkout,
    evidence,
    *,
    recover_identity=False,
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
    if recover_identity:
        latest = payment.checkout_sessions.order_by("-PCHK_ID").first()
        if (
            latest is None
            or latest.pk != checkout.pk
            or checkout.PCHK_PROVIDER_SESSION_ID not in (None, "", evidence.payment_id)
            or checkout.PCHK_STATE not in {
                PaymentCheckoutSession.State.CREATION_UNKNOWN,
                PaymentCheckoutSession.State.READY,
                PaymentCheckoutSession.State.COMPLETED,
                PaymentCheckoutSession.State.EXPIRED,
            }
        ):
            raise MayaReconciliationConflict()
        # Set only in memory until the full existing purchase checks below pass.
        checkout.PCHK_PROVIDER_SESSION_ID = evidence.payment_id
    if (
        not matches_maya_purchase(evidence, payment, checkout, business)
        or evidence.status not in SUPPORTED_EVENTS | PENDING_STATUSES
        or (evidence.status == SUCCESS and evidence.paid_at is None)
    ):
        raise MayaReconciliationConflict()
    if recover_identity:
        if checkout.PCHK_STATE == PaymentCheckoutSession.State.CREATION_UNKNOWN:
            checkout.PCHK_STATE = PaymentCheckoutSession.State.READY
        checkout.PCHK_LAST_ERROR = ""
        checkout.save(update_fields=[
            "PCHK_PROVIDER_SESSION_ID", "PCHK_STATE", "PCHK_LAST_ERROR", "PCHK_UPDATED_AT",
        ])
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
