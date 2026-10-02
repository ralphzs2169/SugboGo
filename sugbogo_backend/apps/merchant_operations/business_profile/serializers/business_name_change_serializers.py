from rest_framework import serializers

from apps.merchant_operations.business_profile.models import (
    BusinessNameChangeRequest,
)
from apps.users.models import User


class BusinessNameChangeCreateSerializer(serializers.Serializer):
    """Validate a proposed name using the registration name field rules."""

    proposed_business_name = serializers.CharField(
        min_length=2,
        max_length=150,
        trim_whitespace=True,
        error_messages={
            "blank": "Business name is required.",
            "required": "Business name is required.",
            "min_length": "Business name must be at least 2 characters.",
        },
    )


class BusinessNameChangeRejectSerializer(serializers.Serializer):
    """Require a concise reason that can be displayed to the merchant."""

    rejection_reason = serializers.CharField(
        min_length=1,
        max_length=1000,
        trim_whitespace=True,
    )


class MerchantBusinessNameChangeSerializer(serializers.ModelSerializer):
    """Expose the merchant's request without internal reviewer details."""

    id = serializers.IntegerField(source="BNCR_ID", read_only=True)
    request_type = serializers.SerializerMethodField()
    previous_business_name = serializers.CharField(
        source="BNCR_PREVIOUS_BUSINESS_NAME",
        read_only=True,
    )
    proposed_business_name = serializers.CharField(
        source="BNCR_PROPOSED_BUSINESS_NAME",
        read_only=True,
    )
    status = serializers.CharField(source="BNCR_STATUS", read_only=True)
    submitted_at = serializers.DateTimeField(
        source="BNCR_SUBMITTED_AT",
        read_only=True,
    )
    resolved_at = serializers.DateTimeField(
        source="BNCR_RESOLVED_AT",
        read_only=True,
    )
    rejection_reason = serializers.CharField(
        source="BNCR_REJECTION_REASON",
        read_only=True,
    )

    class Meta:
        model = BusinessNameChangeRequest
        fields = (
            "id",
            "request_type",
            "previous_business_name",
            "proposed_business_name",
            "status",
            "submitted_at",
            "resolved_at",
            "rejection_reason",
        )

    def get_request_type(self, obj):
        """Identify the only supported sensitive change type."""
        return "business_name"


class BusinessNameChangeUserSerializer(serializers.ModelSerializer):
    """Summarize the merchant or reviewer for Admin review."""

    id = serializers.IntegerField(source="USER_ID", read_only=True)
    name = serializers.CharField(source="full_name", read_only=True)
    email = serializers.EmailField(source="USER_EMAIL", read_only=True)

    class Meta:
        model = User
        fields = ("id", "name", "email")


class AdminBusinessNameChangeSerializer(MerchantBusinessNameChangeSerializer):
    """Include live business context and decision metadata for Admin."""

    business_id = serializers.IntegerField(
        source="BUSN_ID_id",
        read_only=True,
    )
    current_business_name = serializers.CharField(
        source="BUSN_ID.BUSN_NAME",
        read_only=True,
    )
    merchant = BusinessNameChangeUserSerializer(
        source="USER_ID",
        read_only=True,
    )
    reviewer = BusinessNameChangeUserSerializer(
        source="REVIEWER_ID",
        read_only=True,
    )

    class Meta(MerchantBusinessNameChangeSerializer.Meta):
        fields = MerchantBusinessNameChangeSerializer.Meta.fields + (
            "business_id",
            "current_business_name",
            "merchant",
            "reviewer",
        )
