from rest_framework import serializers

from apps.business.models import (
    Business,
    BusinessLandmark,
    BusinessOperatingHours,
    BusinessPhoto,
    Category,
    Cluster,
    Location,
    SpecialtyTag,
)
from apps.merchant_application.models import MerchantApplicationDocument
from apps.merchant_operations.business_profile.helpers import (
    get_cover_photo_retry_after,
    get_cover_photo_update_allowance,
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
    cover_photo_update = serializers.SerializerMethodField()

    class Meta:
        model = Business
        fields = (
            "cover_photo_url",
            "cover_photo_retry_after",
            "cover_photo_update",
        )

    def get_cover_photo_retry_after(self, obj):
        return get_cover_photo_retry_after(
            self.context.get("request"),
        )

    def get_cover_photo_update(self, obj):
        """Return the current server-side update allowance."""
        return get_cover_photo_update_allowance(
            self.context.get("request"),
        )


class MerchantBusinessClusterSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="CLUS_ID")
    name = serializers.CharField(source="CLUS_NAME")

    class Meta:
        model = Cluster
        fields = ("id", "name")


class MerchantBusinessCategorySerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="CTGRY_ID")
    name = serializers.CharField(source="CTGRY_NAME")

    class Meta:
        model = Category
        fields = ("id", "name")


class MerchantBusinessSpecialtySerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="TAG_ID")
    name = serializers.CharField(source="TAG_NAME")
    color = serializers.CharField(source="TAG_COLOR")
    icon = serializers.CharField(source="TAG_ICON")

    class Meta:
        model = SpecialtyTag
        fields = ("id", "name", "color", "icon")


class MerchantBusinessLandmarkSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="BLMK_ID")
    name = serializers.CharField(source="BLMK_NAME")
    address = serializers.CharField(source="BLMK_ADDRESS")

    class Meta:
        model = BusinessLandmark
        fields = ("id", "name", "address")


class MerchantBusinessLocationSerializer(serializers.ModelSerializer):
    address = serializers.CharField(source="LOCT_ADDRESS")
    city = serializers.CharField(source="LOCT_CITY")
    province = serializers.CharField(source="LOCT_PROVINCE")
    postal_code = serializers.CharField(source="LOCT_POSTAL_CODE")
    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()
    landmarks = MerchantBusinessLandmarkSerializer(many=True)

    class Meta:
        model = Location
        fields = (
            "address",
            "city",
            "province",
            "postal_code",
            "latitude",
            "longitude",
            "landmarks",
        )

    def get_latitude(self, obj):
        return obj.LOCT_POINT.y

    def get_longitude(self, obj):
        return obj.LOCT_POINT.x


class MerchantBusinessHoursSerializer(serializers.ModelSerializer):
    day = serializers.CharField(source="BOHR_DAY")
    is_open = serializers.BooleanField(source="BOHR_IS_OPEN")
    is_24_hours = serializers.BooleanField(source="BOHR_IS_24_HOURS")
    open_time = serializers.TimeField(source="BOHR_OPEN_TIME")
    close_time = serializers.TimeField(source="BOHR_CLOSE_TIME")

    class Meta:
        model = BusinessOperatingHours
        fields = ("day", "is_open", "is_24_hours", "open_time", "close_time")


class MerchantBusinessPhotoSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="BPHO_ID")
    category = serializers.CharField(source="BPHO_CATEGORY")
    url = serializers.URLField(source="BPHO_PHOTO_URL")
    file_name = serializers.CharField(source="BPHO_FILE_NAME")

    class Meta:
        model = BusinessPhoto
        fields = ("id", "category", "url", "file_name")


class MerchantBusinessDocumentSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="MDOC_ID")
    document_type = serializers.CharField(source="MDOC_DOCUMENT_TYPE")
    file_name = serializers.CharField(source="MDOC_FILE_NAME")

    class Meta:
        model = MerchantApplicationDocument
        fields = ("id", "document_type", "file_name")


class BusinessProfileResponseSerializer(serializers.ModelSerializer):
    """Serializes the merchant's business profile information."""

    id = serializers.IntegerField(
        source="BUSN_ID",
        read_only=True,
    )

    business_name = serializers.CharField(
        source="BUSN_NAME",
        read_only=True,
    )
    description = serializers.CharField(source="BUSN_DESCRIPTION")
    contact_number = serializers.CharField(source="BUSN_CONTACT_NUMBER")
    business_email = serializers.EmailField(source="BUSN_EMAIL")
    website = serializers.URLField(source="BUSN_WEBSITE")
    status = serializers.CharField(source="BUSN_STATUS")
    category = MerchantBusinessCategorySerializer(source="CTGRY_ID")
    cluster = MerchantBusinessClusterSerializer(source="CTGRY_ID.CLUS_ID")
    specialty_tags = serializers.SerializerMethodField()
    location = MerchantBusinessLocationSerializer(source="LOCT_ID")
    operating_hours = MerchantBusinessHoursSerializer(many=True)
    photos = MerchantBusinessPhotoSerializer(many=True)
    verification = serializers.SerializerMethodField()

    cover_photo_url = serializers.URLField(
        source="BUSN_COVER_PHOTO_URL",
        read_only=True,
        allow_null=True,
    )

    cover_photo_retry_after = serializers.SerializerMethodField()
    cover_photo_update = serializers.SerializerMethodField()

    class Meta:
        model = Business
        fields = (
            "id",
            "business_name",
            "description",
            "contact_number",
            "business_email",
            "website",
            "status",
            "category",
            "cluster",
            "specialty_tags",
            "location",
            "operating_hours",
            "photos",
            "verification",
            "cover_photo_url",
            "cover_photo_retry_after",
            "cover_photo_update",
        )

    def get_specialty_tags(self, obj):
        assignments = getattr(
            obj,
            "active_specialty_tag_links",
            None,
        )

        if assignments is None:
            assignments = (
                obj.specialty_tag_links
                .filter(BST_IS_ACTIVE=True)
                .select_related("TAG_ID")
            )

        tags = [
            assignment.TAG_ID
            for assignment in assignments
        ]

        return MerchantBusinessSpecialtySerializer(
            tags,
            many=True,
        ).data

    def get_verification(self, obj):
        application = getattr(obj, "merchant_application", None)

        if application is None:
            return None

        identity = getattr(application, "identity", None)

        return {
            "representative_name": (
                identity.MIDN_REPRESENTATIVE_NAME
                if identity is not None
                else None
            ),
            "representative_role": (
                identity.MIDN_REPRESENTATIVE_ROLE
                if identity is not None
                else None
            ),
            "documents": MerchantBusinessDocumentSerializer(
                application.documents.all(),
                many=True,
            ).data,
        }

    def get_cover_photo_retry_after(self, obj):
        return get_cover_photo_retry_after(
            self.context.get("request"),
        )

    def get_cover_photo_update(self, obj):
        """Return the current server-side update allowance."""
        return get_cover_photo_update_allowance(
            self.context.get("request"),
        )
