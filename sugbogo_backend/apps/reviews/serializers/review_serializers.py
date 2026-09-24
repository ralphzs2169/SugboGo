from rest_framework import serializers

from apps.business.models.business_vouch_models import BusinessVouch
from apps.reviews.constants import (
    MAX_REVIEW_PHOTO_SIZE,
    MAX_REVIEW_PHOTOS,
)
from apps.reviews.models import (
    Review,
    ReviewPhoto,
    ReviewReport,
)
from apps.reviews.serializers.review_reply_serializers import (
    ReviewReplyResponseSerializer,
)


class ReviewCreateSerializer(serializers.Serializer):
    """Validates a business review creation request and its uploaded photos."""

    text = serializers.CharField(
        min_length=25,
        max_length=1000,
        error_messages={
            "blank": "Review text is required.",
            "min_length": "Review must be at least 25 characters long.",
            "max_length": "Review must be 1000 characters or fewer.",
        },
    )

    device_id = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    photos = serializers.ListField(
        child=serializers.ImageField(),
        required=False,
        allow_empty=True,
        max_length=MAX_REVIEW_PHOTOS,
        error_messages={
            "max_length": f"You can only upload a maximum of {MAX_REVIEW_PHOTOS} photos.",
            "invalid": "Invalid photo format.",
        },
    )

    def validate_photos(self, value):
        """Ensure review photos meet the upload size limit."""

        for photo in value:
            if photo.size > MAX_REVIEW_PHOTO_SIZE:
                raise serializers.ValidationError(
                    "Each review photo must be 10 MB or smaller.",
                )

        return value


class ReviewUpdateSerializer(ReviewCreateSerializer):
    """Validates a partial review update and the retained photo IDs."""

    text = serializers.CharField(max_length=1000, required=False)
    keep_photo_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=True,
    )

    def validate(self, attrs):
        if not attrs or (
            set(attrs).issubset({"photos", "device_id"})
            and not attrs.get("photos")
        ):
            raise serializers.ValidationError("Provide review text or photos to update.")
        return attrs


class ReviewPhotoResponseSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="RPHO_ID", read_only=True)
    photo_url = serializers.URLField(source="RPHO_PHOTO_URL", read_only=True)

    class Meta:
        model = ReviewPhoto
        fields = ("id", "photo_url")



class ReviewAuthorResponseSerializer(serializers.Serializer):
    id = serializers.IntegerField(source="USER_ID", read_only=True)
    first_name = serializers.CharField(source="USER_FNAME", read_only=True)
    last_name = serializers.CharField(source="USER_LNAME", read_only=True)
    role = serializers.CharField(source="USER_ROLE", read_only=True)
    avatar_url = serializers.ReadOnlyField()
    avatar_key = serializers.CharField(
        source="USER_AVATAR_KEY",
        read_only=True,
        allow_null=True,
    )


class ReviewVouchedSpecialtySerializer(serializers.ModelSerializer):
    """Serializes a specialty tag vouched for by a review author."""

    id = serializers.IntegerField(
        source="TAG_ID_id",
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

    class Meta:
        model = BusinessVouch
        fields = (
            "id",
            "name",
            "color",
        )


class ReviewListQuerySerializer(serializers.Serializer):
    """Validates optional filters and ordering for the business review list."""

    sentiment = serializers.ChoiceField(
        choices=("positive", "neutral", "negative"),
        required=False,
    )
    has_photos = serializers.BooleanField(required=False)
    merchant_replied = serializers.BooleanField(required=False)
    topic = serializers.CharField(required=False, trim_whitespace=True)
    ordering = serializers.ChoiceField(
        choices=("newest", "oldest", "most_liked"),
        required=False,
    )


class ReviewResponseSerializer(serializers.ModelSerializer):
    """Serializes a business review for API responses."""

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
    report_count = serializers.IntegerField(
        source="REVW_REPORT_COUNT",
        read_only=True,
    )
    sentiment_score = serializers.FloatField(
        source="REVW_SENTIMENT_SCORE",
        read_only=True,
        allow_null=True,
    )
    sentiment_label = serializers.CharField(
        source="REVW_SENTIMENT_LABEL",
        read_only=True,
        allow_null=True,
    )
    is_outlier_sentiment = serializers.BooleanField(
        source="REVW_IS_OUTLIER_SENTIMENT",
        read_only=True,
    )
    is_spam_flagged = serializers.BooleanField(
        source="REVW_IS_SPAM_FLAGGED",
        read_only=True,
    )
    is_device_abuse_flagged = serializers.BooleanField(
        source="REVW_IS_DEVICE_ABUSE_FLAGGED",
        read_only=True,
    )
    created_at = serializers.DateTimeField(
        source="REVW_CREATED_AT",
        read_only=True,
    )
    updated_at = serializers.DateTimeField(
        source="REVW_UPDATED_AT",
        read_only=True,
    )
    is_liked = serializers.BooleanField(
        read_only=True,
    )
    photos = ReviewPhotoResponseSerializer(
        many=True,
        read_only=True,
    )
    author = ReviewAuthorResponseSerializer(
        source="USER_ID",
        read_only=True,
    )

    vouched_specialties = ReviewVouchedSpecialtySerializer(
        many=True,
        read_only=True,
    )

    reply = ReviewReplyResponseSerializer(
        read_only=True,
    )

    is_own_review = serializers.BooleanField(
        read_only=True,
    )

    is_liked_by_owner = serializers.BooleanField(
        read_only=True,
    )

    active_dispute_id = serializers.IntegerField(
        read_only=True,
        allow_null=True,
    )
    
    class Meta:
        model = Review
        fields = (
            "id",
            "text",
            "status",
            "like_count",
            "report_count",
            "sentiment_score",
            "sentiment_label",
            "is_outlier_sentiment",
            "is_spam_flagged",
            "is_device_abuse_flagged",
            "created_at",
            "updated_at",
            "is_liked",
            "is_liked_by_owner",
            "photos",
            "vouched_specialties",
            "author",
            "reply",
            "is_own_review",
            "active_dispute_id",
        )

class ReviewReportSerializer(serializers.Serializer):
    """Validates a business review report request."""

    report_type = serializers.ChoiceField(
        choices=ReviewReport.ReportType.choices,
    )
    device_id = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        allow_null=True,
    )
