from typing import ClassVar

from rest_framework import serializers

from apps.merchant_application.models import MerchantApplicationDocument


class BusinessDocumentFileField(serializers.FileField):
    """Validates supported business verification document file types."""

    ALLOWED_MIME_TYPES: ClassVar[set[str]] = {
        "application/pdf",
        "image/jpeg",
        "image/png",
    }

    def to_internal_value(self, data):
        file = super().to_internal_value(data)

        if file.content_type not in self.ALLOWED_MIME_TYPES:
            raise serializers.ValidationError(
                "Only PDF, JPEG, and PNG files are allowed."
            )

        return file


class ApplicationDocumentSaveSerializer(serializers.Serializer):
    """Validates Step 5 document additions and deletions."""

    business_registration = BusinessDocumentFileField(
        required=False,
        allow_null=True,
    )

    authorization_document = BusinessDocumentFileField(
        required=False,
        allow_null=True,
    )

    additional_documents = serializers.ListField(
        child=BusinessDocumentFileField(),
        required=False,
        allow_empty=True,
        max_length=5,
        error_messages={
            "max_length": "You can add up to 5 additional documents.",
        },
    )

    deleted_document_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
    )

    def validate(self, attrs):
        """Reject unknown fields and invalid singular document uploads."""

        allowed_fields = {
            "business_registration",
            "authorization_document",
            "additional_documents",
            "deleted_document_ids",
        }

        unknown_fields = set(self.initial_data.keys()) - allowed_fields

        if unknown_fields:
            field = next(iter(unknown_fields))

            raise serializers.ValidationError({
                field: "This field is not allowed."
            })

        self._validate_single_file_field(
            "business_registration",
        )

        self._validate_single_file_field(
            "authorization_document",
        )

        return attrs


    def _validate_single_file_field(self, field_name):
        """Ensure singular document fields receive only one file."""

        if not hasattr(self.initial_data, "getlist"):
            return

        values = self.initial_data.getlist(field_name)

        if len(values) > 1:
            raise serializers.ValidationError({
                field_name: "Only one document can be uploaded for this field."
            })


class ApplicationDocumentSerializer(serializers.ModelSerializer):
    """Read-only representation of one uploaded business document."""

    id = serializers.IntegerField(
        source="MDOC_ID",
        read_only=True,
    )
    document_type = serializers.CharField(
        source="MDOC_DOCUMENT_TYPE",
        read_only=True,
    )
    document_url = serializers.URLField(
        source="MDOC_DOCUMENT_URL",
        read_only=True,
    )
    file_name = serializers.CharField(
        source="MDOC_FILE_NAME",
        read_only=True,
    )

    class Meta:
        model = MerchantApplicationDocument
        fields = (
            "id",
            "document_type",
            "document_url",
            "file_name",
        )