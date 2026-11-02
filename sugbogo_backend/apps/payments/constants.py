"""Server-owned product values and bounded financial evidence metadata."""

from dataclasses import dataclass


@dataclass(frozen=True)
class MerchantPlusProduct:
    """Describe the single approved offer without a mutable pricing catalog."""

    code: str = "merchant_plus"
    version: str = "capstone-v1"
    name: str = "Merchant Plus"
    amount_centavos: int = 100
    currency: str = "PHP"
    access_duration_days: int = 30
    payment_type: str = "one-time"


MERCHANT_PLUS_PRODUCT = MerchantPlusProduct()

NORMALIZED_EVENT_FIELDS = frozenset({
    "session_id",
    "reference_number",
    "livemode",
    "payment_id",
    "payment_intent_id",
    "amount",
    "currency",
    "status",
    "payment_method_type",
})
MAX_EVENT_DATA_BYTES = 16384
