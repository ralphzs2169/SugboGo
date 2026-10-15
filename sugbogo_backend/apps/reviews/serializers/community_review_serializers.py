from rest_framework import serializers

from apps.business.models import Category, Cluster, SpecialtyTag

from apps.reviews.models import Review
from apps.reviews.serializers.review_reply_serializers import (
    ReviewReplyResponseSerializer,
)
from apps.reviews.serializers.review_serializers import (
    ReviewAuthorResponseSerializer,
    ReviewPhotoResponseSerializer,
    ReviewVouchedSpecialtySerializer,
)


class CommunityReviewQuerySerializer(serializers.Serializer):
    """Validates filters and ordering for the public Community review feed."""

    page = serializers.IntegerField(
        min_value=1,
        required=False,
    )
    ordering = serializers.ChoiceField(
        choices=("newest", "most_helpful"),
        default="newest",
        required=False,
    )
    cluster = serializers.IntegerField(
        min_value=1,
        required=False,
    )
    category = serializers.ListField(
        child=serializers.IntegerField(
            min_value=1,
        ),
        required=False,
    )
    specialty_tag = serializers.IntegerField(
        min_value=1,
        required=False,
    )
    has_photos = serializers.BooleanField(
        default=False,
        required=False,
    )

    def validate(self, attrs):
        """Reject unknown taxonomy choices and categories outside the cluster."""
        errors = {}
        cluster_id = attrs.get("cluster")
        category_ids = attrs.get("category", [])
        specialty_tag_id = attrs.get("specialty_tag")

        if (
            cluster_id is not None
            and not Cluster.objects.filter(
                pk=cluster_id,
            ).exists()
        ):
            errors["cluster"] = "Select a valid cluster."

        if category_ids:
            categories = Category.objects.filter(pk__in=category_ids)
            if cluster_id is not None:
                categories = categories.filter(CLUS_ID_id=cluster_id)
            if (
                categories.values("pk").distinct().count()
                != len(set(category_ids))
            ):
                errors["category"] = "Select categories in the chosen cluster."

        if (
            specialty_tag_id is not None
            and not SpecialtyTag.objects.filter(
                pk=specialty_tag_id,
            ).exists()
        ):
            errors["specialty_tag"] = "Select a valid specialty."

        if errors:
            raise serializers.ValidationError(errors)

        return attrs


class CommunityCategoryResponseSerializer(serializers.Serializer):
    """Serializes the public category identity for a Community business."""

    id = serializers.IntegerField(
        source="BUSN_ID.CTGRY_ID.CTGRY_ID",
        read_only=True,
    )
    name = serializers.CharField(
        source="BUSN_ID.CTGRY_ID.CTGRY_NAME",
        read_only=True,
    )


class CommunityBusinessResponseSerializer(serializers.Serializer):
    """Serializes the business context linked from a Community review."""

    id = serializers.IntegerField(
        source="BUSN_ID.BUSN_ID",
        read_only=True,
    )
    business_name = serializers.CharField(
        source="BUSN_ID.BUSN_NAME",
        read_only=True,
    )
    display_cover_photo_url = serializers.URLField(
        source="community_display_cover_photo_url",
        read_only=True,
        allow_null=True,
    )
    category = CommunityCategoryResponseSerializer(
        source="*",
        read_only=True,
    )
    address = serializers.CharField(
        source="BUSN_ID.LOCT_ID.LOCT_ADDRESS",
        read_only=True,
    )


class CommunityReviewResponseSerializer(serializers.ModelSerializer):
    """Serializes public review content and business context for Community."""

    id = serializers.IntegerField(
        source="REVW_ID",
        read_only=True,
    )
    text = serializers.CharField(
        source="REVW_TEXT",
        read_only=True,
    )
    like_count = serializers.IntegerField(
        source="REVW_LIKE_COUNT",
        read_only=True,
    )
    created_at = serializers.DateTimeField(
        source="REVW_CREATED_AT",
        read_only=True,
    )
    updated_at = serializers.DateTimeField(
        source="REVW_UPDATED_AT",
        read_only=True,
    )
    is_liked = serializers.BooleanField(
        read_only=True,
    )
    is_liked_by_owner = serializers.BooleanField(
        read_only=True,
    )
    is_own_review = serializers.BooleanField(
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
    vouched_specialties = ReviewVouchedSpecialtySerializer(
        many=True,
        read_only=True,
    )
    reply = ReviewReplyResponseSerializer(
        read_only=True,
    )
    business = CommunityBusinessResponseSerializer(
        source="*",
        read_only=True,
    )

    class Meta:
        model = Review
        fields = (
            "id",
            "text",
            "like_count",
            "created_at",
            "updated_at",
            "is_liked",
            "is_liked_by_owner",
            "is_own_review",
            "author",
            "photos",
            "vouched_specialties",
            "reply",
            "business",
        )
