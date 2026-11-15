"""Explicit read-only payment projections; provider payloads never leave storage."""

from datetime import date

from django.utils import timezone
from rest_framework import serializers

from apps.merchant_operations.merchant_analytics.services.merchant_plus_status_service import (
    MerchantPlusStatusService,
)
from apps.payments.models import Payment, PaymentMode, PaymentProvider


class PaymentInspectionFilterSerializer(serializers.Serializer):
    """Validate directory criteria and inclusive Philippine calendar bounds."""

    search = serializers.CharField(required=False, allow_blank=True, max_length=200)
    financial_status = serializers.ChoiceField(choices=Payment.Status.choices, required=False)
    fulfilment_status = serializers.ChoiceField(
        choices=Payment.FulfilmentStatus.choices,
        required=False,
    )
    provider = serializers.ChoiceField(choices=PaymentProvider.choices, required=False)
    mode = serializers.ChoiceField(choices=PaymentMode.choices, required=False)
    checkout_outcome = serializers.ChoiceField(
        choices=("pending", "cancelled", "failed", "expired", "unknown"),
        required=False,
    )
    needs_review = serializers.BooleanField(required=False)
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)
    ordering = serializers.ChoiceField(
        choices=("newest", "oldest", "amount_highest", "amount_lowest"),
        default="newest",
    )

    def validate(
        self,
        attrs,
    ):
        """Reject reversed dates and unsupported exclusive upper bounds."""
        start = attrs.get("start_date")
        end = attrs.get("end_date")
        if end == date.max:
            raise serializers.ValidationError({
                "end_date": "Enter a date before 9999-12-31.",
            })
        if (
            start is not None
            and end is not None
            and start > end
        ):
            raise serializers.ValidationError({
                "end_date": "End date must be on or after start date.",
            })
        return attrs


class PaymentInspectionListSerializer(serializers.ModelSerializer):
    """Expose only identities and operational states used by the Admin directory."""

    id = serializers.IntegerField(source="PYMT_ID", read_only=True)
    reference = serializers.UUIDField(source="PYMT_REFERENCE", read_only=True)
    merchant = serializers.SerializerMethodField()
    business = serializers.SerializerMethodField()
    provider = serializers.CharField(source="PYMT_PROVIDER", read_only=True)
    mode = serializers.CharField(source="PYMT_MODE", read_only=True)
    amount_centavos = serializers.IntegerField(source="PYMT_AMOUNT_CENTAVOS", read_only=True)
    currency = serializers.CharField(source="PYMT_CURRENCY", read_only=True)
    financial_status = serializers.CharField(source="PYMT_STATUS", read_only=True)
    fulfilment_status = serializers.CharField(source="PYMT_FULFILMENT_STATUS", read_only=True)
    checkout_state = serializers.CharField(read_only=True, allow_null=True)
    checkout_outcome = serializers.CharField(read_only=True, allow_null=True)
    needs_review = serializers.BooleanField(read_only=True)
    created_at = serializers.DateTimeField(source="PYMT_CREATED_AT", read_only=True)

    class Meta:
        model = Payment
        fields = (
            "id", "reference", "merchant", "business", "provider", "mode",
            "amount_centavos", "currency", "financial_status", "fulfilment_status",
            "checkout_state", "checkout_outcome", "needs_review", "created_at",
        )

    def get_merchant(
        self,
        payment,
    ):
        """Project the purchaser's existing Admin-visible identity without profile data."""
        return {
            "id": payment.USER_ID_id,
            "name": payment.USER_ID.full_name,
            "email": payment.USER_ID.USER_EMAIL,
        }

    def get_business(
        self,
        payment,
    ):
        """Project only the business identity needed to inspect the purchase."""
        return {
            "id": payment.BUSN_ID_id,
            "name": payment.BUSN_ID.BUSN_NAME,
        }


class PaymentInspectionDetailSerializer(PaymentInspectionListSerializer):
    """Extend the row with allowlisted checkout, financial, access, and inbox evidence."""

    product = serializers.CharField(source="PYMT_PRODUCT", read_only=True)
    product_version = serializers.CharField(source="PYMT_PRODUCT_VERSION", read_only=True)
    access_duration_days = serializers.IntegerField(
        source="PYMT_ACCESS_DURATION_DAYS",
        read_only=True,
    )
    paid_at = serializers.DateTimeField(source="PYMT_PAID_AT", read_only=True)
    verified_at = serializers.DateTimeField(source="PYMT_VERIFIED_AT", read_only=True)
    fulfilled_at = serializers.DateTimeField(source="PYMT_FULFILLED_AT", read_only=True)
    checkouts = serializers.SerializerMethodField()
    verification = serializers.SerializerMethodField()
    entitlement = serializers.SerializerMethodField()
    events = serializers.SerializerMethodField()

    class Meta(PaymentInspectionListSerializer.Meta):
        fields = PaymentInspectionListSerializer.Meta.fields + (
            "product", "product_version", "access_duration_days", "paid_at",
            "verified_at", "fulfilled_at", "checkouts", "verification", "entitlement", "events",
        )

    def get_checkouts(
        self,
        payment,
    ):
        """Retain every stored operation without returning a hosted checkout URL."""
        return [
            {
                "id": checkout.pk,
                "operation_reference": checkout.PCHK_OPERATION_REFERENCE,
                "provider": checkout.PCHK_PROVIDER,
                "mode": checkout.PCHK_MODE,
                "state": checkout.PCHK_STATE,
                "outcome": MerchantPlusStatusService.checkout_outcome(payment, checkout),
                "provider_session_id": checkout.PCHK_PROVIDER_SESSION_ID,
                "provider_status": checkout.PCHK_PROVIDER_STATUS,
                "created_at": checkout.PCHK_CREATED_AT,
                "updated_at": checkout.PCHK_UPDATED_AT,
                "checked_at": checkout.PCHK_CHECKED_AT,
                "lease_until": checkout.PCHK_LEASE_UNTIL,
            }
            for checkout in payment.inspection_checkouts
        ]

    def get_verification(
        self,
        payment,
    ):
        """Describe persisted successful-payment evidence without recontacting a provider."""
        verified = (
            payment.PYMT_STATUS == "paid"
            and bool(payment.PYMT_PROVIDER_PAYMENT_ID)
            and payment.PYMT_VERIFIED_AT is not None
            and payment.PYMT_PAID_AT is not None
        )
        matching = [
            checkout
            for checkout in payment.inspection_checkouts
            if checkout.PCHK_STATE == "completed"
            and (
                (
                    payment.PYMT_PROVIDER == "maya"
                    and checkout.PCHK_PROVIDER_SESSION_ID == payment.PYMT_PROVIDER_PAYMENT_ID
                )
                or (
                    payment.PYMT_PROVIDER == "paymongo"
                    and bool(payment.PYMT_PROVIDER_INTENT_ID)
                    and checkout.PCHK_INTENT_ID == payment.PYMT_PROVIDER_INTENT_ID
                )
            )
        ]
        request_reference = None
        amount = None
        currency = None
        if verified:
            amount = payment.PYMT_AMOUNT_CENTAVOS
            currency = payment.PYMT_CURRENCY
            if matching:
                request_reference = matching[-1].PCHK_OPERATION_REFERENCE
        return {
            "verified": verified,
            "provider_payment_id": payment.PYMT_PROVIDER_PAYMENT_ID,
            "amount_centavos": amount,
            "currency": currency,
            "request_reference": request_reference,
            "verified_at": payment.PYMT_VERIFIED_AT,
            "payment_method": payment.PYMT_METHOD_TYPE or None,
            "card_brand": payment.PYMT_CARD_BRAND or None,
        }

    def get_entitlement(
        self,
        payment,
    ):
        """Describe access in the record's stored mode, independently of active provider settings."""
        entitlement = getattr(payment, "paid_plus_entitlement", None)
        if entitlement is None:
            return None
        now = timezone.now()
        active = (
            payment.PYMT_STATUS == "paid"
            and payment.PYMT_FULFILMENT_STATUS == "fulfilled"
            and entitlement.BUSN_ID_id == payment.BUSN_ID_id
            and payment.BUSN_ID.USER_ID_id == payment.USER_ID_id
            and entitlement.MPPE_STARTS_AT <= now < entitlement.MPPE_EXPIRES_AT
        )
        return {
            "id": entitlement.pk,
            "access_source": f"{payment.PYMT_PROVIDER}_{payment.PYMT_MODE}",
            "starts_at": entitlement.MPPE_STARTS_AT,
            "expires_at": entitlement.MPPE_EXPIRES_AT,
            "created_at": entitlement.MPPE_CREATED_AT,
            "active_in_stored_mode": active,
        }

    def get_events(
        self,
        payment,
    ):
        """Project chronological processing metadata without payloads, digests, or headers."""
        return [
            {
                "id": event.pk,
                "type": event.PWEV_TYPE,
                "provider": event.PWEV_PROVIDER,
                "mode": event.PWEV_MODE,
                "state": event.PWEV_STATE,
                "needs_review": event.PWEV_STATE == "needs_attention",
                "has_conflict": event.PWEV_LAST_ERROR in {
                    "conflicting_delivery",
                    "payment_evidence_conflict",
                    "paid_payment_identity_mismatch",
                },
                "attempts": event.PWEV_ATTEMPTS,
                "provider_created_at": event.PWEV_PROVIDER_CREATED_AT,
                "received_at": event.PWEV_RECEIVED_AT,
                "processed_at": event.PWEV_PROCESSED_AT,
                "retry_at": event.PWEV_RETRY_AT,
                "lease_until": event.PWEV_LEASE_UNTIL,
            }
            for event in payment.inspection_events
        ]
