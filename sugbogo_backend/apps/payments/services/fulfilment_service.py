"""Activate the server-owned Merchant Plus offer from locally verified payments."""

import logging
from datetime import timedelta
from functools import partial

from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone
from rest_framework.exceptions import NotFound

from apps.business.models import Business
from apps.merchant_operations.merchant_analytics.models import PaidMerchantPlusEntitlement
from apps.notifications.services.notification_service import NotificationService
from apps.users.models import User

from ..constants import MERCHANT_PLUS_PRODUCT
from ..models import Payment, PaymentMode, PaymentProvider


logger = logging.getLogger(__name__)


def _eligible_payments():
    """Find supported paid obligations without reinterpreting their stored environment."""
    product = MERCHANT_PLUS_PRODUCT
    return Payment.objects.filter(
        PYMT_STATUS=Payment.Status.PAID,
        PYMT_PROVIDER__in=PaymentProvider.values,
        PYMT_MODE__in=PaymentMode.values,
        PYMT_PRODUCT=product.code,
        PYMT_PRODUCT_VERSION=product.version,
        PYMT_AMOUNT_CENTAVOS=product.amount_centavos,
        PYMT_CURRENCY=product.currency,
        PYMT_ACCESS_DURATION_DAYS=product.access_duration_days,
        PYMT_PROVIDER_PAYMENT_ID__isnull=False,
        PYMT_PAID_AT__isnull=False,
        PYMT_VERIFIED_AT__isnull=False,
        USER_ID=F("BUSN_ID__USER_ID"),
        USER_ID__USER_ROLE=User.UserRole.MERCHANT,
    ).exclude(
        PYMT_PROVIDER_PAYMENT_ID="",
    ).exclude(
        PYMT_PROVIDER=PaymentProvider.MAYA,
        PYMT_MODE=PaymentMode.LIVE,
    )


def due_fulfilment_payment_ids():
    """Bound recovery to eligible unfinished obligations whose retry and lease are due."""
    now = timezone.now()
    return list(
        _eligible_payments().filter(
            Q(PYMT_RETRY_AT__isnull=True) | Q(PYMT_RETRY_AT__lte=now),
            Q(PYMT_LEASE_UNTIL__isnull=True) | Q(PYMT_LEASE_UNTIL__lte=now),
            PYMT_FULFILMENT_STATUS__in=[
                Payment.FulfilmentStatus.NOT_STARTED,
                Payment.FulfilmentStatus.PENDING,
            ],
        ).order_by("PYMT_CREATED_AT", "pk").values_list("pk", flat=True)[:100],
    )


def _notify_activation(payment_id):
    """Deliver one persistent activation notification after the entitlement commits."""
    try:
        payment = Payment.objects.select_related("USER_ID").get(pk=payment_id)
        NotificationService.create(
            recipient=payment.USER_ID,
            event_type="merchant_plus_activated",
            title="Merchant Plus activated",
            body="Your Merchant Plus access is active for 30 days.",
            dedup_key=f"merchant_plus_activated:{payment.pk}",
        )
    except Exception:
        logger.warning(
            "Merchant Plus activation notification failed.",
            extra={"payment_id": payment_id},
        )


def _attention(
    payment,
    reason,
):
    """Retain a paid obligation for review without creating or extending access."""
    payment.PYMT_FULFILMENT_STATUS = Payment.FulfilmentStatus.NEEDS_ATTENTION
    payment.PYMT_LAST_ERROR = reason
    payment.PYMT_LEASE_UNTIL = None
    payment.PYMT_RETRY_AT = None
    payment.save(update_fields=[
        "PYMT_FULFILMENT_STATUS", "PYMT_LAST_ERROR", "PYMT_LEASE_UNTIL",
        "PYMT_RETRY_AT", "PYMT_UPDATED_AT",
    ])


@transaction.atomic
def fulfil_paid_merchant_plus_payment(payment_id):
    """Create or recover exactly one grant while serializing all purchases for its business."""
    try:
        business_id = Payment.objects.values_list("BUSN_ID_id", flat=True).get(pk=payment_id)
    except Payment.DoesNotExist:
        raise NotFound("Payment could not be found.") from None
    # Match checkout and confirmation lock order to prevent cross-service deadlocks.
    business = Business.objects.select_for_update().get(pk=business_id)
    payment = Payment.objects.select_for_update().get(pk=payment_id)
    if payment.PYMT_STATUS != Payment.Status.PAID:
        return None
    if payment.PYMT_FULFILMENT_STATUS not in (
        Payment.FulfilmentStatus.NOT_STARTED,
        Payment.FulfilmentStatus.PENDING,
        Payment.FulfilmentStatus.FULFILLED,
    ):
        return None
    if not _eligible_payments().filter(pk=payment.pk).exists():
        _attention(payment, "fulfilment_evidence_mismatch")
        return None
    now = timezone.now()
    if (
        payment.PYMT_LEASE_UNTIL is not None
        and payment.PYMT_LEASE_UNTIL > now
    ):
        return None
    entitlement = PaidMerchantPlusEntitlement.objects.filter(PYMT_ID=payment).first()
    created = entitlement is None
    duration = timedelta(days=MERCHANT_PLUS_PRODUCT.access_duration_days)
    if entitlement is not None:
        if (
            entitlement.BUSN_ID_id != business.pk
            or entitlement.MPPE_EXPIRES_AT - entitlement.MPPE_STARTS_AT != duration
        ):
            _attention(payment, "entitlement_evidence_mismatch")
            return None
        if payment.PYMT_FULFILMENT_STATUS == Payment.FulfilmentStatus.FULFILLED:
            return entitlement
    elif payment.PYMT_FULFILMENT_STATUS == Payment.FulfilmentStatus.FULFILLED:
        _attention(payment, "fulfilled_entitlement_missing")
        return None
    else:
        overlap = PaidMerchantPlusEntitlement.objects.filter(
            BUSN_ID=business,
            PYMT_ID__PYMT_MODE=payment.PYMT_MODE,
            MPPE_STARTS_AT__lt=now + duration,
            MPPE_EXPIRES_AT__gt=now,
        ).exists()
        if overlap:
            _attention(payment, "active_entitlement_overlap")
            return None
        entitlement = PaidMerchantPlusEntitlement.objects.create(
            BUSN_ID=business,
            PYMT_ID=payment,
            MPPE_STARTS_AT=now,
            MPPE_EXPIRES_AT=now + duration,
        )
    payment.PYMT_FULFILMENT_STATUS = Payment.FulfilmentStatus.FULFILLED
    payment.PYMT_FULFILLED_AT = entitlement.MPPE_STARTS_AT
    payment.PYMT_ATTEMPTS += 1
    payment.PYMT_LEASE_UNTIL = None
    payment.PYMT_RETRY_AT = None
    payment.PYMT_LAST_ERROR = ""
    payment.save(update_fields=[
        "PYMT_FULFILMENT_STATUS", "PYMT_FULFILLED_AT", "PYMT_ATTEMPTS",
        "PYMT_LEASE_UNTIL", "PYMT_RETRY_AT", "PYMT_LAST_ERROR", "PYMT_UPDATED_AT",
    ])
    if created:
        transaction.on_commit(partial(_notify_activation, payment.pk))
    return entitlement
