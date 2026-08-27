from rest_framework import serializers

from apps.reviews.constants import (
    MAX_REVIEW_PHOTO_SIZE,
    MAX_REVIEW_PHOTOS,
)
from apps.reviews.models import ReplyPhoto, ReviewReply


class ReviewReplyCreateSerializer(serializers.Serializer):
    """Validates a business-owner reply to a review."""

    text = serializers.CharField(
        max_length=1000,
    )
    photos = serializers.ListField(
        child=serializers.ImageField(), required=False, allow_empty=True,
        max_length=MAX_REVIEW_PHOTOS,
        error_messages={"max_length": f"You can only upload a maximum of {MAX_REVIEW_PHOTOS} photos."},
    )

    def validate_photos(self, value):
        for photo in value:
            if photo.size > MAX_REVIEW_PHOTO_SIZE:
                raise serializers.ValidationError("Each reply photo must be 10 MB or smaller.")
        return value


class ReviewReplyUpdateSerializer(ReviewReplyCreateSerializer):
    text = serializers.CharField(max_length=1000, required=False)
    keep_photo_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1), required=False, allow_empty=True,
    )

    def validate(self, attrs):
        if not attrs or (
            set(attrs).issubset({"photos"})
            and not attrs.get("photos")
        ):
            raise serializers.ValidationError("Provide reply text or photos to update.")
        return attrs


class ReplyPhotoResponseSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="RPHO_ID", read_only=True)
    photo_url = serializers.URLField(source="RPHO_PHOTO_URL", read_only=True)

    class Meta:
        model = ReplyPhoto
        fields = ("id", "photo_url")


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
    photos = ReplyPhotoResponseSerializer(many=True, read_only=True)

    class Meta:
        model = ReviewReply
        fields = (
            "id",
            "text",
            "created_at",
            "updated_at",
            "photos",
        )
