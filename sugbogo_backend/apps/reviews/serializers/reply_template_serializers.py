from rest_framework import serializers

from apps.reviews.models import ReplyTemplate


class ReplyTemplateCreateSerializer(serializers.Serializer):
    """Validates a merchant's saved reply template."""

    title = serializers.CharField(
        max_length=100,
    )

    text = serializers.CharField(
        max_length=1000,
    )


class ReplyTemplateUpdateSerializer(serializers.Serializer):
    """Validates updates to a merchant's saved reply template."""

    title = serializers.CharField(
        max_length=100,
        required=False,
    )

    text = serializers.CharField(
        max_length=1000,
        required=False,
    )

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError(
                "Provide a title or text to update.",
            )

        return attrs


class ReplyTemplateResponseSerializer(serializers.ModelSerializer):
    """Serializes a saved reply template for API responses."""

    id = serializers.IntegerField(
        source="RTPL_ID",
        read_only=True,
    )

    title = serializers.CharField(
        source="RTPL_TITLE",
        read_only=True,
    )

    text = serializers.CharField(
        source="RTPL_TEXT",
        read_only=True,
    )

    created_at = serializers.DateTimeField(
        source="RTPL_CREATED_AT",
        read_only=True,
    )

    updated_at = serializers.DateTimeField(
        source="RTPL_UPDATED_AT",
        read_only=True,
    )

    class Meta:
        model = ReplyTemplate
        fields = (
            "id",
            "title",
            "text",
            "created_at",
            "updated_at",
        )