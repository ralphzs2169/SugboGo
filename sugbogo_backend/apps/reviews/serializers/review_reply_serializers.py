from rest_framework import serializers

from apps.reviews.models import ReviewReply


class ReviewReplyCreateSerializer(serializers.Serializer):
    """Validates a business-owner reply to a review."""

    text = serializers.CharField(
        max_length=1000,
    )


class ReviewReplyResponseSerializer(serializers.ModelSerializer):
    """Serializes a business-owner reply for API responses."""

    id = serializers.IntegerField(
        source="RPLY_ID",
        read_only=True,
    )
    text = serializers.CharField(
        source="RPLY_TEXT",
        read_only=True,
    )
    created_at = serializers.DateTimeField(
        source="RPLY_CREATED_AT",
        read_only=True,
    )
    updated_at = serializers.DateTimeField(
        source="RPLY_UPDATED_AT",
        read_only=True,
    )

    class Meta:
        model = ReviewReply
        fields = (
            "id",
            "text",
            "created_at",
            "updated_at",
        )