from rest_framework import serializers

from apps.reviews.models import ReplyPhoto, Review, ReviewPhoto, ReviewReport, ReviewReply

MAX_REVIEW_PHOTO_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_REVIEW_PHOTOS = 3


class ReviewCreateSerializer(serializers.Serializer):
    """Validates a business review creation request and its uploaded photos."""

    text = serializers.CharField(
        max_length=1000,
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


class ReplyPhotoResponseSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="RPHO_ID", read_only=True)
    photo_url = serializers.URLField(source="RPHO_PHOTO_URL", read_only=True)

    class Meta:
        model = ReplyPhoto
        fields = ("id", "photo_url")


class ReviewReplyResponseSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="RPLY_ID", read_only=True)
    text = serializers.CharField(source="RPLY_TEXT", read_only=True)
    created_at = serializers.DateTimeField(source="RPLY_CREATED_AT", read_only=True)
    updated_at = serializers.DateTimeField(source="RPLY_UPDATED_AT", read_only=True)
    photos = ReplyPhotoResponseSerializer(many=True, read_only=True)

    class Meta:
        model = ReviewReply
        fields = ("id", "text", "created_at", "updated_at", "photos")


class ReviewAuthorResponseSerializer(serializers.Serializer):
    id = serializers.IntegerField(source="USER_ID", read_only=True)
    first_name = serializers.CharField(source="USER_FNAME", read_only=True)
    last_name = serializers.CharField(source="USER_LNAME", read_only=True)
    avatar_url = serializers.ReadOnlyField()


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
    created_at = serializers.DateTimeField(
        source="REVW_CREATED_AT",
        read_only=True,
    )
    updated_at = serializers.DateTimeField(source="REVW_UPDATED_AT", read_only=True)
    is_liked = serializers.BooleanField(read_only=True)
    photos = ReviewPhotoResponseSerializer(many=True, read_only=True)
    author = ReviewAuthorResponseSerializer(source="USER_ID", read_only=True)
    reply = ReviewReplyResponseSerializer(read_only=True)

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
            "is_liked",
            "photos",
            "author",
            "reply",
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
