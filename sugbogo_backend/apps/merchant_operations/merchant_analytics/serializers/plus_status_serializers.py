"""Add paid-access metadata without reshaping existing analytics status fields."""

from rest_framework import serializers

from apps.payments.models import PaymentMode, PaymentProvider

from .mock_plus_serializers import MerchantPlusStatusSerializer


class MerchantPlusProductSerializer(serializers.Serializer):
    """Describe the single server-priced one-time product."""

    code = serializers.CharField()
    version = serializers.CharField()
    name = serializers.CharField()
    amount_centavos = serializers.IntegerField()
    currency = serializers.CharField()
    access_duration_days = serializers.IntegerField()
    payment_type = serializers.CharField()


class MerchantPlusAccessStatusSerializer(MerchantPlusStatusSerializer):
    """Keep legacy demo metadata while identifying independent paid purchases."""

    access_source = serializers.ChoiceField(
        choices=("none", "preview", "mock", "paymongo_test", "paymongo_live", "maya_test", "maya_live"),
    )
    payment_mode = serializers.ChoiceField(choices=PaymentMode.values)
    checkout_enabled = serializers.BooleanField()
    checkout_can_resume = serializers.BooleanField()
    product = MerchantPlusProductSerializer()
    entitlement_starts_at = serializers.DateTimeField(allow_null=True)
    entitlement_expires_at = serializers.DateTimeField(allow_null=True)
    paid_payment_id = serializers.IntegerField(allow_null=True)
    paid_payment_reference = serializers.UUIDField(allow_null=True)
    unresolved_payment_id = serializers.IntegerField(allow_null=True)
    unresolved_payment_reference = serializers.UUIDField(allow_null=True)
    unresolved_payment_provider = serializers.ChoiceField(
        choices=PaymentProvider.values,
        allow_null=True,
    )
    unresolved_payment_mode = serializers.ChoiceField(
        choices=PaymentMode.values,
        allow_null=True,
    )
    unresolved_payment_status = serializers.CharField(allow_null=True)
    unresolved_fulfilment_status = serializers.CharField(allow_null=True)
    unresolved_checkout_status = serializers.CharField(allow_null=True)
    checkout_outcome = serializers.ChoiceField(
        choices=("pending", "cancelled", "failed", "expired", "unknown"),
        allow_null=True,
    )
    purchase_eligible = serializers.BooleanField()
    purchase_ineligibility_reason = serializers.CharField(allow_null=True)
