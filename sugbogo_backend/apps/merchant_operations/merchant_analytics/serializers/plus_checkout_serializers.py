"""Strict checkout input and safe Merchant-owned checkout presentation."""

from rest_framework import serializers

from .mock_plus_serializers import EmptyPlusInputSerializer


class MerchantPlusCheckoutInputSerializer(EmptyPlusInputSerializer):
    """Require an explicitly empty JSON object with no purchase overrides."""

    def to_internal_value(
        self,
        data,
    ):
        """Reject JSON arrays, null, and all unsupported input fields."""
        if not isinstance(data, dict):
            raise serializers.ValidationError({
                "non_field_errors": ["An empty JSON object is required."],
            })
        return super().to_internal_value(data)


class CheckoutProductSerializer(serializers.Serializer):
    """Identify the fixed server-controlled product."""

    code = serializers.CharField()
    name = serializers.CharField()


class MerchantPlusCheckoutSerializer(serializers.Serializer):
    """Expose checkout instructions without provider payloads or financial mutations."""

    payment_id = serializers.IntegerField()
    payment_reference = serializers.UUIDField()
    product = CheckoutProductSerializer()
    amount_centavos = serializers.IntegerField()
    currency = serializers.CharField()
    mode = serializers.CharField()
    payment_status = serializers.CharField()
    fulfilment_status = serializers.CharField()
    checkout_status = serializers.CharField()
    checkout_session_id = serializers.CharField(allow_null=True)
    checkout_url = serializers.CharField(allow_null=True)
    next_action = serializers.CharField()
    status_check_after_seconds = serializers.IntegerField(allow_null=True)
