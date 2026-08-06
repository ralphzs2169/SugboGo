from rest_framework import serializers

from apps.merchant_application.models import MerchantApplication
from apps.merchant_application.serializers.application_location_serializers import (
    ApplicationLocationReadSerializer,
)
from apps.merchant_application.serializers.document_serializers import (
    ApplicationDocumentSerializer,
)
from apps.merchant_application.serializers.identity_serializers import (
    ApplicationIdentityReadSerializer,
)
from apps.merchant_application.serializers.operating_hours_serializers import (
    ApplicationOperatingHoursReadSerializer,
)
from apps.merchant_application.serializers.photo_serializers import (
    ApplicationPhotoSerializer,
)


class MerchantApplicationSerializer(serializers.ModelSerializer):
    """Read serializer for the top-level application record."""

    id = serializers.IntegerField(source="MAPP_ID", read_only=True)
    status = serializers.CharField(source="MAPP_STATUS", read_only=True)

    highest_completed_step = serializers.IntegerField(
        source="MAPP_HIGHEST_COMPLETED_STEP"
    )
    submitted_at = serializers.DateTimeField(
        source="MAPP_SUBMITTED_AT", read_only=True
    )
    reviewed_at = serializers.DateTimeField(
        source="MAPP_REVIEWED_AT", read_only=True
    )
    rejection_reason = serializers.CharField(
        source="MAPP_REJECTION_REASON", read_only=True
    )
    created_at = serializers.DateTimeField(source="MAPP_CREATED_AT", read_only=True)
    updated_at = serializers.DateTimeField(source="MAPP_UPDATED_AT", read_only=True)

    class Meta:
        model = MerchantApplication
        fields = (
            "id",
            "status",
            "highest_completed_step",
            "submitted_at",
            "reviewed_at",
            "rejection_reason",
            "created_at",
            "updated_at",
        )


class ApplicationDetailSerializer(serializers.ModelSerializer):
    """
    Full nested read serializer for GET /application/ — everything the
    frontend needs to resume the wizard at the correct step in one call.
    Any section not yet filled in returns null/empty rather than erroring.
    """

    id = serializers.IntegerField(source="MAPP_ID", read_only=True)
    status = serializers.CharField(source="MAPP_STATUS", read_only=True)
    highest_completed_step = serializers.IntegerField(
        source="MAPP_HIGHEST_COMPLETED_STEP", read_only=True
    )
    submitted_at = serializers.DateTimeField(source="MAPP_SUBMITTED_AT", read_only=True)
    reviewed_at = serializers.DateTimeField(source="MAPP_REVIEWED_AT", read_only=True)
    rejection_reason = serializers.CharField(
        source="MAPP_REJECTION_REASON", read_only=True
    )
    created_at = serializers.DateTimeField(source="MAPP_CREATED_AT", read_only=True)
    updated_at = serializers.DateTimeField(source="MAPP_UPDATED_AT", read_only=True)

    identity = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()
    operating_hours = ApplicationOperatingHoursReadSerializer(
        many=True, read_only=True
    )
    photos = ApplicationPhotoSerializer(
        many=True,
        read_only=True,
    )

    documents = ApplicationDocumentSerializer(
        many=True,
        read_only=True,
    ) 
  
    class Meta:
        model = MerchantApplication
        fields = (
            "id",
            "status",
            "highest_completed_step",
            "submitted_at",
            "reviewed_at",
            "rejection_reason",
            "created_at",
            "updated_at",
            "identity",
            "location",
            "operating_hours",
            "photos",
            "documents",
        )

    def get_identity(self, obj):
        identity = getattr(obj, "identity", None)
        if identity is None:
            return None
        return ApplicationIdentityReadSerializer(identity).data

    def get_location(self, obj):
        location = getattr(obj, "location", None)
        if location is None:
            return None
        return ApplicationLocationReadSerializer(location).data