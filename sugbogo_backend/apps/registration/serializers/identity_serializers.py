from rest_framework import serializers

from apps.msme.models import Category, Cluster, SpecialtyTag
from apps.registration.models import MerchantApplicationIdentity


class MerchantApplicationIdentitySerializer(serializers.ModelSerializer):
    """Handles Step 1 — creates/updates Identity, and the parent
    Application on first save. Also owns current_step /
    highest_completed_step, sent by the frontend on every step save."""

    business_name = serializers.CharField(
        source="MIDN_BUSINESS_NAME",
        error_messages={
            "blank": "Business name is required.",
            "required": "Business name is required.",
        },
    )
    business_description = serializers.CharField(
        source="MIDN_BUSINESS_DESCRIPTION",
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    contact_number = serializers.CharField(
        source="MIDN_CONTACT_NUMBER",
        error_messages={
            "blank": "Contact number is required.",
            "required": "Contact number is required.",
        },
    )
    business_email = serializers.EmailField(
        source="MIDN_BUSINESS_EMAIL",
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    website = serializers.URLField(
        source="MIDN_WEBSITE",
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    representative_name = serializers.CharField(
        source="MIDN_REPRESENTATIVE_NAME",
        error_messages={
            "blank": "Representative name is required.",
            "required": "Representative name is required.",
        },
    )
    representative_role = serializers.ChoiceField(
        source="MIDN_REPRESENTATIVE_ROLE",
        choices=MerchantApplicationIdentity.RepresentativeRole.choices,
        error_messages={
            "required": "Please select a representative role.",
            "invalid_choice": "Please select a valid representative role.",
        },
    )
    business_cluster_id = serializers.PrimaryKeyRelatedField(
        source="CLUS_ID",
        queryset=Cluster.objects.all(),
        error_messages={
            "required": "Please select a cluster.",
            "does_not_exist": "The selected cluster was not found.",
        },
    )
    business_category_id = serializers.PrimaryKeyRelatedField(
        source="CTGRY_ID",
        queryset=Category.objects.all(),
        error_messages={
            "required": "Please select a category.",
            "does_not_exist": "The selected category was not found.",
        },
    )
    specialty_tags = serializers.PrimaryKeyRelatedField(
        queryset=SpecialtyTag.objects.all(),
        many=True,
        required=False,
    )

    # These live on the parent MerchantApplication, not Identity —
    # the service layer pulls them off validated_data before saving.
    current_step = serializers.IntegerField(write_only=True)
    highest_completed_step = serializers.IntegerField(write_only=True)

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
            "business_category_id",
            "specialty_tags",
            "current_step",
            "highest_completed_step",
        )


class MerchantApplicationIdentityReadSerializer(serializers.ModelSerializer):
    """Nested, read-only view of Identity for the application detail response."""

    business_name = serializers.CharField(source="MIDN_BUSINESS_NAME", read_only=True)
    business_description = serializers.CharField(
        source="MIDN_BUSINESS_DESCRIPTION", read_only=True
    )
    contact_number = serializers.CharField(source="MIDN_CONTACT_NUMBER", read_only=True)
    business_email = serializers.CharField(source="MIDN_BUSINESS_EMAIL", read_only=True)
    website = serializers.CharField(source="MIDN_WEBSITE", read_only=True)
    representative_name = serializers.CharField(
        source="MIDN_REPRESENTATIVE_NAME", read_only=True
    )
    representative_role = serializers.CharField(
        source="MIDN_REPRESENTATIVE_ROLE", read_only=True
    )
    business_cluster_id = serializers.IntegerField(source="CLUS_ID_id", read_only=True)
    business_cluster_name = serializers.CharField(
        source="CLUS_ID.CLUS_NAME", read_only=True
    )
    business_category_id = serializers.IntegerField(source="CTGRY_ID_id", read_only=True)
    business_category_name = serializers.CharField(
        source="CTGRY_ID.CTGRY_NAME", read_only=True
    )
    specialty_tags = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

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