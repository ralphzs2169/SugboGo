from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers

from apps.users.models import User


class AdminUserListQuerySerializer(serializers.Serializer):
    """Validates administrator user-list query parameters."""

    search = serializers.CharField(
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )
    role = serializers.ChoiceField(
        choices=User.UserRole.choices,
        required=False,
    )
    status = serializers.ChoiceField(
        choices=User.UserStatus.choices,
        required=False,
    )
    ordering = serializers.ChoiceField(
        choices=(
            "name",
            "-name",
            "email",
            "-email",
            "role",
            "-role",
            "status",
            "-status",
            "joined_at",
            "-joined_at",
        ),
        required=False,
    )


class AdminUserListSerializer(serializers.ModelSerializer):
    """Serializes a user row for the administrator user table."""

    id = serializers.IntegerField(
        source="USER_ID",
        read_only=True,
    )
    first_name = serializers.CharField(
        source="USER_FNAME",
        read_only=True,
    )
    last_name = serializers.CharField(
        source="USER_LNAME",
        read_only=True,
    )
    name = serializers.CharField(
        source="full_name",
        read_only=True,
    )
    email = serializers.EmailField(
        source="USER_EMAIL",
        read_only=True,
    )
    role = serializers.CharField(
        source="USER_ROLE",
        read_only=True,
    )
    status = serializers.CharField(
        source="USER_STATUS",
        read_only=True,
    )
    avatar_url = serializers.ReadOnlyField()
    avatar_key = serializers.CharField(
        source="USER_AVATAR_KEY",
        read_only=True,
        allow_null=True,
    )
    joined_at = serializers.DateTimeField(
        source="USER_CREATED_AT",
        read_only=True,
    )

    class Meta:
        model = User
        fields = (
            "id",
            "first_name",
            "last_name",
            "name",
            "email",
            "role",
            "status",
            "avatar_url",
            "avatar_key",
            "joined_at",
        )


class AdminMerchantApplicationSummarySerializer(serializers.Serializer):
    """Serializes the merchant application relationship shown on a user."""

    id = serializers.IntegerField(
        source="MAPP_ID",
        read_only=True,
    )
    status = serializers.CharField(
        source="MAPP_STATUS",
        read_only=True,
    )


class AdminOwnedBusinessSummarySerializer(serializers.Serializer):
    """Serializes the owned business relationship shown on a user."""

    id = serializers.IntegerField(
        source="BUSN_ID",
        read_only=True,
    )
    name = serializers.CharField(
        source="BUSN_NAME",
        read_only=True,
    )
    status = serializers.CharField(
        source="BUSN_STATUS",
        read_only=True,
    )


class AdminUserDetailSerializer(AdminUserListSerializer):
    """Serializes the complete administrator-facing user profile."""

    middle_initial = serializers.CharField(
        source="USER_MI",
        read_only=True,
        allow_null=True,
    )
    gender = serializers.CharField(
        source="USER_GENDER",
        read_only=True,
        allow_null=True,
    )
    email_verified = serializers.BooleanField(
        source="EMAIL_VERIFIED",
        read_only=True,
    )
    email_verified_at = serializers.DateTimeField(
        source="EMAIL_VERIFIED_AT",
        read_only=True,
        allow_null=True,
    )
    reputation = serializers.DecimalField(
        source="USER_REPUTATION",
        max_digits=6,
        decimal_places=5,
        read_only=True,
    )
    application = serializers.SerializerMethodField()
    business = serializers.SerializerMethodField()
    activity_summary = serializers.SerializerMethodField()

    def get_application(self, obj):
        applications = getattr(
            obj,
            "admin_merchant_applications",
            [],
        )

        if not applications:
            return None

        return AdminMerchantApplicationSummarySerializer(
            applications[0],
        ).data

    def get_business(self, obj):
        try:
            business = obj.owned_business
        except ObjectDoesNotExist:
            return None

        return AdminOwnedBusinessSummarySerializer(
            business,
        ).data

    def get_activity_summary(self, obj):
        summary = {
            "reviews": getattr(obj, "admin_review_count", 0),
            "vouches": getattr(obj, "admin_vouch_count", 0),
            "reports": getattr(obj, "admin_report_count", 0),
        }

        if obj.USER_ROLE == User.UserRole.MERCHANT:
            summary["review_disputes"] = getattr(
                obj,
                "admin_review_dispute_count",
                0,
            )

        return summary

    class Meta(AdminUserListSerializer.Meta):
        fields = AdminUserListSerializer.Meta.fields + (
            "middle_initial",
            "gender",
            "email_verified",
            "email_verified_at",
            "reputation",
            "application",
            "business",
            "activity_summary",
        )


class AdminUserSuspendSerializer(serializers.Serializer):
    """Validates the required reason for suspending a user."""

    reason = serializers.CharField(
        required=True,
        allow_blank=False,
        allow_null=False,
        trim_whitespace=True,
        max_length=1000,
        error_messages={
            "required": "Please provide a reason for suspending this user.",
            "blank": "Please provide a reason for suspending this user.",
            "null": "Please provide a reason for suspending this user.",
        },
    )


class AdminUserActivityQuerySerializer(serializers.Serializer):
    """Validates the requested number of recent user activities."""

    limit = serializers.IntegerField(
        required=False,
        min_value=1,
        max_value=50,
        default=20,
    )


class AdminUserActivitySerializer(serializers.Serializer):
    """Serializes one normalized user-generated activity item."""

    type = serializers.CharField()
    timestamp = serializers.DateTimeField()
    description_data = serializers.JSONField()
