from rest_framework import serializers

from apps.business.models import BusinessVouch
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


class VouchHistorySerializer(serializers.ModelSerializer):
    """Serializes a specialty vouch and its current public business information."""

    id = serializers.IntegerField(
        source="VOUCH_ID",
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
    cover_photo_url = serializers.URLField(
        source="BUSN_ID.BUSN_COVER_PHOTO_URL",
        read_only=True,
        allow_null=True,
    )
    category = ExploreCategorySerializer(
        source="BUSN_ID.CTGRY_ID",
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
    specialty_tags = ExploreSpecialtyTagSerializer(
        source="BUSN_ID.active_specialty_tag_links",
        many=True,
        read_only=True,
    )

    class Meta:
        model = BusinessVouch
        fields = (
            "id",
            "business_id",
            "business_name",
            "cover_photo_url",
            "category",
            "specialty",
            "created_at",
            "specialty_tags",
        )
