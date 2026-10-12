"""Admin-only grouped community-report responses."""

from rest_framework import serializers

from apps.reviews.models import Review, ReviewReport
from apps.reviews.serializers.review_serializers import (
    ReviewAuthorResponseSerializer,
    ReviewPhotoResponseSerializer,
)


class ReportedReviewFilterSerializer(serializers.Serializer):
    """Validate grouped queue search, reason, and sort options."""

    search = serializers.CharField(
        max_length=200,
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )
    reason = serializers.ChoiceField(
        choices=ReviewReport.ReportType.choices,
        required=False,
    )
    ordering = serializers.ChoiceField(
        choices=("most_reported", "oldest", "newest"),
        required=False,
    )


class ReportedReviewListSerializer(serializers.ModelSerializer):
    """Summarize one review and its currently pending reports."""

    id = serializers.IntegerField(source="REVW_ID")
    author = ReviewAuthorResponseSerializer(source="USER_ID")
    business = serializers.SerializerMethodField()
    text_preview = serializers.SerializerMethodField()
    first_photo_url = serializers.URLField(read_only=True, allow_null=True)
    photo_count = serializers.IntegerField(read_only=True)
    submitted_at = serializers.DateTimeField(source="REVW_CREATED_AT")
    status = serializers.CharField(source="REVW_STATUS")
    pending_report_count = serializers.IntegerField(read_only=True)
    reason_counts = serializers.SerializerMethodField()
    first_pending_at = serializers.DateTimeField(read_only=True)
    latest_pending_at = serializers.DateTimeField(read_only=True)
    needs_attention = serializers.BooleanField(source="REVW_IS_REPORT_FLAGGED")

    class Meta:
        model = Review
        fields = (
            "id",
            "author",
            "business",
            "text_preview",
            "first_photo_url",
            "photo_count",
            "submitted_at",
            "status",
            "pending_report_count",
            "reason_counts",
            "first_pending_at",
            "latest_pending_at",
            "needs_attention",
        )

    def get_business(
        self,
        review,
    ):
        """Return the linked business identity."""
        return {
            "id": review.BUSN_ID_id,
            "name": review.BUSN_ID.BUSN_NAME,
        }

    def get_text_preview(
        self,
        review,
    ):
        """Keep the queue preview compact."""
        return review.REVW_TEXT[:160]

    def get_reason_counts(
        self,
        review,
    ):
        """Return all pending reason counts, even under a reason filter."""
        return {
            ReviewReport.ReportType.SPAM: review.spam_count,
            ReviewReport.ReportType.ABUSE: review.abuse_count,
            ReviewReport.ReportType.MISINFORMATION: review.misinformation_count,
            ReviewReport.ReportType.OTHER: review.other_count,
        }


class ReportedReviewReportSerializer(serializers.ModelSerializer):
    """Show report decisions without reporter or installation identity."""

    id = serializers.IntegerField(source="RREP_ID")
    type = serializers.CharField(source="RREP_TYPE")
    status = serializers.CharField(source="RREP_STATUS")
    created_at = serializers.DateTimeField(source="RREP_CREATED_AT")
    admin_notes = serializers.CharField(source="RREP_NOTES", allow_null=True)

    class Meta:
        model = ReviewReport
        fields = ("id", "type", "status", "created_at", "admin_notes")


class ReportedReviewDetailSerializer(ReportedReviewListSerializer):
    """Add full review content and the underlying report records."""

    text = serializers.CharField(source="REVW_TEXT")
    photos = ReviewPhotoResponseSerializer(many=True)
    reports = serializers.SerializerMethodField()

    class Meta(ReportedReviewListSerializer.Meta):
        fields = ReportedReviewListSerializer.Meta.fields + (
            "text",
            "photos",
            "reports",
        )

    def get_reports(
        self,
        review,
    ):
        """Place pending reports first while retaining resolved context."""
        reports = review.investigation_reports
        pending = [
            report
            for report in reports
            if report.RREP_STATUS == ReviewReport.ReportStatus.PENDING
        ]
        resolved = [
            report
            for report in reports
            if report.RREP_STATUS != ReviewReport.ReportStatus.PENDING
        ]
        return ReportedReviewReportSerializer(
            pending + resolved,
            many=True,
        ).data
