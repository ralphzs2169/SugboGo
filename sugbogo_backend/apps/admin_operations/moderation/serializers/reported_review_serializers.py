"""Admin-only grouped community-report responses."""

from rest_framework import serializers

from apps.reviews.models import Review, ReviewReply, ReviewReport
from apps.reviews.serializers.review_serializers import (
    ReviewAuthorResponseSerializer,
    ReviewPhotoResponseSerializer,
)
from apps.reviews.serializers.review_reply_serializers import (
    ReviewReplyResponseSerializer,
)
from apps.admin_operations.moderation.serializers.manage_review_dispute_serializers import (
    MIN_MODERATION_NOTES_LENGTH,
)


class ReportedReviewDecisionSerializer(serializers.Serializer):
    """Validate one Admin decision for all pending reports on a review."""

    decision = serializers.ChoiceField(
        choices=("keep", "reject", "confirm", "dismiss"),
    )
    admin_notes = serializers.CharField(
        min_length=MIN_MODERATION_NOTES_LENGTH,
        max_length=2000,
        trim_whitespace=True,
    )


class ReportedReviewFilterSerializer(serializers.Serializer):
    """Validate grouped queue search, reason, status, and sort options."""

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
    status = serializers.ChoiceField(
        choices=(
            Review.ReviewStatus.PUBLISHED,
            Review.ReviewStatus.REJECTED,
        ),
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
    has_reply = serializers.BooleanField(read_only=True)
    is_edited = serializers.SerializerMethodField()
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
            "has_reply",
            "is_edited",
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

    def get_is_edited(self, review):
        """Only a recorded review edit counts as edited."""
        return review.REVW_EDITED_AT is not None

    def get_reason_counts(
        self,
        review,
    ):
        """Return all pending reason counts, even under a reason filter."""
        return {
            ReviewReport.ReportType.SPAM: review.spam_count,
            ReviewReport.ReportType.ABUSE: review.abuse_count,
            ReviewReport.ReportType.MISINFORMATION: review.misinformation_count,
            ReviewReport.ReportType.OFF_TOPIC: review.off_topic_count,
            ReviewReport.ReportType.PRIVATE_INFORMATION: review.private_information_count,
            ReviewReport.ReportType.OTHER: review.other_count,
        }


class ReportedReviewReportSerializer(serializers.ModelSerializer):
    """Show report decisions without reporter or installation identity."""

    id = serializers.IntegerField(source="RREP_ID")
    type = serializers.CharField(source="RREP_TYPE")
    status = serializers.CharField(source="RREP_STATUS")
    created_at = serializers.DateTimeField(source="RREP_CREATED_AT")
    admin_notes = serializers.CharField(source="RREP_NOTES", allow_null=True)
    explanation = serializers.CharField(source="RREP_EXPLANATION", allow_null=True)

    class Meta:
        model = ReviewReport
        fields = (
            "id",
            "type",
            "status",
            "created_at",
            "admin_notes",
            "explanation",
        )


class ReportedReviewDetailSerializer(ReportedReviewListSerializer):
    """Add full review content and the underlying report records."""

    text = serializers.CharField(source="REVW_TEXT")
    photos = ReviewPhotoResponseSerializer(many=True)
    reports = serializers.SerializerMethodField()
    like_count = serializers.IntegerField(source="REVW_LIKE_COUNT")
    edited_at = serializers.DateTimeField(
        source="REVW_EDITED_AT",
        allow_null=True,
    )
    reply = serializers.SerializerMethodField()

    class Meta(ReportedReviewListSerializer.Meta):
        fields = ReportedReviewListSerializer.Meta.fields + (
            "text",
            "photos",
            "reports",
            "like_count",
            "edited_at",
            "reply",
        )

    def get_business(self, review):
        """Include business cover and classification in Admin detail."""
        business = review.BUSN_ID
        category = business.CTGRY_ID
        cluster = category.CLUS_ID

        return {
            "id": review.BUSN_ID_id,
            "name": business.BUSN_NAME,
            "cover_photo_url": business.BUSN_COVER_PHOTO_URL,
            "cluster_name": cluster.CLUS_NAME,
            "category_name": category.CTGRY_NAME,
        }

    def get_reply(self, review):
        """Expose an existing merchant reply only in Admin detail."""
        try:
            reply = review.reply
        except ReviewReply.DoesNotExist:
            return None
        return ReviewReplyResponseSerializer(reply).data

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
