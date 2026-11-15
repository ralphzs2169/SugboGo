"""Normalize bounded Maya Checkout evidence without retaining provider payloads."""

import re
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from django.utils.dateparse import parse_datetime
from django.utils.timezone import is_aware


class InvalidMayaPayment(ValueError):
    """Reject ambiguous or unusable payment evidence."""


@dataclass(frozen=True)
class MayaPaymentEvidence:
    """Carry only the validated fields needed to reconcile a local payment."""

    payment_id: str
    status: str
    request_reference: str | None
    amount_centavos: int | None
    currency: str | None
    paid_at: datetime | None = None
    method: str = ""
    card_brand: str = ""
    card_last4: str = ""


def _centavos(value):
    """Convert a documented peso amount without rounding to a centavo."""
    if value is None:
        return None
    amount = str(value)
    if not re.fullmatch(r"[0-9]{1,10}(?:\.[0-9]{1,12})?", amount):
        raise InvalidMayaPayment()
    centavos = Decimal(amount).scaleb(2)
    if centavos != centavos.to_integral_value():
        raise InvalidMayaPayment()
    return int(centavos)


def _amount_and_currency(payload):
    """Read both Checkout and payment-shaped evidence and reject contradictory money fields."""
    total = payload.get("totalAmount")
    if total is None:
        total = {}
    elif not isinstance(total, dict):
        raise InvalidMayaPayment()
    amounts = {
        _centavos(value)
        for value in (payload.get("amount"), total.get("value"), total.get("amount"))
        if value is not None
    }
    currency_values = (payload.get("currency"), total.get("currency"))
    currencies = set()
    for value in currency_values:
        if value is None:
            continue
        if not isinstance(value, str) or not re.fullmatch(r"[A-Z]{3}", value):
            raise InvalidMayaPayment()
        currencies.add(value)
    if len(amounts) > 1 or len(currencies) > 1:
        raise InvalidMayaPayment()
    return next(iter(amounts), None), next(iter(currencies), None)


def _payment_time(value):
    """Read an aware provider timestamp where one is available."""
    if not isinstance(value, str) or len(value) > 40:
        return None
    try:
        timestamp = parse_datetime(value)
    except ValueError:
        return None
    if timestamp is not None and is_aware(timestamp):
        return timestamp
    return None


def normalize_maya_payment(
    payload,
    *,
    retrieved=False,
):
    """Extract payment identity, exact money, and safe provider observations."""
    payment_id = payload.get("id")
    status = payload.get("paymentStatus", payload.get("status"))
    reference = payload.get("requestReferenceNumber")
    if (
        not isinstance(payment_id, str)
        or len(payment_id) != 36
        or not isinstance(status, str)
        or not re.fullmatch(r"[A-Z][A-Z0-9_]{0,31}", status)
        or (
            reference is not None
            and (
                not isinstance(reference, str)
                or not re.fullmatch(r"[A-Za-z0-9_-]{1,36}", reference)
            )
        )
    ):
        raise InvalidMayaPayment()
    try:
        canonical_id = str(UUID(payment_id))
    except ValueError:
        raise InvalidMayaPayment() from None
    if canonical_id != payment_id.lower():
        raise InvalidMayaPayment()
    amount, currency = _amount_and_currency(payload)
    if not retrieved:
        return MayaPaymentEvidence(canonical_id, status, reference, amount, currency)

    if status == "PAYMENT_SUCCESS" and payload.get("isPaid", True) is not True:
        raise InvalidMayaPayment()
    details = payload.get("paymentDetails")
    if not isinstance(details, dict):
        details = {}
    source = payload.get("fundSource")
    if not isinstance(source, dict):
        source = {}
    source_details = source.get("details")
    if not isinstance(source_details, dict):
        source_details = {}
    method = source.get("type")
    if method not in ("card", "maya-wallet", "paymaya"):
        method = ""
    brand = details.get("cardType") or source_details.get("scheme") or payload.get("paymentScheme")
    if brand not in ("visa", "mastercard", "master-card", "jcb", "amex"):
        brand = ""
    if brand and not method:
        method = "card"
    last4 = details.get("last4") or source_details.get("last4")
    if method != "card":
        brand = ""
    if method != "card" or not isinstance(last4, str) or not re.fullmatch(r"[0-9]{4}", last4):
        last4 = ""
    paid_at = _payment_time(details.get("paymentAt")) or _payment_time(payload.get("updatedAt"))
    return MayaPaymentEvidence(
        payment_id=canonical_id,
        status=status,
        request_reference=reference,
        amount_centavos=amount,
        currency=currency,
        paid_at=paid_at,
        method=method,
        card_brand=brand,
        card_last4=last4,
    )
