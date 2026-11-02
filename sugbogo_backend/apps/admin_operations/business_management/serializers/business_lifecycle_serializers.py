"""Validated transition commands and explicit private lifecycle response contracts."""

from rest_framework import serializers

from apps.admin_operations.activity_management.models import AdminActivity


class BusinessTransitionSerializer(serializers.Serializer):
    """Require the last observed transition identity, including zero for initial state."""

    expected_transition_id = serializers.IntegerField(min_value=0)

    def validate_expected_transition_id(
        self,
        value,
    ):
        """Reject booleans rather than coercing them into activity identifiers."""
        if isinstance(self.initial_data.get("expected_transition_id"), bool):
            raise serializers.ValidationError("Use a nonnegative transition ID.")
        return value


class BusinessSuspendSerializer(BusinessTransitionSerializer):
    """Require a bounded, merchant-facing suspension explanation."""

    reason = serializers.CharField(
        max_length=1000,
        trim_whitespace=True,
        allow_blank=False,
    )


class BusinessStatusSerializer(serializers.Serializer):
    """Expose authoritative state without private internal metadata."""

    business_id = serializers.IntegerField()
    status = serializers.CharField()
    updated_at = serializers.DateTimeField()
    transition_id = serializers.IntegerField()
    owner_account_status = serializers.CharField()
    suspension_reason = serializers.CharField(allow_null=True)


class BusinessTransitionHistorySerializer(serializers.ModelSerializer):
    """Return business-scoped immutable events and the responsible administrator."""

    id = serializers.IntegerField(source="AACT_ID")
    action = serializers.CharField(source="AACT_ACTION")
    actor_id = serializers.IntegerField(source="ACTOR_ID_id")
    actor_name = serializers.CharField(source="ACTOR_ID.full_name")
    owner_id = serializers.IntegerField(source="TARGET_USER_ID_id")
    business_id = serializers.IntegerField(source="AACT_CONTEXT.business_id")
    previous_status = serializers.CharField(source="AACT_CONTEXT.previous_status")
    status = serializers.CharField(source="AACT_CONTEXT.status")
    reason = serializers.CharField(source="AACT_CONTEXT.reason", allow_null=True)
    created_at = serializers.DateTimeField(source="AACT_CREATED_AT")

    class Meta:
        model = AdminActivity
        fields = (
            "id",
            "action",
            "actor_id",
            "actor_name",
            "owner_id",
            "business_id",
            "previous_status",
            "status",
            "reason",
            "created_at",
        )
