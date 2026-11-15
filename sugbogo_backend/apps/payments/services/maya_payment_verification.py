"""Shared authoritative Maya evidence checks and financial transition."""

from functools import partial

from django.db import transaction
from django.utils import timezone

from ..constants import MERCHANT_PLUS_PRODUCT
from ..models import Payment, PaymentCheckoutSession, PaymentMode, PaymentProvider


def matches_maya_purchase(
    evidence,
    payment,
    checkout,
    business,
):
    """Match retrieved evidence to the exact server-owned Sandbox purchase."""
    product = MERCHANT_PLUS_PRODUCT
    return (
        payment.PYMT_PROVIDER == checkout.PCHK_PROVIDER == PaymentProvider.MAYA
        and payment.PYMT_MODE == checkout.PCHK_MODE == PaymentMode.TEST
        and payment.PYMT_PRODUCT == product.code
        and payment.PYMT_PRODUCT_VERSION == product.version
        and payment.PYMT_ACCESS_DURATION_DAYS == product.access_duration_days
        and payment.PYMT_AMOUNT_CENTAVOS == evidence.amount_centavos == product.amount_centavos
        and payment.PYMT_CURRENCY == evidence.currency == product.currency
        and payment.BUSN_ID_id == business.pk
        and payment.USER_ID_id == business.USER_ID_id
        and checkout.PYMT_ID_id == payment.pk
        and evidence.payment_id == checkout.PCHK_PROVIDER_SESSION_ID
        and evidence.request_reference == str(checkout.PCHK_OPERATION_REFERENCE)
    )


def mark_verified_maya_payment_paid(
    payment,
    evidence,
):
    """Record paid evidence once under the caller's payment lock and dispatch after commit."""
    from ..tasks import dispatch_merchant_plus_fulfilment

    if payment.PYMT_STATUS == Payment.Status.PAID:
        return
    payment.PYMT_STATUS = Payment.Status.PAID
    payment.PYMT_FULFILMENT_STATUS = Payment.FulfilmentStatus.PENDING
    payment.PYMT_PROVIDER_PAYMENT_ID = evidence.payment_id
    payment.PYMT_PAID_AT = evidence.paid_at
    payment.PYMT_VERIFIED_AT = timezone.now()
    payment.PYMT_METHOD_TYPE = evidence.method
    payment.PYMT_CARD_BRAND = evidence.card_brand
    payment.PYMT_CARD_LAST4 = evidence.card_last4
    payment.save(update_fields=[
        "PYMT_STATUS", "PYMT_FULFILMENT_STATUS", "PYMT_PROVIDER_PAYMENT_ID",
        "PYMT_PAID_AT", "PYMT_VERIFIED_AT", "PYMT_METHOD_TYPE", "PYMT_CARD_BRAND",
        "PYMT_CARD_LAST4", "PYMT_UPDATED_AT",
    ])
    transaction.on_commit(partial(dispatch_merchant_plus_fulfilment, payment.pk))


def record_maya_checkout_observation(
    checkout,
    evidence,
):
    """Persist a retrieved observation while keeping financial confirmation separate."""
    if evidence.status == "PAYMENT_SUCCESS":
        checkout.PCHK_STATE = PaymentCheckoutSession.State.COMPLETED
    elif evidence.status == "PAYMENT_EXPIRED":
        checkout.PCHK_STATE = PaymentCheckoutSession.State.EXPIRED
    checkout.PCHK_PROVIDER_STATUS = evidence.status
    checkout.PCHK_CHECKED_AT = timezone.now()
    checkout.save(update_fields=[
        "PCHK_STATE", "PCHK_PROVIDER_STATUS", "PCHK_CHECKED_AT", "PCHK_UPDATED_AT",
    ])
