from rest_framework import serializers

from apps.admin_operations.business_management.serializers.manage_application_serializers import (
    AdminApplicationIdentitySerializer,
)
from apps.admin_operations.business_management.serializers.mixins.application_queue import (
    ApplicationQueueSerializerMixin,
)
from apps.admin_operations.taxonomy_management.serializers.specialty_tag_serializers import (
    SpecialtyTagSerializer,
)
from apps.business.models import Business, BusinessLandmark
from apps.business.serializers.business_serializers import (
    BusinessOwnerSerializer,
    BusinessSpecialtyTagSerializer,
)
from apps.explorer_operations.explore_businesses.serializers.review_insights_serializers import (
    BusinessReviewInsightsSerializer,
)
from apps.merchant_application.models import MerchantApplication
from apps.reviews.models import Review
from apps.reviews.serializers.review_reply_serializers import (
    ReviewReplyResponseSerializer,
)
from apps.reviews.serializers.review_serializers import (
    ReviewAuthorResponseSerializer,
    ReviewPhotoResponseSerializer,
    ReviewVouchedSpecialtySerializer,
)


class AdminBusinessListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for the administrator business table."""

    id = serializers.IntegerField(
        source="BUSN_ID",
        read_only=True,
    )

    business_name = serializers.CharField(
        source="BUSN_NAME",
        read_only=True,
    )

    cover_photo_url = serializers.CharField(
        source="BUSN_COVER_PHOTO_URL",
        read_only=True,
    )

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

    specialty_tags = serializers.SerializerMethodField()

    location = serializers.CharField(
        source="LOCT_ID.LOCT_ADDRESS",
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
            "cover_photo_url",
            "owner",
            "cluster_name",
            "cluster_icon",
            "category_name",
            "specialty_tags",
            "location",
            "vouch_count",
            "review_count",
            "pocket_count",
            "status",
            "created_at",
        )

    def get_specialty_tags(self, obj):
        specialty_tags = [
            business_specialty.TAG_ID
            for business_specialty in obj.active_specialty_tag_links
        ]

        return SpecialtyTagSerializer(
            specialty_tags,
            many=True,
        ).data


class AdminBusinessMapSerializer(serializers.ModelSerializer):
    """Serializer for business locations displayed on the management map."""

    id = serializers.IntegerField(source="BUSN_ID", read_only=True)
    business_name = serializers.CharField(source="BUSN_NAME", read_only=True)

    cover_photo_url = serializers.CharField(
        source="BUSN_COVER_PHOTO_URL",
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

    location = serializers.CharField(
        source="LOCT_ID.LOCT_ADDRESS",
        read_only=True,
    )

    status = serializers.CharField(
        source="BUSN_STATUS",
        read_only=True,
    )

    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()

    def get_latitude(self, obj):
        return obj.LOCT_ID.LOCT_POINT.y

    def get_longitude(self, obj):
        return obj.LOCT_ID.LOCT_POINT.x

    class Meta:
        model = Business
        fields = (
            "id",
            "business_name",
            "cover_photo_url",
            "category_name",
            "cluster_name",
            "cluster_icon",
            "location",
            "status",
            "latitude",
            "longitude",
        )


class AdminBusinessLandmarkSerializer(serializers.ModelSerializer):
    """Serializes a permanent nearby landmark for administrator viewing."""

    id = serializers.IntegerField(source="BLMK_ID", read_only=True)
    name = serializers.CharField(source="BLMK_NAME", read_only=True)
    address = serializers.CharField(source="BLMK_ADDRESS", read_only=True)
    source = serializers.CharField(source="BLMK_SOURCE", read_only=True)
    place_id = serializers.CharField(
        source="BLMK_PLACE_ID",
        read_only=True,
    )
    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()

    def get_latitude(self, obj):
        return obj.BLMK_POINT.y

    def get_longitude(self, obj):
        return obj.BLMK_POINT.x

    class Meta:
        model = BusinessLandmark
        fields = (
            "id",
            "name",
            "address",
            "source",
            "place_id",
            "latitude",
            "longitude",
        )

class AdminBusinessPhotoSerializer(serializers.ModelSerializer):
    """Serializes a permanent business photo for administrator viewing."""

    id = serializers.IntegerField(
        source="BPHO_ID",
        read_only=True,
    )

    category = serializers.CharField(
        source="BPHO_CATEGORY",
        read_only=True,
    )

    photo_url = serializers.URLField(
        source="BPHO_PHOTO_URL",
        read_only=True,
    )

    file_name = serializers.CharField(
        source="BPHO_FILE_NAME",
        read_only=True,
    )

    class Meta:
        model = Business.photos.rel.related_model
        fields = (
            "id",
            "category",
            "photo_url",
            "file_name",
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

class AdminBusinessApplicationSerializer(
    ApplicationQueueSerializerMixin,
    serializers.ModelSerializer,
):
    """Serializes the merchant application associated with a business."""

    id = serializers.IntegerField(
        source="MAPP_ID",
        read_only=True,
    )

    status = serializers.CharField(
        source="MAPP_STATUS",
        read_only=True,
    )

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

    identity = AdminApplicationIdentitySerializer(
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
            "identity",
            "time_in_queue_business_days",
            "queue_status",
        )

class AdminReviewResponseSerializer(serializers.ModelSerializer):
    """Serializes a business review for admin panel moderation views."""

    id = serializers.IntegerField(
        source="REVW_ID",
        read_only=True
    )
    text = serializers.CharField(
        source="REVW_TEXT",
        read_only=True
    )
    status = serializers.CharField(
        source="REVW_STATUS",
        read_only=True
    )
    like_count = serializers.IntegerField(
        source="REVW_LIKE_COUNT",
        read_only=True
    )
    report_count = serializers.IntegerField(
        source="REVW_REPORT_COUNT",
        read_only=True
    )
    created_at = serializers.DateTimeField(
        source="REVW_CREATED_AT",
        read_only=True
    )
    updated_at = serializers.DateTimeField(source="REVW_UPDATED_AT",
        read_only=True
    )

    photos = ReviewPhotoResponseSerializer(
        many=True,
        read_only=True
    )
    author = ReviewAuthorResponseSerializer(
        source="USER_ID",
        read_only=True
    )
    vouched_specialties = ReviewVouchedSpecialtySerializer(
        many=True,
        read_only=True
    )
    reply = ReviewReplyResponseSerializer(
        read_only=True
    )
    

    class Meta:
        model = Review
        fields = (
            "id",
            "text",
            "status",
            "like_count",
            "report_count",
            "created_at",
            "updated_at",
            "photos",
            "vouched_specialties",
            "author",
            "reply",
        )


class AdminBusinessReviewInsightsSerializer(BusinessReviewInsightsSerializer):
    """Adds separate sentiment and keyword freshness to public insight fields."""

    sentiment_computed_at = serializers.DateTimeField(
        source="BRSU_SENTIMENT_COMPUTED_AT",
        read_only=True,
    )
    keywords_processed_at = serializers.DateTimeField(
        source="BRSU_KEYWORDS_PROCESSED_AT",
        read_only=True,
    )

    class Meta(BusinessReviewInsightsSerializer.Meta):
        fields = BusinessReviewInsightsSerializer.Meta.fields + (
            "sentiment_computed_at",
            "keywords_processed_at",
        )


class AdminBusinessDetailSerializer(serializers.ModelSerializer):
    """Complete administrator-facing business detail serializer."""

    id = serializers.IntegerField(
        source="BUSN_ID",
        read_only=True,
    )

    business_name = serializers.CharField(
        source="BUSN_NAME",
        read_only=True,
    )

    cover_photo_url = serializers.CharField(
        source="BUSN_COVER_PHOTO_URL",
        read_only=True,
    )

    description = serializers.CharField(
        source="BUSN_DESCRIPTION",
        read_only=True,
    )

    contact_number = serializers.CharField(
        source="BUSN_CONTACT_NUMBER",
        read_only=True,
    )

    email = serializers.EmailField(
        source="BUSN_EMAIL",
        read_only=True,
        allow_null=True,
    )

    website = serializers.URLField(
        source="BUSN_WEBSITE",
        read_only=True,
        allow_null=True,
    )
    
    status = serializers.CharField(
        source="BUSN_STATUS",
        read_only=True,
    )

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

    specialty_tags = BusinessSpecialtyTagSerializer(
        source="active_specialty_tag_links",
        many=True,
        read_only=True,
    )

    location = serializers.SerializerMethodField()

    landmarks = AdminBusinessLandmarkSerializer(
        source="LOCT_ID.landmarks",
        many=True,
        read_only=True,
    )

    photos = AdminBusinessPhotoSerializer(
        many=True,
        read_only=True,
    )

    operating_hours = AdminBusinessOperatingHoursSerializer(
        many=True,
        read_only=True,
    )

    latest_reviews = AdminReviewResponseSerializer(
        many=True,
        read_only=True,
    )

    review_insights = AdminBusinessReviewInsightsSerializer(
        source="review_summary",
        read_only=True,
        allow_null=True,
    )
        
    application = AdminBusinessApplicationSerializer(
        source="merchant_application",
        read_only=True,
    )

    


    def get_location(self, obj):
        point = obj.LOCT_ID.LOCT_POINT

        return {
            "address": obj.LOCT_ID.LOCT_ADDRESS,
            "city": obj.LOCT_ID.LOCT_CITY,
            "province": obj.LOCT_ID.LOCT_PROVINCE,
            "postal_code": obj.LOCT_ID.LOCT_POSTAL_CODE,
            "latitude": point.y,
            "longitude": point.x,
        }

    class Meta:
        model = Business
        fields = (
            "id",
            "business_name",
            "cover_photo_url",
            "description",
            "contact_number",
            "email",
            "website",
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
            "landmarks",
            "location",
            "photos",
            "operating_hours",
            "latest_reviews",
            "review_insights",
            "application",
        )
