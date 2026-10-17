from rest_framework import serializers

from apps.reviews.serializers.community_review_serializers import (
    CommunityCategoryResponseSerializer,
)
from apps.reviews.serializers.review_serializers import ReviewResponseSerializer


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
        )
