from rest_framework import serializers

from apps.registration.models import (
    MerchantApplicationDocument,
    MerchantApplicationPhotos,
)

class MerchantApplicationPhotoSaveSerializer(serializers.Serializer):
    """Write serializer for the complete Step 4 save operation."""

    storefront = serializers.ListField(
        child=serializers.FileField(),
        required=False,
        allow_empty=True,
    )
    interior = serializers.ListField(
        child=serializers.FileField(),
        required=False,
        allow_empty=True,
    )
    products = serializers.ListField(
        child=serializers.FileField(),
        required=False,
        allow_empty=True,
    )
    additional = serializers.ListField(
        child=serializers.FileField(),
        required=False,
        allow_empty=True,
    )
    deleted_photo_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
    )


class MerchantApplicationPhotoSerializer(serializers.ModelSerializer):
    """Read serializer for one uploaded photo."""

    id = serializers.IntegerField(source="MPHT_ID", read_only=True)
    category = serializers.CharField(source="MPHT_CATEGORY", read_only=True)
    photo_url = serializers.URLField(source="MPHT_PHOTO_URL", read_only=True)
    file_name = serializers.CharField(source="MPHT_FILE_NAME", read_only=True)

    class Meta:
        model = MerchantApplicationPhotos
        fields = ("id", "category", "photo_url", "file_name")



class MerchantApplicationDocumentSerializer(serializers.ModelSerializer):
    """Read serializer for one uploaded document."""

    id = serializers.IntegerField(source="MDOC_ID", read_only=True)
    document_type = serializers.CharField(source="MDOC_DOCUMENT_TYPE", read_only=True)
    document_url = serializers.URLField(source="MDOC_DOCUMENT_URL", read_only=True)
    file_name = serializers.CharField(source="MDOC_FILE_NAME", read_only=True)

    class Meta:
        model = MerchantApplicationDocument
        fields = ("id", "document_type", "document_url", "file_name")


class MerchantApplicationDocumentUploadSerializer(serializers.Serializer):
    """Write serializer — multiple documents, same type, in one request."""

    document_type = serializers.ChoiceField(
        choices=MerchantApplicationDocument.DocumentType.choices
    )
    files = serializers.ListField(
        child=serializers.FileField(), allow_empty=False
    )