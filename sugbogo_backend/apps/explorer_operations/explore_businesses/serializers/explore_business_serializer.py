from apps.business.models import (
    Business,
    BusinessOperatingHours,
    BusinessPhoto,
)
from apps.reviews.models import (
    Review,
    ReviewPhoto,
    ReviewReply,
)
from rest_framework import serializers


class ExploreClusterSerializer(serializers.Serializer):
    """Serializes the cluster information shown on Explorer business cards."""

    id = serializers.IntegerField(
        source="CLUS_ID",
        read_only=True,
    )
    name = serializers.CharField(
        source="CLUS_NAME",
        read_only=True,
    )
    icon = serializers.CharField(
        source="CLUS_ICON",
        read_only=True,
    )


class ExploreCategorySerializer(serializers.Serializer):
    """Serializes the category information shown on Explorer business cards."""

    id = serializers.IntegerField(
        source="CTGRY_ID",
        read_only=True,
    )
    name = serializers.CharField(
        source="CTGRY_NAME",
        read_only=True,
    )


class ExploreSpecialtyTagSerializer(serializers.Serializer):
    """Serializes a specialty tag with its Explorer vouch information."""

    id = serializers.IntegerField(
        source="TAG_ID.TAG_ID",
        read_only=True,
    )
    name = serializers.CharField(
        source="TAG_ID.TAG_NAME",
        read_only=True,
    )
    color = serializers.CharField(
        source="TAG_ID.TAG_COLOR",
        read_only=True,
    )
    icon = serializers.CharField(
        source="TAG_ID.TAG_ICON",
        read_only=True,
    )
    vouch_count = serializers.IntegerField(
        source="BST_VOUCH_COUNT",
        read_only=True,
    )
    is_vouched = serializers.BooleanField(
        read_only=True,
    )


class ExploreLocationSerializer(serializers.Serializer):
    """Serializes location information shown on Explorer business cards."""

    address = serializers.CharField(
        source="LOCT_ADDRESS",
        read_only=True,
    )
    city = serializers.CharField(
        source="LOCT_CITY",
        read_only=True,
    )
    province = serializers.CharField(
        source="LOCT_PROVINCE",
        read_only=True,
    )
    latitude = serializers.FloatField(
        source="LOCT_POINT.y",
        read_only=True,
    )
    longitude = serializers.FloatField(
        source="LOCT_POINT.x",
        read_only=True,
    )


class ExploreBusinessSerializer(serializers.ModelSerializer):
    """Serializes the public business information used by Explorer."""

    id = serializers.IntegerField(
        source="BUSN_ID",
        read_only=True,
    )
    business_name = serializers.CharField(
        source="BUSN_NAME",
        read_only=True,
    )
    cover_photo_url = serializers.URLField(
        source="BUSN_COVER_PHOTO_URL",
        read_only=True,
        allow_null=True,
    )
    is_pocketed = serializers.BooleanField(
        read_only=True,
    )

    cluster = ExploreClusterSerializer(
        source="CTGRY_ID.CLUS_ID",
        read_only=True,
    )
    category = ExploreCategorySerializer(
        source="CTGRY_ID",
        read_only=True,
    )
    specialty_tags = ExploreSpecialtyTagSerializer(
        source="active_specialty_tag_links",
        many=True,
        read_only=True,
    )
    location = ExploreLocationSerializer(
        source="LOCT_ID",
        read_only=True,
    )

    class Meta:
        model = Business
        fields = (
            "id",
            "business_name",
            "cover_photo_url",
            "is_pocketed",
            "cluster",
            "category",
            "specialty_tags",
            "location",
        )



class RecommendationBusinessSerializer(ExploreBusinessSerializer):
    """Adds a transient shared-interest reason to recommendation results."""

    recommendation_reason = serializers.SerializerMethodField()

    @staticmethod
    def get_recommendation_reason(instance):
        return getattr(
            instance,
            "recommendation_reason",
            None,
        )

    class Meta(ExploreBusinessSerializer.Meta):
        fields = ExploreBusinessSerializer.Meta.fields + (
            "recommendation_reason",
        )


class ExploreBusinessPhotoSerializer(serializers.ModelSerializer):
    """Serializes a public business photo for Explorer."""

    id = serializers.IntegerField(
        source="BPHO_ID",
        read_only=True,
    )
    photo_url = serializers.URLField(
        source="BPHO_PHOTO_URL",
        read_only=True,
    )
    category = serializers.CharField(
        source="BPHO_CATEGORY",
        read_only=True,
    )

    class Meta:
        model = BusinessPhoto
        fields = (
            "id",
            "photo_url",
            "category",
        )


class ExploreOperatingHoursSerializer(serializers.ModelSerializer):
    """Serializes business operating hours for Explorer."""

    id = serializers.IntegerField(
        source="BOHR_ID",
        read_only=True,
    )
    day = serializers.CharField(
        source="BOHR_DAY",
        read_only=True,
    )
    is_open = serializers.BooleanField(
        source="BOHR_IS_OPEN",
        read_only=True,
    )
    is_24_hours = serializers.BooleanField(
        source="BOHR_IS_24_HOURS",
        read_only=True,
    )
    open_time = serializers.TimeField(
        source="BOHR_OPEN_TIME",
        read_only=True,
        allow_null=True,
    )
    close_time = serializers.TimeField(
        source="BOHR_CLOSE_TIME",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = BusinessOperatingHours
        fields = (
            "id",
            "day",
            "is_open",
            "is_24_hours",
            "open_time",
            "close_time",
        )


class ExploreReviewAuthorSerializer(serializers.Serializer):
    """Serializes the public author information shown with a business review."""

    id = serializers.IntegerField(
        source="USER_ID",
        read_only=True,
    )
    first_name = serializers.CharField(
        source="USER_FNAME",
        read_only=True,
    )
    last_name = serializers.CharField(
        source="USER_LNAME",
        read_only=True,
    )
    avatar_url = serializers.ReadOnlyField()
    avatar_key = serializers.CharField(
        source="USER_AVATAR_KEY",
        read_only=True,
        allow_null=True,
    )


class ExploreReviewPhotoSerializer(serializers.ModelSerializer):
    """Serializes a public photo attached to a business review."""

    id = serializers.IntegerField(
        source="RPHO_ID",
        read_only=True,
    )
    photo_url = serializers.URLField(
        source="RPHO_PHOTO_URL",
        read_only=True,
    )

    class Meta:
        model = ReviewPhoto
        fields = (
            "id",
            "photo_url",
        )


class ExploreReviewReplySerializer(serializers.ModelSerializer):
    """Serializes the business owner's public reply to a review."""

    id = serializers.IntegerField(
        source="RPLY_ID",
        read_only=True,
    )
    text = serializers.CharField(
        source="RPLY_TEXT",
        read_only=True,
    )
    created_at = serializers.DateTimeField(
        source="RPLY_CREATED_AT",
        read_only=True,
    )
    updated_at = serializers.DateTimeField(
        source="RPLY_UPDATED_AT",
        read_only=True,
    )
    photos = serializers.SerializerMethodField()

    def get_photos(self, instance):
        return ExploreReviewPhotoSerializer(instance.photos.all(), many=True).data

    class Meta:
        model = ReviewReply
        fields = (
            "id",
            "text",
            "created_at",
            "updated_at",
            "photos",
        )


class ExploreReviewSerializer(serializers.ModelSerializer):
    """Serializes a public business review for Explorer."""

    id = serializers.IntegerField(
        source="REVW_ID",
        read_only=True,
    )
    text = serializers.CharField(
        source="REVW_TEXT",
        read_only=True,
    )
    status = serializers.CharField(
        source="REVW_STATUS",
        read_only=True,
    )
    like_count = serializers.IntegerField(
        source="REVW_LIKE_COUNT",
        read_only=True,
    )
    is_liked = serializers.BooleanField(
        read_only=True,
    )
    sentiment_label = serializers.CharField(
        source="REVW_SENTIMENT_LABEL",
        read_only=True,
        allow_null=True,
    )
    created_at = serializers.DateTimeField(
        source="REVW_CREATED_AT",
        read_only=True,
    )
    updated_at = serializers.DateTimeField(
        source="REVW_UPDATED_AT",
        read_only=True,
    )

    author = ExploreReviewAuthorSerializer(
        source="USER_ID",
        read_only=True,
    )

    photos = ExploreReviewPhotoSerializer(
        many=True,
        read_only=True,
    )

    reply = ExploreReviewReplySerializer(
        read_only=True,
    )

    class Meta:
        model = Review
        fields = (
            "id",
            "text",
            "status",
            "like_count",
            "is_liked",
            "sentiment_label",
            "created_at",
            "updated_at",
            "author",
            "photos",
            "reply",
        )


class ExploreBusinessDetailSerializer(ExploreBusinessSerializer):
    """Serializes the complete public business profile for Explorer."""

    description = serializers.CharField(
        source="BUSN_DESCRIPTION",
        read_only=True,
        allow_null=True,
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

    photos = ExploreBusinessPhotoSerializer(
        many=True,
        read_only=True,
    )

    operating_hours = ExploreOperatingHoursSerializer(
        many=True,
        read_only=True,
    )

    reviews = ExploreReviewSerializer(
        many=True,
        read_only=True,
    )

    is_own_business = serializers.SerializerMethodField()

    has_own_review = serializers.SerializerMethodField()

    def get_is_own_business(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)

        return bool(
            user
            and user.is_authenticated
            and obj.USER_ID_id == user.USER_ID
        )

    def get_has_own_review(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)

        if not user or not user.is_authenticated:
            return False

        return Review.objects.filter(
            BUSN_ID=obj.BUSN_ID,
            USER_ID=user,
        ).exists()

    class Meta(ExploreBusinessSerializer.Meta):
        fields = ExploreBusinessSerializer.Meta.fields + (
            "description",
            "contact_number",
            "email",
            "website",
            "photos",
            "operating_hours",
            "reviews",
            "is_own_business",
            "has_own_review",
        )
