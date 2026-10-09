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
from apps.shared.serializers.operating_hours_serializers import (
    OperatingHoursWeekSerializer,
)
from apps.merchant_operations.business_profile.helpers import (
    get_cover_photo_retry_after,
    get_cover_photo_update_allowance,
)

MAX_COVER_PHOTO_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_BUSINESS_PHOTO_SIZE = 10 * 1024 * 1024


class BusinessPhotoUploadSerializer(serializers.ImageField):
    """Validate the received image before it reaches Cloudinary."""

    def to_internal_value(self, data):
        if getattr(data, "size", 0) > MAX_BUSINESS_PHOTO_SIZE:
            raise serializers.ValidationError(
                "Each photo must be 10 MB or smaller."
            )

        file_name = getattr(data, "name", "").lower()
        if not file_name.endswith((".jpg", ".jpeg", ".png")):
            raise serializers.ValidationError(
                "Only JPG, JPEG, and PNG photos are supported."
            )

        image = super().to_internal_value(data)

        if image.image.format not in ("JPEG", "PNG"):
            raise serializers.ValidationError(
                "Only JPG, JPEG, and PNG photos are supported."
            )

        if file_name.endswith(".png") and image.image.format != "PNG":
            raise serializers.ValidationError(
                "The photo extension does not match its image format."
            )

        if file_name.endswith((".jpg", ".jpeg")) and image.image.format != "JPEG":
            raise serializers.ValidationError(
                "The photo extension does not match its image format."
            )

        return image


class BusinessPhotosUpdateSerializer(serializers.Serializer):
    """New files by category and IDs to remove from the live collection."""

    storefront = serializers.ListField(
        child=BusinessPhotoUploadSerializer(),
        required=False,
        max_length=3,
    )
    interior = serializers.ListField(
        child=BusinessPhotoUploadSerializer(),
        required=False,
        max_length=5,
    )
    products = serializers.ListField(
        child=BusinessPhotoUploadSerializer(),
        required=False,
        max_length=5,
    )
    additional = serializers.ListField(
        child=BusinessPhotoUploadSerializer(),
        required=False,
        max_length=5,
    )
    deleted_photo_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=True,
    )

    def validate_deleted_photo_ids(self, value):
        if len(value) != len(set(value)):
            raise serializers.ValidationError("Duplicate photo IDs are not allowed.")

        return value


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


class BusinessInformationSerializer(serializers.Serializer):
    """Validates the merchant-editable business information allowlist."""

    description = serializers.CharField(
        source="BUSN_DESCRIPTION",
        trim_whitespace=True,
        min_length=10,
        max_length=500,
        error_messages={
            "blank": "Business description is required.",
            "min_length": "Business description must be at least 10 characters.",
        },
    )
    contact_number = serializers.RegexField(
        regex=r"^(09\d{9}|\+639\d{9})$",
        source="BUSN_CONTACT_NUMBER",
        error_messages={
            "blank": "Contact number is required.",
            "invalid": "Enter a valid Philippine mobile number.",
        },
    )
    business_email = serializers.EmailField(
        source="BUSN_EMAIL",
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    website = serializers.URLField(
        source="BUSN_WEBSITE",
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    def validate(self, attrs):
        allowed_fields = set(self.fields)
        unexpected_fields = set(self.initial_data) - allowed_fields

        if unexpected_fields:
            raise serializers.ValidationError(
                {
                    field: ["This field cannot be updated."]
                    for field in sorted(unexpected_fields)
                }
            )

        return attrs


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
    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()
    source = serializers.CharField(source="BLMK_SOURCE")
    place_id = serializers.CharField(source="BLMK_PLACE_ID")

    class Meta:
        model = BusinessLandmark
        fields = (
            "id",
            "name",
            "address",
            "latitude",
            "longitude",
            "source",
            "place_id",
        )

    def get_latitude(self, obj):
        """Expose the live landmark's WGS84 latitude to its owner."""
        return obj.BLMK_POINT.y

    def get_longitude(self, obj):
        """Expose the live landmark's WGS84 longitude to its owner."""
        return obj.BLMK_POINT.x


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


class BusinessOperatingHoursUpdateSerializer(OperatingHoursWeekSerializer):
    """Validate a complete approved schedule with shared domain rules."""

    def validate(self, attrs):
        """Reject fields that could suggest an arbitrary target business."""

        unexpected_fields = set(self.initial_data) - {"hours"}

        if unexpected_fields:
            raise serializers.ValidationError(
                {
                    field: ["This field cannot be updated."]
                    for field in sorted(unexpected_fields)
                }
            )

        return attrs


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
    has_file = serializers.SerializerMethodField()

    def get_has_file(self, obj):
        return bool(obj.MDOC_DOCUMENT_PUBLIC_ID)

    class Meta:
        model = MerchantApplicationDocument
        fields = ("id", "document_type", "file_name", "has_file")


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
