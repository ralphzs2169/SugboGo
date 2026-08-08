from rest_framework import serializers

from apps.merchant_application.models import MerchantApplicationPhotos


class ApplicationPhotoSaveSerializer(serializers.Serializer):
    """Validates the complete Step 4 business photo save payload."""

    storefront = serializers.ListField(
        child=serializers.ImageField(),
        required=False,
        allow_empty=True,
        min_length=1,
        max_length=3,
        error_messages={
            "required": "At least one storefront photo is required.",
            "empty": "At least one storefront photo is required.",
            "min_length": "At least one storefront photo is required.",
            "max_length": "You can add up to 3 storefront photos.",
        },
    )

    interior = serializers.ListField(
        child=serializers.ImageField(),
        required=False,
        allow_empty=True,
        max_length=5,
        error_messages={
            "max_length": "You can only add up to 5 interior photos.",
        },
    )

    products = serializers.ListField(
        child=serializers.ImageField(),
        required=False,
        allow_empty=True,
        max_length=5,
        error_messages={
            "max_length": "You can only add up to 5 product photos.",
        },
    )

    additional = serializers.ListField(
        child=serializers.ImageField(),
        required=False,
        allow_empty=True,
        max_length=5,
        error_messages={
            "max_length": "You can only add up to 5 additional photos.",
        },
    )

    deleted_photo_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
    )



class ApplicationPhotoSerializer(serializers.ModelSerializer):
    """Read serializer for one uploaded business photo."""

    id = serializers.IntegerField(
        source="MPHT_ID",
        read_only=True,
    )
    category = serializers.CharField(
        source="MPHT_CATEGORY",
        read_only=True,
    )
    photo_url = serializers.URLField(
        source="MPHT_PHOTO_URL",
        read_only=True,
    )
    file_name = serializers.CharField(
        source="MPHT_FILE_NAME",
        read_only=True,
    )

    class Meta:
        model = MerchantApplicationPhotos
        fields = (
            "id",
            "category",
            "photo_url",
            "file_name",
        )