from rest_framework import serializers

from apps.business.models import Business
from apps.merchant_operations.business_profile.helpers import (
    get_cover_photo_retry_after,
)

MAX_COVER_PHOTO_SIZE = 10 * 1024 * 1024  # 10 MB


class BusinessCoverPhotoSerializer(serializers.Serializer):
    """Validates a merchant business cover photo upload."""

    cover_photo = serializers.ImageField(
        required=True,
    )

    def validate_cover_photo(self, value):
        """Ensure the cover photo does not exceed the upload size limit."""

        if value.size > MAX_COVER_PHOTO_SIZE:
            raise serializers.ValidationError(
                "Cover photo must be 10 MB or smaller.",
            )

        return value


class BusinessCoverPhotoResponseSerializer(serializers.ModelSerializer):
    """Serializes the current business cover photo."""

    cover_photo_url = serializers.URLField(
        source="BUSN_COVER_PHOTO_URL",
        read_only=True,
        allow_null=True,
    )

    cover_photo_retry_after = serializers.SerializerMethodField()

    class Meta:
        model = Business
        fields = (
            "cover_photo_url",
            "cover_photo_retry_after",
        )

    def get_cover_photo_retry_after(self, obj):
        return get_cover_photo_retry_after(
            self.context.get("request"),
        )


class BusinessProfileResponseSerializer(serializers.ModelSerializer):
    """Serializes the merchant's business profile information."""

    business_name = serializers.CharField(
        source="BUSN_NAME",
        read_only=True,
    )

    cover_photo_url = serializers.URLField(
        source="BUSN_COVER_PHOTO_URL",
        read_only=True,
        allow_null=True,
    )

    cover_photo_retry_after = serializers.SerializerMethodField()

    class Meta:
        model = Business
        fields = (
            "business_name",
            "cover_photo_url",
            "cover_photo_retry_after",
        )

    def get_cover_photo_retry_after(self, obj):
        return get_cover_photo_retry_after(
            self.context.get("request"),
        )