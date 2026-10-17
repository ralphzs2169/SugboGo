"""Typed configuration commands and private revision-history output."""

from rest_framework import serializers

from .models import AnalyticsPolicyChange
from .services.analytics_policy_service import AnalyticsPolicyService


class StrictPositiveIntegerField(serializers.IntegerField):
    """Accept JSON integer versions without treating booleans or strings as versions."""

    def to_internal_value(self, data):
        """Validate the uncoerced input before applying normal integer bounds."""
        if type(data) is not int:
            self.fail("invalid")
        return super().to_internal_value(data)


class AnalyticsPolicyUpdateSerializer(serializers.Serializer):
    """Require concurrency evidence, a human reason, and an allowlisted integer changeset."""

    expected_version = StrictPositiveIntegerField(min_value=1)
    reason = serializers.CharField(max_length=1000, trim_whitespace=True)
    values = serializers.JSONField()

    def to_internal_value(self, data):
        """Reject ignored metadata or attempts to update non-policy controls."""
        if isinstance(data, dict):
            unknown = set(data) - set(self.fields)
            if unknown:
                raise serializers.ValidationError({key: "Unknown field." for key in unknown})
        return super().to_internal_value(data)

    def validate_values(self, values):
        """Enforce the same integer rules used by the domain update service."""
        AnalyticsPolicyService.validate_values(values)
        return values


class AnalyticsPolicyChangeSerializer(serializers.ModelSerializer):
    """Expose private administrator audit metadata without returning user profiles."""

    version = serializers.IntegerField(source="APCH_VERSION", read_only=True)
    actor_id = serializers.IntegerField(source="APCH_ACTOR_ID_SNAPSHOT", read_only=True, allow_null=True)
    reason = serializers.CharField(source="APCH_REASON", read_only=True)
    before = serializers.JSONField(source="APCH_BEFORE", read_only=True)
    after = serializers.JSONField(source="APCH_AFTER", read_only=True)
    changed_at = serializers.DateTimeField(source="APCH_CREATED_AT", read_only=True)

    class Meta:
        model = AnalyticsPolicyChange
        fields = ("version", "actor_id", "reason", "before", "after", "changed_at")
