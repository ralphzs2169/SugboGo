"""Strict demo-only inputs and stored-versus-effective access responses."""

from rest_framework import serializers

from .standard_analytics_serializers import OwnedBusinessSerializer


class EmptyPlusInputSerializer(serializers.Serializer):
    """Accept no client ownership, entitlement, payment, or policy overrides."""

    def validate(self, attrs):
        """Reject fields that the declared API does not accept."""
        unknown = set(self.initial_data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError({key: "Unsupported Merchant Plus parameter." for key in sorted(unknown)})
        return attrs


class MockPlusActivationSerializer(EmptyPlusInputSerializer):
    """Accept only an explicitly simulated outcome, never payment credentials."""

    outcome = serializers.ChoiceField(choices=("success", "failure", "cancelled"))


class MerchantPlusStatusSerializer(serializers.Serializer):
    """Keep demo state, preview bypass, and effective Plus access visibly distinct."""

    business = OwnedBusinessSerializer()
    stored_demo_state = serializers.ChoiceField(choices=("not_created", "inactive", "active"))
    effective_tier = serializers.ChoiceField(choices=("standard", "plus"))
    has_plus_access = serializers.BooleanField()
    access_source = serializers.ChoiceField(choices=("none", "preview", "mock"))
    enforcement_enabled = serializers.BooleanField()
    mock_enabled = serializers.BooleanField()
    is_simulation = serializers.BooleanField()
    activated_at = serializers.DateTimeField(allow_null=True)
    reset_at = serializers.DateTimeField(allow_null=True)
    updated_at = serializers.DateTimeField(allow_null=True)


class MockPlusMutationSerializer(serializers.Serializer):
    """Expose the simulated outcome and whether persisted state actually changed."""

    outcome = serializers.ChoiceField(choices=("success", "failure", "cancelled", "reset"))
    changed = serializers.BooleanField()
    status = MerchantPlusStatusSerializer()
