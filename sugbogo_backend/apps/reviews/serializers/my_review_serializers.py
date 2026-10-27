from rest_framework import serializers

from apps.admin_operations.activity_management.models import AdminActivity
from apps.reviews.models import Review
from apps.reviews.serializers.community_review_serializers import (
    CommunityCategoryResponseSerializer,
)
from apps.reviews.serializers.review_serializers import ReviewResponseSerializer


class MyReviewQuerySerializer(serializers.Serializer):
    """Validates author-history filters and ordering."""

    status = serializers.ChoiceField(
        choices=["all", "published", "under_review", "not_published"],
        default="all",
    )
    ordering = serializers.ChoiceField(
        choices=["newest", "oldest"],
        default="newest",
    )


class MyReviewBusinessResponseSerializer(serializers.Serializer):
    """Serializes compact business identity and availability for author history."""

    id = serializers.IntegerField(
        source="BUSN_ID.BUSN_ID",
        read_only=True,
    )
    business_name = serializers.CharField(
        source="BUSN_ID.BUSN_NAME",
        read_only=True,
    )
    display_cover_photo_url = serializers.URLField(
        source="my_review_display_cover_photo_url",
        read_only=True,
        allow_null=True,
    )
    category = CommunityCategoryResponseSerializer(
        source="*",
        read_only=True,
    )
    status = serializers.CharField(
        source="BUSN_ID.BUSN_STATUS",
        read_only=True,
    )


class MyReviewResponseSerializer(ReviewResponseSerializer):
    """Exposes author-history fields while excluding internal review diagnostics."""

    edited_at = serializers.DateTimeField(
        source="REVW_EDITED_AT",
        read_only=True,
        allow_null=True,
    )
    show_in_community = serializers.BooleanField(
        source="REVW_SHOW_IN_COMMUNITY",
        read_only=True,
    )
    business = MyReviewBusinessResponseSerializer(
        source="*",
        read_only=True,
    )
    non_public_reason = serializers.SerializerMethodField()
    has_pending_merchant_dispute = serializers.SerializerMethodField()

    def get_non_public_reason(
        self,
        review,
    ):
        """Expose only a verified rejection transition's public-facing category."""
        if review.REVW_STATUS != Review.ReviewStatus.REJECTED:
            return "unknown"
        reasons = {
            AdminActivity.Action.REVIEW_MODERATION_REJECTED: "moderation",
            AdminActivity.Action.REVIEW_REPORT_APPROVED: "community_reports",
            AdminActivity.Action.REPORTED_REVIEW_REJECTED: "community_reports",
            AdminActivity.Action.REVIEW_DISPUTE_UPHELD: "merchant_dispute",
        }
        return reasons.get(
            getattr(review, "my_review_rejection_action", None),
            "unknown",
        )

    def get_has_pending_merchant_dispute(
        self,
        review,
    ):
        """Indicate an active case only while the author's review stays published."""
        return (
            review.REVW_STATUS == Review.ReviewStatus.PUBLISHED
            and bool(getattr(review, "my_review_pending_dispute", False))
        )

    class Meta(ReviewResponseSerializer.Meta):
        fields = (
            "id",
            "text",
            "status",
            "created_at",
            "updated_at",
            "edited_at",
            "photos",
            "author",
            "reply",
            "is_own_review",
            "show_in_community",
            "vouched_specialties",
            "business",
            "non_public_reason",
            "has_pending_merchant_dispute",
        )
