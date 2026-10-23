from django.utils import timezone
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
from apps.reviews.services.business_review_summary_service import (
    BusinessReviewSummaryService,
)
from apps.reviews.services.review_moderation_retry_service import (
    ReviewModerationRetryService,
)
from apps.shared.serializers.installation_id_serializers import (
    InstallationIdInputSerializer,
)


class ReviewCreateSerializer(InstallationIdInputSerializer):
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

    show_in_community = serializers.BooleanField(required=False)
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
        attrs = super().validate(attrs)
        if not attrs or (
            set(attrs).issubset({"photos", "installation_id"})
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

    icon = serializers.CharField(
        source="TAG_ID.TAG_ICON",
        read_only=True,
    )

    class Meta:
        model = BusinessVouch
        fields = (
            "id",
            "name",
            "color",
            "icon",
        )


class ReviewListQuerySerializer(serializers.Serializer):
    """Validates optional filters and ordering for the business review list."""

    sentiment = serializers.ChoiceField(
        choices=("positive", "neutral", "negative"),
        required=False,
    )
    has_photos = serializers.BooleanField(required=False)
    merchant_replied = serializers.BooleanField(required=False)
    needs_reply = serializers.BooleanField(required=False)
    topic = serializers.CharField(required=False, trim_whitespace=True)
    ordering = serializers.ChoiceField(
        choices=("newest", "oldest", "most_liked"),
        required=False,
    )


class ReviewModerationProgressSerializer(serializers.Serializer):
    """Derives an author-facing state without exposing moderation evidence."""

    state = serializers.SerializerMethodField()

    def get_state(
        self,
        review,
    ):
        """Prefer authoritative decisions and conservatively describe held work."""
        if review.REVW_STATUS == Review.ReviewStatus.PUBLISHED:
            return "published"
        if review.REVW_STATUS == Review.ReviewStatus.REJECTED:
            return "rejected"
        if review.REVW_STATUS == Review.ReviewStatus.FLAGGED:
            return "awaiting_admin_review"

        metadata = review.REVW_MODERATION_DATA
        if not isinstance(metadata, dict):
            return "under_review"

        outcome = metadata.get("outcome")
        if outcome == "flagged":
            return "awaiting_admin_review"
        if (
            outcome == "provider_failure"
            and metadata.get("retry_exhausted") is True
        ):
            return "retries_exhausted"

        if (
            not ReviewModerationRetryService._is_retryable(review)
            or ReviewModerationRetryService._next_due(metadata) is None
        ):
            return "under_review"
        if outcome == "provider_failure":
            return "awaiting_retry"

        expires = ReviewModerationRetryService._timestamp(
            metadata.get("retry_claim_expires_at"),
        )
        if (
            metadata.get("retry_claim_token")
            and expires is not None
            and expires > timezone.now()
        ):
            return "processing"
        return "pending"


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

    has_reported = serializers.BooleanField(
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
            "sentiment_score",
            "sentiment_label",
            "is_outlier_sentiment",
            "created_at",
            "updated_at",
            "is_liked",
            "is_liked_by_owner",
            "photos",
            "vouched_specialties",
            "author",
            "reply",
            "is_own_review",
            "has_reported",
            "active_dispute_id",
        )

    def to_representation(self, instance):
        """Expose private progress only when the request belongs to the author."""
        data = super().to_representation(instance)
        if data.get("is_own_review"):
            data["show_in_community"] = instance.REVW_SHOW_IN_COMMUNITY
        request = self.context.get("request")
        if (
            request is not None
            and request.user.is_authenticated
            and request.user.pk == instance.USER_ID_id
        ):
            data["moderation_progress"] = ReviewModerationProgressSerializer(
                instance,
            ).data
            data["sentiment_aggregate_included"] = (
                BusinessReviewSummaryService.is_sentiment_included(instance)
            )
        return data


class ReviewReportSerializer(InstallationIdInputSerializer):
    """Validates a business review report request."""

    report_type = serializers.ChoiceField(
        choices=ReviewReport.ReportType.choices,
    )
    explanation = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if (
            "explanation" in self.initial_data
            and not isinstance(self.initial_data["explanation"], str)
        ):
            raise serializers.ValidationError({
                "explanation": "Explanation must be text.",
            })
        if (
            attrs["report_type"] == ReviewReport.ReportType.OTHER
            and not attrs.get("explanation")
        ):
            raise serializers.ValidationError({
                "explanation": "Please explain why you are reporting this review.",
            })
        explanation = attrs.get("explanation", "")
        if explanation and len(explanation) < 10:
            raise serializers.ValidationError({
                "explanation": "Explanation must be at least 10 characters long.",
            })
        return attrs
