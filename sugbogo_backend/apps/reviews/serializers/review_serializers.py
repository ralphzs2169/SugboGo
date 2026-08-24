from rest_framework import serializers

from apps.reviews.models import Review, ReviewReport

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

    class Meta:
        model = Review
        fields = (
            "id",
            "text",
            "status",
            "like_count",
            "report_count",
            "created_at",
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