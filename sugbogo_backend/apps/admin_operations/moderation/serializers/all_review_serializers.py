"""Explicit Admin directory and inspection contracts without investigation payloads."""

from datetime import date

from django.urls import reverse
from rest_framework import serializers

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.moderation.serializers.manage_under_review_serializers import (
    moderation_data,
)
from apps.admin_operations.moderation.serializers.reported_review_serializers import (
    ReportedReviewReportSerializer,
)
from apps.reviews.models import Review
from apps.reviews.serializers.review_serializers import (
    ReviewAuthorResponseSerializer,
    ReviewPhotoResponseSerializer,
)


class AdminAllReviewFilterSerializer(serializers.Serializer):
    """Validate search, lifecycle filters, Manila calendar dates, and ordering."""

    search = serializers.CharField(
        max_length=200,
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )
    status = serializers.ChoiceField(
        choices=Review.ReviewStatus.choices,
        required=False,
    )
    reported = serializers.BooleanField(required=False)
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)
    ordering = serializers.ChoiceField(
        choices=("newest", "oldest"),
        required=False,
        default="newest",
    )

    def validate(
        self,
        attrs,
    ):
        """Reject reversed dates and bounds that cannot form an exclusive end."""
        start_date = attrs.get("start_date")
        end_date = attrs.get("end_date")
        if end_date == date.max:
            raise serializers.ValidationError({
                "end_date": "Enter a date before 9999-12-31.",
            })
        if (
            start_date is not None
            and end_date is not None
            and start_date > end_date
        ):
            raise serializers.ValidationError({
                "end_date": "End date must be on or after start date.",
            })
        return attrs


class AdminAllReviewAuthorSerializer(ReviewAuthorResponseSerializer):
    """Extend the shared author identity with existing Admin-visible email."""

    name = serializers.CharField(source="full_name", read_only=True)
    email = serializers.EmailField(source="USER_EMAIL", read_only=True)


class AdminAllReviewListSerializer(serializers.ModelSerializer):
    """Provide each table row's content, identities, media, and report counts."""

    id = serializers.IntegerField(source="REVW_ID", read_only=True)
    text = serializers.CharField(source="REVW_TEXT", read_only=True)
    author = AdminAllReviewAuthorSerializer(source="USER_ID", read_only=True)
    business = serializers.SerializerMethodField()
    status = serializers.CharField(source="REVW_STATUS", read_only=True)
    submitted_at = serializers.DateTimeField(source="REVW_CREATED_AT", read_only=True)
    first_photo_url = serializers.URLField(read_only=True, allow_null=True)
    photo_count = serializers.IntegerField(read_only=True)
    report_count = serializers.IntegerField(read_only=True)
    pending_report_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Review
        fields = (
            "id",
            "text",
            "author",
            "business",
            "status",
            "submitted_at",
            "first_photo_url",
            "photo_count",
            "report_count",
            "pending_report_count",
        )

    def get_business(
        self,
        review,
    ):
        """Reuse the established Admin business identity and classification names."""
        business = review.BUSN_ID
        category = business.CTGRY_ID
        return {
            "id": business.pk,
            "name": business.BUSN_NAME,
            "cover_photo_url": business.BUSN_COVER_PHOTO_URL,
            "category_name": category.CTGRY_NAME,
            "cluster_name": category.CLUS_ID.CLUS_NAME,
        }


class AdminAllReviewReportSerializer(ReportedReviewReportSerializer):
    """Retain grouped-report privacy while including meaningful lifecycle dates."""

    updated_at = serializers.DateTimeField(source="RREP_UPDATED_AT", read_only=True)
    withdrawn_at = serializers.DateTimeField(
        source="RREP_WITHDRAWN_AT",
        read_only=True,
        allow_null=True,
    )

    class Meta(ReportedReviewReportSerializer.Meta):
        fields = ReportedReviewReportSerializer.Meta.fields + (
            "updated_at",
            "withdrawn_at",
        )


class AdminAllReviewDetailSerializer(AdminAllReviewListSerializer):
    """Add stored analysis, reports, history, and existing moderation destinations."""

    photos = ReviewPhotoResponseSerializer(many=True, read_only=True)
    reports = AdminAllReviewReportSerializer(many=True, read_only=True)
    updated_at = serializers.DateTimeField(source="REVW_UPDATED_AT", read_only=True)
    edited_at = serializers.DateTimeField(
        source="REVW_EDITED_AT",
        read_only=True,
        allow_null=True,
    )
    published_at = serializers.DateTimeField(
        source="REVW_PUBLISHED_AT",
        read_only=True,
        allow_null=True,
    )
    sentiment = serializers.SerializerMethodField()
    moderation = serializers.SerializerMethodField()
    history = serializers.SerializerMethodField()
    moderation_links = serializers.SerializerMethodField()

    class Meta(AdminAllReviewListSerializer.Meta):
        fields = AdminAllReviewListSerializer.Meta.fields + (
            "photos",
            "reports",
            "updated_at",
            "edited_at",
            "published_at",
            "sentiment",
            "moderation",
            "history",
            "moderation_links",
        )

    def get_sentiment(
        self,
        review,
    ):
        """Expose the existing stored sentiment without generating new analysis."""
        return {
            "label": review.REVW_SENTIMENT_LABEL,
            "score": review.REVW_SENTIMENT_SCORE,
        }

    def get_moderation(
        self,
        review,
    ):
        """Summarize only recognized stored outcomes and availability state."""
        data = moderation_data(review)
        outcome = data.get("outcome")
        if outcome not in ("safe", "flagged", "provider_failure"):
            outcome = None
        return {
            "outcome": outcome,
            "provider_unavailable": (
                outcome == "provider_failure"
                or data.get("incomplete") is True
            ),
            "checked_at": data.get("checked_at"),
        }

    def get_history(
        self,
        review,
    ):
        """Project existing decision events without returning their raw context."""
        history = []
        for activity in review.review_history:
            context = activity.AACT_CONTEXT
            actor = activity.ACTOR_ID
            history.append({
                "id": activity.pk,
                "action": activity.AACT_ACTION,
                "created_at": activity.AACT_CREATED_AT,
                "actor": {
                    "id": actor.pk,
                    "first_name": actor.USER_FNAME,
                    "last_name": actor.USER_LNAME,
                },
                "previous_review_status": context.get("previous_review_status"),
                "review_status": context.get("review_status"),
                "notes": (
                    context.get("moderation_notes")
                    or context.get("admin_notes")
                ),
            })
        return history

    def get_moderation_links(
        self,
        review,
    ):
        """Link only to existing detail routes whose eligibility is satisfied."""
        under_review_url = None
        reported_review_url = None
        review_dispute_url = None
        has_manual_decision = any(
            activity.AACT_ACTION in (
                AdminActivity.Action.REVIEW_MODERATION_APPROVED,
                AdminActivity.Action.REVIEW_MODERATION_REJECTED,
            )
            for activity in review.review_history
        )
        if (
            review.REVW_STATUS == Review.ReviewStatus.UNDER_REVIEW
            or has_manual_decision
        ):
            under_review_url = reverse(
                "admin-under-review-detail",
                args=[review.pk],
            )
        if review.pending_report_count:
            reported_review_url = reverse(
                "admin-reported-review-detail",
                args=[review.pk],
            )
        if review.active_dispute_id is not None:
            review_dispute_url = reverse(
                "admin-review-dispute-detail",
                args=[review.active_dispute_id],
            )
        return {
            "under_review": under_review_url,
            "reported_review": reported_review_url,
            "review_dispute": review_dispute_url,
        }
