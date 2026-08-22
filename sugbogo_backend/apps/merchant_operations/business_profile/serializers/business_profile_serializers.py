from rest_framework import serializers

from apps.business.models import Business


class BusinessCoverPhotoSerializer(serializers.Serializer):
    """Validates a merchant business cover photo upload."""

    cover_photo = serializers.ImageField(
        required=True,
    )


class BusinessCoverPhotoResponseSerializer(serializers.ModelSerializer):
    """Serializes the current business cover photo."""

    cover_photo_url = serializers.URLField(
        source="BUSN_COVER_PHOTO_URL",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = Business
        fields = (
            "cover_photo_url",
        )