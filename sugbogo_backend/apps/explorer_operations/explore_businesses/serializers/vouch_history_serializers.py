from rest_framework import serializers

from apps.business.models import Business, BusinessVouch
from apps.reviews.serializers.review_serializers import (
    ReviewVouchedSpecialtySerializer,
)

from .explore_business_serializer import (
    ExploreCategorySerializer,
    ExploreSpecialtyTagSerializer,
)


class VouchHistoryQuerySerializer(serializers.Serializer):
    """Validates the requested chronology for specialty vouch history."""

    ordering = serializers.ChoiceField(
        choices=("newest", "oldest"),
        default="newest",
    )


class VouchHistoryEndorsementSerializer(serializers.ModelSerializer):
    """Serializes one original specialty endorsement within a business history row."""

    id = serializers.IntegerField(
        source="VOUCH_ID",
        read_only=True,
    )
    specialty = ReviewVouchedSpecialtySerializer(
        source="*",
        read_only=True,
    )
    created_at = serializers.DateTimeField(
        source="VOUCH_CREATED_AT",
        read_only=True,
    )

    class Meta:
        model = BusinessVouch
        fields = ("id", "specialty", "created_at")


class VouchHistorySerializer(serializers.ModelSerializer):
    """Serializes a business with its current tags and grouped user endorsements."""

    id = serializers.IntegerField(
        source="BUSN_ID",
        read_only=True,
    )
    business_id = serializers.IntegerField(
        source="BUSN_ID",
        read_only=True,
    )
    business_name = serializers.CharField(
        source="BUSN_NAME",
        read_only=True,
    )
    cover_photo_url = serializers.URLField(
        source="BUSN_COVER_PHOTO_URL",
        read_only=True,
        allow_null=True,
    )
    category = ExploreCategorySerializer(
        source="CTGRY_ID",
        read_only=True,
    )
    last_vouched_at = serializers.DateTimeField(read_only=True)
    vouches = VouchHistoryEndorsementSerializer(
        source="visible_vouches",
        many=True,
        read_only=True,
    )
    specialty_tags = ExploreSpecialtyTagSerializer(
        source="active_specialty_tag_links",
        many=True,
        read_only=True,
    )

    class Meta:
        model = Business
        fields = (
            "id",
            "business_id",
            "business_name",
            "cover_photo_url",
            "category",
            "last_vouched_at",
            "vouches",
            "specialty_tags",
        )
