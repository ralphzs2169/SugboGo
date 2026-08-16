from rest_framework import serializers

from apps.admin_operations.taxonomy_management.serializers.specialty_tag_serializers import (
    SpecialtyTagSerializer,
)
from apps.business.models import Business
from apps.business.serializers.business_serializers import BusinessOwnerSerializer
from apps.merchant_application.models import MerchantApplication


class AdminBusinessListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for the administrator business table."""

    id = serializers.IntegerField(source="BUSN_ID", read_only=True)
    business_name = serializers.CharField(source="BUSN_NAME", read_only=True)

    owner = BusinessOwnerSerializer(
        source="USER_ID",
        read_only=True,
    )

    cluster_name = serializers.CharField(
        source="CTGRY_ID.CLUS_ID.CLUS_NAME",
        read_only=True,
    )

    cluster_icon = serializers.CharField(
        source="CTGRY_ID.CLUS_ID.CLUS_ICON",
        read_only=True,
    )

    category_name = serializers.CharField(
        source="CTGRY_ID.CTGRY_NAME",
        read_only=True,
    )

    specialty_tags = SpecialtyTagSerializer(
        source="SPECIALTY_TAGS",
        many=True,
        read_only=True,
    )

    location = serializers.CharField(
        source="LOC_ID.LOCT_ADDRESS",
        read_only=True,
    )

    status = serializers.CharField(
        source="BUSN_STATUS",
        read_only=True,
    )

    created_at = serializers.DateTimeField(
        source="BUSN_CREATED_AT",
        read_only=True,
    )

    class Meta:
        model = Business
        fields = (
            "id",
            "business_name",
            "owner",
            "cluster_name",
            "cluster_icon",
            "category_name",
            "specialty_tags",
            "location",
            "status",
            "created_at",
        )


class AdminBusinessMapSerializer(serializers.ModelSerializer):
    """Serializer for business locations displayed on the management map."""

    id = serializers.IntegerField(source="BUSN_ID", read_only=True)
    business_name = serializers.CharField(source="BUSN_NAME", read_only=True)

    category_name = serializers.CharField(
        source="CTGRY_ID.CTGRY_NAME",
        read_only=True,
    )

    cluster_name = serializers.CharField(
        source="CTGRY_ID.CLUS_ID.CLUS_NAME",
        read_only=True,
    )

    location = serializers.CharField(
        source="LOC_ID.LOCT_ADDRESS",
        read_only=True,
    )

    status = serializers.CharField(
        source="BUSN_STATUS",
        read_only=True,
    )

    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()

    def get_latitude(self, obj):
        return obj.LOC_ID.LOCT_POINT.y

    def get_longitude(self, obj):
        return obj.LOC_ID.LOCT_POINT.x

    class Meta:
        model = Business
        fields = (
            "id",
            "business_name",
            "category_name",
            "cluster_name",
            "location",
            "status",
            "latitude",
            "longitude",
        )


class AdminBusinessPhotoSerializer(serializers.ModelSerializer):
    """Serializes a permanent business photo for administrator viewing."""

    id = serializers.IntegerField(source="BPHO_ID", read_only=True)
    category = serializers.CharField(source="BPHO_CATEGORY", read_only=True)
    url = serializers.URLField(source="BPHO_PHOTO_URL", read_only=True)

    class Meta:
        model = Business.photos.rel.related_model
        fields = (
            "id",
            "category",
            "url",
        )


class AdminBusinessOperatingHoursSerializer(serializers.ModelSerializer):
    """Serializes permanent business operating hours."""

    id = serializers.IntegerField(source="BOHR_ID", read_only=True)
    day = serializers.CharField(source="BOHR_DAY", read_only=True)
    is_open = serializers.BooleanField(source="BOHR_IS_OPEN", read_only=True)
    is_24_hours = serializers.BooleanField(
        source="BOHR_IS_24_HOURS",
        read_only=True,
    )
    open_time = serializers.TimeField(
        source="BOHR_OPEN_TIME",
        read_only=True,
    )
    close_time = serializers.TimeField(
        source="BOHR_CLOSE_TIME",
        read_only=True,
    )

    class Meta:
        model = Business.operating_hours.rel.related_model
        fields = (
            "id",
            "day",
            "is_open",
            "is_24_hours",
            "open_time",
            "close_time",
        )


class AdminBusinessApplicationSerializer(serializers.ModelSerializer):
    """Serializes the merchant application associated with a business."""

    id = serializers.IntegerField(source="MAPP_ID", read_only=True)
    status = serializers.CharField(source="MAPP_STATUS", read_only=True)
    submission_count = serializers.IntegerField(
        source="MAPP_SUBMISSION_COUNT",
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
    created_at = serializers.DateTimeField(
        source="MAPP_CREATED_AT",
        read_only=True,
    )

    class Meta:
        model = MerchantApplication
        fields = (
            "id",
            "status",
            "submission_count",
            "submitted_at",
            "reviewed_at",
            "created_at",
        )


class AdminBusinessDetailSerializer(serializers.ModelSerializer):
    """Complete administrator-facing business detail serializer."""

    id = serializers.IntegerField(source="BUSN_ID", read_only=True)
    business_name = serializers.CharField(source="BUSN_NAME", read_only=True)
    description = serializers.CharField(
        source="BUSN_DESCRIPTION",
        read_only=True,
    )
    status = serializers.CharField(source="BUSN_STATUS", read_only=True)
    is_verified = serializers.BooleanField(
        source="BUSN_IS_VERIFIED",
        read_only=True,
    )

    vouch_count = serializers.IntegerField(
        source="BUSN_VOUCH_COUNT",
        read_only=True,
    )
    review_count = serializers.IntegerField(
        source="BUSN_REVIEW_COUNT",
        read_only=True,
    )
    pocket_count = serializers.IntegerField(
        source="BUSN_POCKET_COUNT",
        read_only=True,
    )

    owner = BusinessOwnerSerializer(
        source="USER_ID",
        read_only=True,
    )

    category_name = serializers.CharField(
        source="CTGRY_ID.CTGRY_NAME",
        read_only=True,
    )
    cluster_name = serializers.CharField(
        source="CTGRY_ID.CLUS_ID.CLUS_NAME",
        read_only=True,
    )
    cluster_icon = serializers.CharField(
        source="CTGRY_ID.CLUS_ID.CLUS_ICON",
        read_only=True,
    )

    specialty_tags = SpecialtyTagSerializer(
        source="SPECIALTY_TAGS",
        many=True,
        read_only=True,
    )

    location = serializers.SerializerMethodField()
    photos = AdminBusinessPhotoSerializer(
        many=True,
        read_only=True,
    )
    operating_hours = AdminBusinessOperatingHoursSerializer(
        many=True,
        read_only=True,
    )
    application = AdminBusinessApplicationSerializer(
        source="merchant_application",
        read_only=True,
    )

    def get_location(self, obj):
        point = obj.LOC_ID.LOCT_POINT

        return {
            "address": obj.LOC_ID.LOCT_ADDRESS,
            "city": obj.LOC_ID.LOCT_CITY,
            "province": obj.LOC_ID.LOCT_PROVINCE,
            "postal_code": obj.LOC_ID.LOCT_POSTAL_CODE,
            "latitude": point.y,
            "longitude": point.x,
        }

    class Meta:
        model = Business
        fields = (
            "id",
            "business_name",
            "description",
            "status",
            "is_verified",
            "vouch_count",
            "review_count",
            "pocket_count",
            "owner",
            "category_name",
            "cluster_name",
            "cluster_icon",
            "specialty_tags",
            "location",
            "photos",
            "operating_hours",
            "application",
        )