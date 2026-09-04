from rest_framework import serializers

from apps.business.serializers.business_serializers import (
    BusinessOwnerSerializer,
)
from apps.review_disputes.models import MerchantReviewDispute
from apps.review_disputes.serializers import (
    DisputeEvidenceResponseSerializer,
)
from apps.reviews.models import Review
from apps.reviews.serializers.review_serializers import (
    ReviewAuthorResponseSerializer,
    ReviewPhotoResponseSerializer,
)


class AdminReviewDisputeListSerializer(serializers.ModelSerializer):
    """Serialize review disputes for the administrator list."""

    id = serializers.IntegerField(
        source="MRDSP_ID",
        read_only=True,
    )
    reason = serializers.CharField(
        source="MRDSP_REASON",
        read_only=True,
    )
    status = serializers.CharField(
        source="MRDSP_STATUS",
        read_only=True,
    )
    created_at = serializers.DateTimeField(
        source="MRDSP_CREATED_AT",
        read_only=True,
    )
    business_id = serializers.IntegerField(
        source="BUSN_ID_id",
        read_only=True,
    )
    business_name = serializers.CharField(
        source="BUSN_ID.BUSN_NAME",
        read_only=True,
    )
    review_id = serializers.IntegerField(
        source="REVW_ID_id",
        read_only=True,
    )
    merchant = BusinessOwnerSerializer(
        source="USER_ID",
        read_only=True,
    )
    review_author = ReviewAuthorResponseSerializer(
        source="REVW_ID.USER_ID",
        read_only=True,
    )

    class Meta:
        model = MerchantReviewDispute
        fields = (
            "id",
            "reason",
            "status",
            "created_at",
            "business_id",
            "business_name",
            "review_id",
            "merchant",
            "review_author",
        )


class AdminDisputedReviewSerializer(serializers.ModelSerializer):
    """Serialize the disputed review for administrator review."""

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
    moderation_notes = serializers.CharField(
        source="REVW_MODERATION_NOTES",
        read_only=True,
    )
    created_at = serializers.DateTimeField(
        source="REVW_CREATED_AT",
        read_only=True,
    )
    author = ReviewAuthorResponseSerializer(
        source="USER_ID",
        read_only=True,
    )
    photos = ReviewPhotoResponseSerializer(
        many=True,
        read_only=True,
    )
    is_spam_flagged = serializers.BooleanField(
        source="REVW_IS_SPAM_FLAGGED",
        read_only=True,
    )
    is_outlier_sentiment = serializers.BooleanField(
        source="REVW_IS_OUTLIER_SENTIMENT",
        read_only=True,
    )
    is_device_abuse_flagged = serializers.BooleanField(
        source="REVW_IS_DEVICE_ABUSE_FLAGGED",
        read_only=True,
    )

    class Meta:
        model = Review
        fields = (
            "id",
            "text",
            "status",
            "moderation_notes",
            "created_at",
            "author",
            "photos",
            "is_spam_flagged",
            "is_outlier_sentiment",
            "is_device_abuse_flagged",
        )


class AdminReviewDisputeDetailSerializer(serializers.ModelSerializer):
    """Serialize complete review dispute details for administrators."""

    id = serializers.IntegerField(
        source="MRDSP_ID",
        read_only=True,
    )
    reason = serializers.CharField(
        source="MRDSP_REASON",
        read_only=True,
    )
    description = serializers.CharField(
        source="MRDSP_DESCRIPTION",
        read_only=True,
    )
    status = serializers.CharField(
        source="MRDSP_STATUS",
        read_only=True,
    )
    admin_notes = serializers.CharField(
        source="MRDSP_ADMIN_NOTES",
        read_only=True,
    )
    resolved_at = serializers.DateTimeField(
        source="MRDSP_RESOLVED_AT",
        read_only=True,
    )
    created_at = serializers.DateTimeField(
        source="MRDSP_CREATED_AT",
        read_only=True,
    )
    updated_at = serializers.DateTimeField(
        source="MRDSP_UPDATED_AT",
        read_only=True,
    )
    business_id = serializers.IntegerField(
        source="BUSN_ID_id",
        read_only=True,
    )
    business_name = serializers.CharField(
        source="BUSN_ID.BUSN_NAME",
        read_only=True,
    )
    merchant = BusinessOwnerSerializer(
        source="USER_ID",
        read_only=True,
    )
    review = AdminDisputedReviewSerializer(
        source="REVW_ID",
        read_only=True,
    )
    evidence = DisputeEvidenceResponseSerializer(
        many=True,
        read_only=True,
    )

    class Meta:
        model = MerchantReviewDispute
        fields = (
            "id",
            "reason",
            "description",
            "status",
            "admin_notes",
            "resolved_at",
            "created_at",
            "updated_at",
            "business_id",
            "business_name",
            "merchant",
            "review",
            "evidence",
        )


class AdminReviewDisputeResolutionSerializer(serializers.Serializer):
    """Validate administrator notes when resolving a review dispute."""

    admin_notes = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )