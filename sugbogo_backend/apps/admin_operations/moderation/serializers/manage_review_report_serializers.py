from rest_framework import serializers

from apps.reviews.models import ReviewReport
from apps.admin_operations.moderation.serializers.manage_review_dispute_serializers import (
    MIN_MODERATION_NOTES_LENGTH,
)


class AdminReviewReportResolutionSerializer(serializers.Serializer):
    """Requires explanatory administrator notes for report decisions."""

    admin_notes = serializers.CharField(
        required=True,
        allow_blank=False,
        allow_null=False,
        min_length=MIN_MODERATION_NOTES_LENGTH,
        trim_whitespace=True,
        error_messages={
            "required": "Please provide moderation notes before resolving the report.",
            "blank": "Please provide moderation notes before resolving the report.",
            "null": "Please provide moderation notes before resolving the report.",
        },
    )


class AdminReviewReportFilterSerializer(serializers.Serializer):
    """Validates administrator report queue filters."""

    status = serializers.ChoiceField(
        choices=ReviewReport.ReportStatus.choices,
        required=False,
    )
    type = serializers.ChoiceField(
        choices=ReviewReport.ReportType.choices,
        required=False,
    )
    business = serializers.IntegerField(min_value=1, required=False)
    review = serializers.IntegerField(min_value=1, required=False)


class AdminReviewReportSerializer(serializers.ModelSerializer):
    """Exposes report evidence without private device or account details."""

    id = serializers.IntegerField(source="RREP_ID")
    type = serializers.CharField(source="RREP_TYPE")
    status = serializers.CharField(source="RREP_STATUS")
    admin_notes = serializers.CharField(source="RREP_NOTES", allow_null=True)
    created_at = serializers.DateTimeField(source="RREP_CREATED_AT")
    updated_at = serializers.DateTimeField(source="RREP_UPDATED_AT")
    reporter = serializers.SerializerMethodField()
    review = serializers.SerializerMethodField()

    def get_reporter(self, report):
        """Returns the minimal reporter identity for inspection."""
        return {"id": report.USER_ID_id}

    def get_review(self, report):
        """Returns current review content, author, business, and attached photos."""
        review = report.REVW_ID
        return {
            "id": review.pk, "text": review.REVW_TEXT,
            "status": review.REVW_STATUS,
            "author_id": review.USER_ID_id,
            "spam_flagged": review.REVW_IS_SPAM_FLAGGED,
            "device_abuse_flagged": review.REVW_IS_DEVICE_ABUSE_FLAGGED,
            "business": {"id": review.BUSN_ID_id, "name": review.BUSN_ID.BUSN_NAME},
            "photos": [{"id": photo.pk, "url": photo.RPHO_PHOTO_URL}
                       for photo in review.photos.all()],
        }

    class Meta:
        model = ReviewReport
        fields = ("id", "type", "status", "admin_notes", "created_at", "updated_at", "reporter", "review")
