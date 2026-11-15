"""Financial obligations, checkout operations, and a durable provider inbox."""

import json
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models

from .constants import MAX_EVENT_DATA_BYTES, NORMALIZED_EVENT_FIELDS


class PaymentMode(models.TextChoices):
    TEST = "test", "Test"
    LIVE = "live", "Live"


class PaymentProvider(models.TextChoices):
    PAYMONGO = "paymongo", "PayMongo"
    MAYA = "maya", "Maya"


def validate_event_data(value):
    """Accept only bounded scalar reconciliation fields rather than gateway payloads."""
    if (
        not isinstance(value, dict)
        or set(value) - NORMALIZED_EVENT_FIELDS
    ):
        raise ValidationError("Store only normalized payment event fields.")
    if any(
        (
            item is not None
            and not isinstance(item, (str, int, float, bool))
        )
        for item in value.values()
    ):
        raise ValidationError("Normalized event values must be scalar.")
    try:
        encoded = json.dumps(value, allow_nan=False).encode("utf-8")
    except (TypeError, ValueError):
        raise ValidationError("Normalized event data must be valid JSON.") from None
    if len(encoded) > MAX_EVENT_DATA_BYTES:
        raise ValidationError("Normalized event data exceeds the storage limit.")


class Payment(models.Model):
    """Preserve one server-priced obligation and its independently recoverable fulfilment."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"

    class FulfilmentStatus(models.TextChoices):
        NOT_STARTED = "not_started", "Not started"
        PENDING = "pending", "Pending"
        FULFILLED = "fulfilled", "Fulfilled"
        NEEDS_ATTENTION = "needs_attention", "Needs attention"

    PYMT_ID = models.BigAutoField(primary_key=True)
    PYMT_REFERENCE = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    USER_ID = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column="USER_ID",
        related_name="payments",
    )
    BUSN_ID = models.ForeignKey(
        "business.Business",
        on_delete=models.PROTECT,
        db_column="BUSN_ID",
        related_name="payments",
    )
    PYMT_PRODUCT = models.CharField(max_length=40)
    PYMT_PRODUCT_VERSION = models.CharField(max_length=40)
    PYMT_AMOUNT_CENTAVOS = models.PositiveIntegerField()
    PYMT_CURRENCY = models.CharField(max_length=3)
    PYMT_ACCESS_DURATION_DAYS = models.PositiveSmallIntegerField()
    PYMT_PROVIDER = models.CharField(max_length=8, choices=PaymentProvider.choices)
    PYMT_MODE = models.CharField(max_length=4, choices=PaymentMode.choices)
    PYMT_STATUS = models.CharField(
        max_length=8,
        choices=Status.choices,
        default=Status.PENDING,
    )
    PYMT_FULFILMENT_STATUS = models.CharField(
        max_length=16,
        choices=FulfilmentStatus.choices,
        default=FulfilmentStatus.NOT_STARTED,
    )
    PYMT_PROVIDER_PAYMENT_ID = models.CharField(max_length=128, null=True, blank=True)
    # Deprecated PayMongo-only evidence retained for historical payments.
    PYMT_PROVIDER_INTENT_ID = models.CharField(max_length=128, null=True, blank=True)
    PYMT_METHOD_TYPE = models.CharField(max_length=32, blank=True, default="")
    PYMT_CARD_BRAND = models.CharField(max_length=24, blank=True, default="")
    PYMT_CARD_LAST4 = models.CharField(
        max_length=4,
        blank=True,
        default="",
        validators=[RegexValidator(r"^[0-9]{4}$", "Provide only the last four card digits.")],
    )
    PYMT_PAID_AT = models.DateTimeField(null=True, blank=True)
    PYMT_VERIFIED_AT = models.DateTimeField(null=True, blank=True)
    PYMT_FULFILLED_AT = models.DateTimeField(null=True, blank=True)
    PYMT_RETRY_AT = models.DateTimeField(null=True, blank=True)
    PYMT_LEASE_UNTIL = models.DateTimeField(null=True, blank=True)
    PYMT_ATTEMPTS = models.PositiveIntegerField(default=0)
    PYMT_LAST_ERROR = models.CharField(max_length=64, blank=True, default="")
    PYMT_CREATED_AT = models.DateTimeField(auto_now_add=True)
    PYMT_UPDATED_AT = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "PAYMENT"
        ordering = ["-PYMT_CREATED_AT", "-PYMT_ID"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(PYMT_AMOUNT_CENTAVOS__gt=0),
                name="payment_positive_amount",
            ),
            models.CheckConstraint(
                condition=models.Q(PYMT_ACCESS_DURATION_DAYS__gt=0),
                name="payment_positive_duration",
            ),
            models.CheckConstraint(
                condition=models.Q(PYMT_CURRENCY="PHP"),
                name="payment_php_currency",
            ),
            models.CheckConstraint(
                condition=models.Q(PYMT_PROVIDER__in=PaymentProvider.values),
                name="payment_valid_provider",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(PYMT_PROVIDER=PaymentProvider.PAYMONGO)
                    | models.Q(PYMT_PROVIDER_INTENT_ID__isnull=True)
                ),
                name="payment_legacy_intent_provider",
            ),
            models.CheckConstraint(
                condition=models.Q(PYMT_MODE__in=PaymentMode.values),
                name="payment_valid_mode",
            ),
            models.CheckConstraint(
                condition=models.Q(PYMT_STATUS__in=["pending", "paid"]),
                name="payment_valid_status",
            ),
            models.CheckConstraint(
                condition=models.Q(PYMT_FULFILMENT_STATUS__in=[
                    "not_started", "pending", "fulfilled", "needs_attention",
                ]),
                name="payment_valid_fulfilment",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(PYMT_STATUS="pending")
                    | (
                        models.Q(
                            PYMT_PROVIDER_PAYMENT_ID__isnull=False,
                            PYMT_PAID_AT__isnull=False,
                            PYMT_VERIFIED_AT__isnull=False,
                        )
                        & ~models.Q(PYMT_PROVIDER_PAYMENT_ID="")
                        & (
                            ~models.Q(PYMT_PROVIDER=PaymentProvider.PAYMONGO)
                            | (
                                models.Q(PYMT_PROVIDER_INTENT_ID__isnull=False)
                                & ~models.Q(PYMT_PROVIDER_INTENT_ID="")
                            )
                        )
                    )
                ),
                name="payment_paid_has_evidence",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(PYMT_STATUS="paid")
                    | models.Q(PYMT_FULFILMENT_STATUS="not_started")
                ),
                name="payment_fulfilment_requires_paid",
            ),
            models.CheckConstraint(
                condition=(
                    ~models.Q(PYMT_FULFILMENT_STATUS="fulfilled")
                    | models.Q(PYMT_FULFILLED_AT__isnull=False)
                ),
                name="payment_fulfilled_has_time",
            ),
            models.UniqueConstraint(
                fields=["PYMT_PROVIDER", "PYMT_MODE", "PYMT_PROVIDER_PAYMENT_ID"],
                condition=models.Q(PYMT_PROVIDER_PAYMENT_ID__isnull=False),
                name="payment_provider_mode_unique",
            ),
            models.UniqueConstraint(
                fields=["BUSN_ID", "PYMT_PRODUCT", "PYMT_MODE"],
                condition=(
                    models.Q(PYMT_STATUS="pending")
                    | models.Q(
                        PYMT_STATUS="paid",
                        PYMT_FULFILMENT_STATUS__in=["not_started", "pending", "needs_attention"],
                    )
                ),
                name="payment_one_unresolved_purchase",
            ),
        ]
        indexes = [
            models.Index(
                fields=["USER_ID", "-PYMT_CREATED_AT", "-PYMT_ID"],
                name="payment_owner_history",
            ),
            models.Index(
                fields=["PYMT_FULFILMENT_STATUS", "PYMT_RETRY_AT"],
                name="payment_fulfilment_due",
            ),
        ]

    def save(
        self,
        *args,
        **kwargs,
    ):
        """Keep the payment identity and product snapshot immutable on saves."""
        if not self._state.adding:
            fields = (
                "PYMT_REFERENCE", "USER_ID_id", "BUSN_ID_id", "PYMT_PRODUCT",
                "PYMT_PRODUCT_VERSION", "PYMT_AMOUNT_CENTAVOS", "PYMT_CURRENCY",
                "PYMT_ACCESS_DURATION_DAYS", "PYMT_PROVIDER", "PYMT_MODE",
            )
            original = type(self).objects.values(*fields).get(pk=self.pk)
            if any(
                getattr(self, field) != original[field]
                for field in fields
            ):
                raise ValidationError("Payment identity and product snapshots cannot be changed.")
        return super().save(*args, **kwargs)


class PaymentCheckoutSession(models.Model):
    """Track checkout creation uncertainty separately from payment evidence."""

    class State(models.TextChoices):
        CREATING = "creating", "Creating"
        CREATION_UNKNOWN = "creation_unknown", "Creation unknown"
        READY = "ready", "Ready"
        CREATION_FAILED = "creation_failed", "Creation failed"
        COMPLETED = "completed", "Completed"
        EXPIRED = "expired", "Expired"

    PCHK_ID = models.BigAutoField(primary_key=True)
    PYMT_ID = models.ForeignKey(
        Payment,
        on_delete=models.PROTECT,
        db_column="PYMT_ID",
        related_name="checkout_sessions",
    )
    PCHK_OPERATION_REFERENCE = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    PCHK_PROVIDER = models.CharField(max_length=8, choices=PaymentProvider.choices)
    PCHK_MODE = models.CharField(max_length=4, choices=PaymentMode.choices)
    PCHK_PROVIDER_SESSION_ID = models.CharField(max_length=128, null=True, blank=True)
    PCHK_CHECKOUT_URL = models.URLField(max_length=2048, blank=True, default="")
    PCHK_STATE = models.CharField(max_length=16, choices=State.choices, default=State.CREATING)
    PCHK_PROVIDER_STATUS = models.CharField(max_length=32, blank=True, default="")
    # Deprecated PayMongo-only observations retained for historical checkouts.
    PCHK_INTENT_ID = models.CharField(max_length=128, null=True, blank=True)
    PCHK_INTENT_STATUS = models.CharField(max_length=40, null=True, blank=True)
    PCHK_LAST_ERROR = models.CharField(max_length=64, blank=True, default="")
    PCHK_LEASE_UNTIL = models.DateTimeField(null=True, blank=True)
    PCHK_CHECKED_AT = models.DateTimeField(null=True, blank=True)
    PCHK_CREATED_AT = models.DateTimeField(auto_now_add=True)
    PCHK_UPDATED_AT = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "PAYMENT_CHECKOUT_SESSION"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(PCHK_PROVIDER__in=PaymentProvider.values),
                name="checkout_valid_provider",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(PCHK_PROVIDER=PaymentProvider.PAYMONGO)
                    | models.Q(
                        PCHK_INTENT_ID__isnull=True,
                        PCHK_INTENT_STATUS__isnull=True,
                    )
                ),
                name="checkout_legacy_intent_provider",
            ),
            models.CheckConstraint(
                condition=models.Q(PCHK_MODE__in=PaymentMode.values),
                name="checkout_valid_mode",
            ),
            models.CheckConstraint(
                condition=models.Q(PCHK_STATE__in=[
                    "creating", "creation_unknown", "ready", "creation_failed", "completed", "expired",
                ]),
                name="checkout_valid_state",
            ),
            models.CheckConstraint(
                condition=(
                    ~models.Q(PCHK_STATE__in=["ready", "completed", "expired"])
                    | (
                        models.Q(PCHK_PROVIDER_SESSION_ID__isnull=False)
                        & ~models.Q(PCHK_PROVIDER_SESSION_ID="")
                    )
                ),
                name="checkout_ready_has_provider",
            ),
            models.UniqueConstraint(
                fields=["PCHK_PROVIDER", "PCHK_MODE", "PCHK_PROVIDER_SESSION_ID"],
                condition=models.Q(PCHK_PROVIDER_SESSION_ID__isnull=False),
                name="checkout_provider_mode_unique",
            ),
            models.UniqueConstraint(
                fields=["PYMT_ID"],
                condition=models.Q(PCHK_STATE__in=["creating", "creation_unknown", "ready"]),
                name="checkout_one_open_operation",
            ),
        ]
        indexes = [
            models.Index(
                fields=["PCHK_STATE", "PCHK_LEASE_UNTIL"],
                name="checkout_creation_recovery",
            ),
        ]

    def clean(self):
        """Require a checkout to share its payment's provider and mode."""
        super().clean()
        if self.PYMT_ID_id:
            if self.PCHK_PROVIDER != self.PYMT_ID.PYMT_PROVIDER:
                raise ValidationError({"PCHK_PROVIDER": "Checkout provider must match its payment."})
            if self.PCHK_MODE != self.PYMT_ID.PYMT_MODE:
                raise ValidationError({"PCHK_MODE": "Checkout mode must match its payment."})

    def save(
        self,
        *args,
        **kwargs,
    ):
        """Preserve the operation identity when updating provider observations."""
        self.clean()
        if not self._state.adding:
            fields = (
                "PCHK_OPERATION_REFERENCE",
                "PYMT_ID_id",
                "PCHK_PROVIDER",
                "PCHK_MODE",
            )
            original = type(self).objects.values(*fields).get(pk=self.pk)
            if any(
                getattr(self, field) != original[field]
                for field in fields
            ):
                raise ValidationError("Checkout operation identity cannot be changed.")
        return super().save(*args, **kwargs)


class PaymentProviderEvent(models.Model):
    """Retain deduplicated normalized evidence for future durable processing."""

    class State(models.TextChoices):
        QUEUED = "queued", "Queued"
        PROCESSING = "processing", "Processing"
        PROCESSED = "processed", "Processed"
        IGNORED = "ignored", "Ignored"
        NEEDS_ATTENTION = "needs_attention", "Needs attention"

    PWEV_ID = models.BigAutoField(primary_key=True)
    PWEV_PROVIDER = models.CharField(max_length=8, choices=PaymentProvider.choices)
    PWEV_DEDUPE_KEY = models.CharField(max_length=128)
    PWEV_TYPE = models.CharField(max_length=100)
    PWEV_MODE = models.CharField(max_length=4, choices=PaymentMode.choices)
    PWEV_PROVIDER_CHECKOUT_ID = models.CharField(max_length=128, blank=True, default="")
    PYMT_ID = models.ForeignKey(
        Payment,
        on_delete=models.PROTECT,
        db_column="PYMT_ID",
        related_name="provider_events",
        null=True,
        blank=True,
    )
    PCHK_ID = models.ForeignKey(
        PaymentCheckoutSession,
        on_delete=models.PROTECT,
        db_column="PCHK_ID",
        related_name="provider_events",
        null=True,
        blank=True,
    )
    PWEV_DATA = models.JSONField(default=dict, validators=[validate_event_data])
    PWEV_PAYLOAD_DIGEST = models.CharField(
        max_length=64,
        validators=[RegexValidator(r"^[0-9a-f]{64}$", "Provide a SHA-256 payload digest.")],
    )
    PWEV_STATE = models.CharField(max_length=16, choices=State.choices, default=State.QUEUED)
    PWEV_ATTEMPTS = models.PositiveIntegerField(default=0)
    PWEV_RETRY_AT = models.DateTimeField(null=True, blank=True)
    PWEV_LEASE_UNTIL = models.DateTimeField(null=True, blank=True)
    PWEV_LAST_ERROR = models.CharField(max_length=64, blank=True, default="")
    PWEV_PROVIDER_CREATED_AT = models.DateTimeField(null=True, blank=True)
    PWEV_RECEIVED_AT = models.DateTimeField(auto_now_add=True)
    PWEV_PROCESSED_AT = models.DateTimeField(null=True, blank=True)
    PWEV_CREATED_AT = models.DateTimeField(auto_now_add=True)
    PWEV_UPDATED_AT = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "PAYMENT_PROVIDER_EVENT"
        constraints = [
            models.UniqueConstraint(
                fields=["PWEV_PROVIDER", "PWEV_MODE", "PWEV_DEDUPE_KEY"],
                name="provider_event_dedupe_unique",
            ),
            models.CheckConstraint(
                condition=models.Q(PWEV_PROVIDER__in=PaymentProvider.values),
                name="provider_event_valid_provider",
            ),
            models.CheckConstraint(
                condition=models.Q(PWEV_MODE__in=PaymentMode.values),
                name="provider_event_valid_mode",
            ),
            models.CheckConstraint(
                condition=models.Q(PWEV_STATE__in=[
                    "queued", "processing", "processed", "ignored", "needs_attention",
                ]),
                name="provider_event_valid_state",
            ),
            models.CheckConstraint(
                condition=(
                    ~models.Q(PWEV_STATE__in=["processed", "ignored"])
                    | models.Q(PWEV_PROCESSED_AT__isnull=False)
                ),
                name="provider_event_processed_time",
            ),
        ]
        indexes = [
            models.Index(
                fields=["PWEV_STATE", "PWEV_RETRY_AT"],
                name="provider_event_due",
            ),
            models.Index(
                fields=["PWEV_PROVIDER", "PWEV_MODE", "PWEV_PROVIDER_CHECKOUT_ID"],
                name="provider_event_checkout",
            ),
        ]

    @classmethod
    def record_delivery(
        cls,
        *,
        provider,
        mode,
        dedupe_key,
        event_type,
        data,
        payload_digest,
        provider_checkout_id="",
        provider_created_at=None,
    ):
        """Store a normalized delivery once and flag conflicting evidence for reconciliation."""
        if not dedupe_key:
            raise ValidationError("A provider event deduplication key is required.")
        validate_event_data(data)
        event, created = cls.objects.get_or_create(
            PWEV_PROVIDER=provider,
            PWEV_MODE=mode,
            PWEV_DEDUPE_KEY=dedupe_key,
            defaults={
                "PWEV_TYPE": event_type,
                "PWEV_PROVIDER_CHECKOUT_ID": provider_checkout_id,
                "PWEV_DATA": data,
                "PWEV_PAYLOAD_DIGEST": payload_digest,
                "PWEV_PROVIDER_CREATED_AT": provider_created_at,
            },
        )
        if not created and (
            event.PWEV_TYPE != event_type
            or event.PWEV_PROVIDER_CHECKOUT_ID != provider_checkout_id
            or json.dumps(event.PWEV_DATA, sort_keys=True) != json.dumps(data, sort_keys=True)
        ):
            raise ValidationError(
                "Provider event evidence conflicts with a previous delivery.",
                code="provider_event_evidence_conflict",
            )
        return event, created

    def clean(self):
        """Keep normalized event data and matched financial relationships consistent."""
        super().clean()
        validate_event_data(self.PWEV_DATA)
        self._meta.get_field("PWEV_PAYLOAD_DIGEST").run_validators(self.PWEV_PAYLOAD_DIGEST)
        if (
            self.PYMT_ID_id
            and (
                self.PWEV_PROVIDER != self.PYMT_ID.PYMT_PROVIDER
                or self.PWEV_MODE != self.PYMT_ID.PYMT_MODE
            )
        ):
            raise ValidationError("Event provider and mode must match its payment.")
        if self.PCHK_ID_id:
            session = self.PCHK_ID
            if (
                session.PCHK_PROVIDER != self.PWEV_PROVIDER
                or session.PCHK_MODE != self.PWEV_MODE
                or (
                    self.PYMT_ID_id
                    and session.PYMT_ID_id != self.PYMT_ID_id
                )
                or (
                    self.PWEV_PROVIDER_CHECKOUT_ID
                    and session.PCHK_PROVIDER_SESSION_ID != self.PWEV_PROVIDER_CHECKOUT_ID
                )
            ):
                raise ValidationError("Event checkout relationships must agree.")

    def save(
        self,
        *args,
        **kwargs,
    ):
        """Validate inbox evidence and preserve the original delivery on processing updates."""
        self.clean()
        if not self._state.adding:
            fields = (
                "PWEV_PROVIDER",
                "PWEV_MODE",
                "PWEV_DEDUPE_KEY",
                "PWEV_TYPE",
                "PWEV_PROVIDER_CHECKOUT_ID",
                "PWEV_DATA",
                "PWEV_PAYLOAD_DIGEST",
                "PWEV_PROVIDER_CREATED_AT",
            )
            original = type(self).objects.values(*fields).get(pk=self.pk)
            if any(
                getattr(self, field) != original[field]
                for field in fields
            ):
                raise ValidationError("Original provider event evidence cannot be changed.")
        return super().save(*args, **kwargs)
