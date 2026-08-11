from rest_framework import serializers

from apps.business.models import SpecialtyTag
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationFeedback,
    MerchantApplicationIdentity,
)
from apps.merchant_application.serializers.application_location_serializers import (
    ApplicationLocationReadSerializer,
)
from apps.merchant_application.serializers.document_serializers import (
    ApplicationDocumentSerializer,
)
from apps.merchant_application.serializers.feedback_serializers import (
    MerchantApplicationFeedbackSerializer,
)
from apps.merchant_application.serializers.operating_hours_serializers import (
    ApplicationOperatingHoursReadSerializer,
)
from apps.merchant_application.serializers.photo_serializers import (
    ApplicationPhotoSerializer,
)
from apps.users.models import User


class AdminApplicationSpecialtyTagSerializer(serializers.ModelSerializer):
    """Read serializer for specialty tags displayed during application review."""

    id = serializers.IntegerField(
        source="TAG_ID",
        read_only=True,
    )
    name = serializers.CharField(
        source="TAG_NAME",
        read_only=True,
    )
    color = serializers.CharField(
        source="TAG_COLOR",
        read_only=True,
    )

    class Meta:
        model = SpecialtyTag
        fields = (
            "id",
            "name",
            "color",
        )


class AdminApplicationIdentitySerializer(serializers.ModelSerializer):
    """Read serializer for business identity during admin application review."""

    business_name = serializers.CharField(
        source="MIDN_BUSINESS_NAME",
        read_only=True,
    )
    business_description = serializers.CharField(
        source="MIDN_BUSINESS_DESCRIPTION",
        read_only=True,
    )
    contact_number = serializers.CharField(
        source="MIDN_CONTACT_NUMBER",
        read_only=True,
    )
    business_email = serializers.CharField(
        source="MIDN_BUSINESS_EMAIL",
        read_only=True,
    )
    website = serializers.CharField(
        source="MIDN_WEBSITE",
        read_only=True,
    )
    representative_name = serializers.CharField(
        source="MIDN_REPRESENTATIVE_NAME",
        read_only=True,
    )
    representative_role = serializers.CharField(
        source="MIDN_REPRESENTATIVE_ROLE",
        read_only=True,
    )

    business_cluster_id = serializers.IntegerField(
        source="CLUS_ID_id",
        read_only=True,
    )
    business_cluster_name = serializers.CharField(
        source="CLUS_ID.CLUS_NAME",
        read_only=True,
    )

    business_category_id = serializers.IntegerField(
        source="CTGRY_ID_id",
        read_only=True,
    )
    business_category_name = serializers.CharField(
        source="CTGRY_ID.CTGRY_NAME",
        read_only=True,
    )

    specialty_tags = AdminApplicationSpecialtyTagSerializer(
        many=True,
        read_only=True,
    )

    class Meta:
        model = MerchantApplicationIdentity
        fields = (
            "business_name",
            "business_description",
            "contact_number",
            "business_email",
            "website",
            "representative_name",
            "representative_role",
            "business_cluster_id",
            "business_cluster_name",
            "business_category_id",
            "business_category_name",
            "specialty_tags",
        )

class ApplicationSubmitterSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="full_name", read_only=True)
    email = serializers.EmailField(source="USER_EMAIL", read_only=True)

    class Meta:
        model = User
        fields = (
            "name",
            "email",
        )

        
class AdminMerchantApplicationListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for the administrator application table."""

    id = serializers.IntegerField(
        source="MAPP_ID",
        read_only=True,
    )

    business_name = serializers.CharField(
        source="identity.MIDN_BUSINESS_NAME",
        read_only=True,
    )

    cluster_name = serializers.CharField(
        source="identity.CLUS_ID.CLUS_NAME",
        read_only=True,
    )

    category_name = serializers.CharField(
        source="identity.CTGRY_ID.CTGRY_NAME",
        read_only=True,
    )

    status = serializers.CharField(
        source="MAPP_STATUS",
        read_only=True,
    )

    submitted_at = serializers.DateTimeField(
        source="MAPP_SUBMITTED_AT",
        read_only=True,
    )

    submitter = ApplicationSubmitterSerializer(
        source="USER_ID",
        read_only=True,
    )

    class Meta:
        model = MerchantApplication
        fields = (
            "id",
            "business_name",
            "cluster_name",
            "category_name",
            "status",
            "submitted_at",
            "submitter",
        )


class AdminMerchantApplicationDetailSerializer(serializers.ModelSerializer):
    """Full application serializer for administrative review."""

    id = serializers.IntegerField(
        source="MAPP_ID",
        read_only=True,
    )

    status = serializers.CharField(
        source="MAPP_STATUS",
        read_only=True,
    )

    highest_completed_step = serializers.IntegerField(
        source="MAPP_HIGHEST_COMPLETED_STEP",
        read_only=True,
    )

    submitted_at = serializers.DateTimeField(
        source="MAPP_SUBMITTED_AT",
        read_only=True,
    )

    reviewed_at = serializers.DateTimeField(
        source="MAPP_REVIEWED_AT",
        read_only=True,
    )

    rejection_reason = serializers.CharField(
        source="MAPP_REJECTION_REASON",
        read_only=True,
    )

    feedback = MerchantApplicationFeedbackSerializer(
        many=True,
        read_only=True,
    )

    created_at = serializers.DateTimeField(
        source="MAPP_CREATED_AT",
        read_only=True,
    )

    updated_at = serializers.DateTimeField(
        source="MAPP_UPDATED_AT",
        read_only=True,
    )

    identity = AdminApplicationIdentitySerializer(
        read_only=True,
    )

    location = ApplicationLocationReadSerializer(
        read_only=True,
    )

    operating_hours = ApplicationOperatingHoursReadSerializer(
        many=True,
        read_only=True,
    )

    photos = ApplicationPhotoSerializer(
        many=True,
        read_only=True,
    )

    documents = ApplicationDocumentSerializer(
        many=True,
        read_only=True,
    )

    submitter = ApplicationSubmitterSerializer(
        source="USER_ID",
        read_only=True,
    )
        

    class Meta:
        model = MerchantApplication
        fields = (
            "id",
            "submitter",
            "status",
            "highest_completed_step",
            "submitted_at",
            "reviewed_at",
            "rejection_reason",
            "feedback",
            "created_at",
            "updated_at",
            "identity",
            "location",
            "operating_hours",
            "photos",
            "documents",
        )


class AdminMerchantApplicationFeedbackInputSerializer(serializers.Serializer):
    """Validates section-specific feedback submitted during application rejection."""

    section = serializers.ChoiceField(
        choices=MerchantApplicationFeedback.Section.choices,
    )

    message = serializers.CharField(
        allow_blank=False,
        trim_whitespace=True,
    )


class AdminMerchantApplicationRejectSerializer(serializers.Serializer):
    """Validates administrator feedback submitted when rejecting an application."""

    feedback = AdminMerchantApplicationFeedbackInputSerializer(
        many=True,
        allow_empty=False,
    )

    def validate_feedback(self, feedback):
        sections = [item["section"] for item in feedback]

        if len(sections) != len(set(sections)):
            raise serializers.ValidationError(
                "Each application section can only have one feedback entry.",
            )

        return feedback