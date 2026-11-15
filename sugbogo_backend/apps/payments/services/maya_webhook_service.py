"""Store Maya deliveries and apply independently verified financial observations."""

from datetime import timedelta
from functools import partial
from hashlib import sha256

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

from apps.business.models import Business
from apps.shared.services.maya_checkout_service import (
    MayaCheckoutService,
    MayaConfigurationError,
    MayaPaymentRejected,
    MayaPaymentUnavailable,
)
from apps.shared.services.maya_payment_evidence import normalize_maya_payment

from ..constants import MERCHANT_PLUS_PRODUCT
from ..models import Payment, PaymentCheckoutSession, PaymentMode, PaymentProvider, PaymentProviderEvent


SUCCESS = "PAYMENT_SUCCESS"
SUPPORTED_EVENTS = frozenset({SUCCESS, "PAYMENT_FAILED", "PAYMENT_EXPIRED", "PAYMENT_CANCELLED"})
PENDING_STATUSES = frozenset({
    "PENDING_TOKEN", "PENDING_PAYMENT", "FOR_AUTHENTICATION", "AUTHENTICATING",
    "AUTH_SUCCESS", "PAYMENT_PROCESSING",
})
MAX_ATTEMPTS = 6
PROCESSING_LEASE = timedelta(seconds=90)
EventState = PaymentProviderEvent.State


def maya_webhook_enabled():
    """Limit receipt and processing to the explicitly enabled Sandbox flow."""
    return (
        settings.MAYA_WEBHOOK_ENABLED
        and settings.PAYMENT_PROVIDER == PaymentProvider.MAYA
        and settings.PAYMENT_MODE == PaymentMode.TEST
    )


def _maya_events():
    """Scope worker and inbox queries to Maya Sandbox."""
    return PaymentProviderEvent.objects.filter(
        PWEV_PROVIDER=PaymentProvider.MAYA,
        PWEV_MODE=PaymentMode.TEST,
    )


@transaction.atomic
def accept_maya_delivery(
    payload,
    body,
):
    """Durably record one normalized signed delivery before scheduling processing."""
    from ..tasks import dispatch_maya_event

    evidence = normalize_maya_payment(payload)
    dedupe_key = f"{evidence.payment_id}:{evidence.status}"
    data = {
        "payment_id": evidence.payment_id,
        "status": evidence.status,
        "request_reference": evidence.request_reference,
        "amount_centavos": evidence.amount_centavos,
        "currency": evidence.currency,
    }
    try:
        event, created = PaymentProviderEvent.record_delivery(
            provider=PaymentProvider.MAYA,
            mode=PaymentMode.TEST,
            dedupe_key=dedupe_key,
            event_type=evidence.status,
            data=data,
            payload_digest=sha256(body).hexdigest(),
            provider_checkout_id=evidence.payment_id,
        )
    except ValidationError as exc:
        if getattr(exc, "code", None) != "provider_event_evidence_conflict":
            raise
        event = _maya_events().select_for_update().get(PWEV_DEDUPE_KEY=dedupe_key)
        _finish(event, EventState.NEEDS_ATTENTION, "conflicting_delivery")
        return
    if not created:
        return
    if evidence.status not in SUPPORTED_EVENTS:
        _finish(event, EventState.IGNORED, "unsupported_event")
        return
    transaction.on_commit(partial(dispatch_maya_event, event.pk))


def _due_events(now):
    """Find undispatched, delayed, or abandoned Sandbox work."""
    return _maya_events().filter(
        Q(PWEV_STATE=EventState.QUEUED)
        & (Q(PWEV_RETRY_AT__isnull=True) | Q(PWEV_RETRY_AT__lte=now))
        | Q(PWEV_STATE=EventState.PROCESSING)
        & (Q(PWEV_LEASE_UNTIL__isnull=True) | Q(PWEV_LEASE_UNTIL__lte=now)),
    )


def due_maya_event_ids():
    """Return a bounded batch for the existing Celery Beat recovery loop."""
    if not maya_webhook_enabled():
        return []
    return list(
        _due_events(timezone.now())
        .order_by("PWEV_RECEIVED_AT", "pk")
        .values_list("pk", flat=True)[:100],
    )


@transaction.atomic
def _claim(event_id):
    """Acquire one recoverable lease without holding a database lock during HTTP."""
    now = timezone.now()
    event = _due_events(now).select_for_update(skip_locked=True).filter(pk=event_id).first()
    if event is None:
        return None
    if event.PWEV_TYPE not in SUPPORTED_EVENTS:
        _finish(event, EventState.IGNORED, "unsupported_event")
        return None
    if event.PWEV_ATTEMPTS >= MAX_ATTEMPTS:
        _finish(event, EventState.NEEDS_ATTENTION, "verification_attempts_exhausted")
        return None
    event.PWEV_STATE = EventState.PROCESSING
    event.PWEV_ATTEMPTS += 1
    event.PWEV_RETRY_AT = None
    event.PWEV_LEASE_UNTIL = now + PROCESSING_LEASE
    event.save(update_fields=[
        "PWEV_STATE", "PWEV_ATTEMPTS", "PWEV_RETRY_AT", "PWEV_LEASE_UNTIL", "PWEV_UPDATED_AT",
    ])
    return event


def _finish(
    event,
    state,
    reason="",
):
    """Persist outcome and clear the processing lease while the inbox row is locked."""
    event.PWEV_STATE = state
    event.PWEV_LAST_ERROR = reason
    event.PWEV_RETRY_AT = None
    event.PWEV_LEASE_UNTIL = None
    if state in (EventState.PROCESSED, EventState.IGNORED):
        event.PWEV_PROCESSED_AT = timezone.now()
    event.save(update_fields=[
        "PWEV_STATE", "PWEV_LAST_ERROR", "PWEV_RETRY_AT", "PWEV_LEASE_UNTIL",
        "PWEV_PROCESSED_AT", "PWEV_UPDATED_AT", "PYMT_ID", "PCHK_ID",
    ])


def _retry(
    event,
    reason,
):
    """Keep temporary failures recoverable with bounded exponential delay."""
    if event.PWEV_ATTEMPTS >= MAX_ATTEMPTS:
        _finish(event, EventState.NEEDS_ATTENTION, reason)
        return
    event.PWEV_STATE = EventState.QUEUED
    event.PWEV_LAST_ERROR = reason
    event.PWEV_RETRY_AT = timezone.now() + timedelta(seconds=15 * 2 ** (event.PWEV_ATTEMPTS - 1))
    event.PWEV_LEASE_UNTIL = None
    event.save(update_fields=[
        "PWEV_STATE", "PWEV_LAST_ERROR", "PWEV_RETRY_AT", "PWEV_LEASE_UNTIL", "PWEV_UPDATED_AT",
    ])


def _matching_checkouts(payment_id):
    """Find only Checkout IDs already reserved and persisted in Maya Sandbox."""
    return PaymentCheckoutSession.objects.filter(
        PCHK_PROVIDER=PaymentProvider.MAYA,
        PCHK_MODE=PaymentMode.TEST,
        PCHK_PROVIDER_SESSION_ID=payment_id,
    )


def _matching_evidence(
    event,
    evidence,
    payment,
    checkout,
    business,
):
    """Compare authoritative and signed evidence to the server-owned purchase."""
    product = MERCHANT_PLUS_PRODUCT
    return (
        payment.PYMT_PROVIDER == PaymentProvider.MAYA
        and payment.PYMT_MODE == PaymentMode.TEST
        and payment.PYMT_PRODUCT == product.code
        and payment.PYMT_PRODUCT_VERSION == product.version
        and payment.PYMT_ACCESS_DURATION_DAYS == product.access_duration_days
        and payment.PYMT_AMOUNT_CENTAVOS == evidence.amount_centavos == product.amount_centavos
        and payment.PYMT_CURRENCY == evidence.currency == product.currency
        and payment.BUSN_ID_id == business.pk
        and payment.USER_ID_id == business.USER_ID_id
        and checkout.PYMT_ID_id == payment.pk
        and evidence.payment_id == checkout.PCHK_PROVIDER_SESSION_ID == event.PWEV_PROVIDER_CHECKOUT_ID
        and evidence.request_reference == str(checkout.PCHK_OPERATION_REFERENCE)
        and event.PWEV_DATA.get("payment_id") == evidence.payment_id
        and event.PWEV_DATA.get("status") == event.PWEV_TYPE
        and event.PWEV_DATA.get("request_reference") in (None, evidence.request_reference)
        and event.PWEV_DATA.get("amount_centavos") in (None, evidence.amount_centavos)
        and event.PWEV_DATA.get("currency") in (None, evidence.currency)
    )


@transaction.atomic
def _apply_observation(
    claim,
    *,
    evidence=None,
    retry_reason="",
    review_reason="",
):
    """Fence stale workers and atomically apply the verified financial observation."""
    event = _maya_events().select_for_update().get(pk=claim.pk)
    if (
        event.PWEV_STATE != EventState.PROCESSING
        or event.PWEV_ATTEMPTS != claim.PWEV_ATTEMPTS
        or event.PWEV_LEASE_UNTIL is None
        or event.PWEV_LEASE_UNTIL <= timezone.now()
    ):
        return
    if retry_reason:
        _retry(event, retry_reason)
        return
    if review_reason:
        _finish(event, EventState.NEEDS_ATTENTION, review_reason)
        return
    checkouts = _matching_checkouts(event.PWEV_PROVIDER_CHECKOUT_ID)
    target = checkouts.values("pk", "PYMT_ID_id", "PYMT_ID__BUSN_ID_id").first()
    if target is None:
        _finish(event, EventState.NEEDS_ATTENTION, "checkout_not_found")
        return
    business = Business.objects.select_for_update().get(pk=target["PYMT_ID__BUSN_ID_id"])
    payment = Payment.objects.select_for_update().get(pk=target["PYMT_ID_id"])
    checkout = checkouts.select_for_update().filter(pk=target["pk"]).first()
    if checkout is None or not _matching_evidence(event, evidence, payment, checkout, business):
        _finish(event, EventState.NEEDS_ATTENTION, "payment_evidence_mismatch")
        return
    event.PYMT_ID = payment
    event.PCHK_ID = checkout
    if payment.PYMT_STATUS == Payment.Status.PAID:
        if payment.PYMT_PROVIDER_PAYMENT_ID != evidence.payment_id:
            _finish(event, EventState.NEEDS_ATTENTION, "paid_payment_identity_mismatch")
        else:
            _finish(event, EventState.IGNORED, "already_paid")
        return
    if evidence.status != event.PWEV_TYPE:
        if evidence.status in PENDING_STATUSES:
            _retry(event, "provider_status_pending")
        elif event.PWEV_TYPE == SUCCESS:
            _finish(event, EventState.NEEDS_ATTENTION, "provider_status_mismatch")
        else:
            _finish(event, EventState.IGNORED, "provider_status_changed")
        return
    if event.PWEV_TYPE == SUCCESS:
        if evidence.paid_at is None:
            _finish(event, EventState.NEEDS_ATTENTION, "provider_paid_time_missing")
            return
        try:
            with transaction.atomic():
                _mark_paid(payment, evidence)
        except IntegrityError:
            _finish(event, EventState.NEEDS_ATTENTION, "payment_evidence_conflict")
            return
        checkout.PCHK_STATE = PaymentCheckoutSession.State.COMPLETED
    elif event.PWEV_TYPE == "PAYMENT_EXPIRED":
        checkout.PCHK_STATE = PaymentCheckoutSession.State.EXPIRED
    checkout.PCHK_PROVIDER_STATUS = evidence.status
    checkout.PCHK_CHECKED_AT = timezone.now()
    checkout.save(update_fields=[
        "PCHK_STATE", "PCHK_PROVIDER_STATUS", "PCHK_CHECKED_AT", "PCHK_UPDATED_AT",
    ])
    _finish(event, EventState.PROCESSED)


def _mark_paid(
    payment,
    evidence,
):
    """Record the financial transition while leaving entitlement activation to M5."""
    from ..tasks import dispatch_merchant_plus_fulfilment

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


def process_maya_delivery(event_id):
    """Claim a delivery and verify it against Maya outside the database transaction."""
    if not maya_webhook_enabled():
        return
    event = _claim(event_id)
    if event is None:
        return
    if not _matching_checkouts(event.PWEV_PROVIDER_CHECKOUT_ID).exists():
        _apply_observation(event, review_reason="checkout_not_found")
        return
    try:
        evidence = MayaCheckoutService.retrieve_payment(
            mode=event.PWEV_MODE,
            payment_id=event.PWEV_PROVIDER_CHECKOUT_ID,
        )
    except MayaPaymentUnavailable:
        _apply_observation(event, retry_reason="provider_temporarily_unavailable")
    except (MayaPaymentRejected, MayaConfigurationError):
        _apply_observation(event, review_reason="provider_verification_rejected")
    else:
        _apply_observation(event, evidence=evidence)
