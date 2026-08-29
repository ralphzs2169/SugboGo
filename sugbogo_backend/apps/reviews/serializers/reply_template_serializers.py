from rest_framework import serializers

from apps.reviews.models import ReplyTemplate


class ReplyTemplateCreateSerializer(serializers.Serializer):
    """Validates a merchant's saved reply template."""

    title = serializers.CharField(
        min_length=2,
        max_length=100,
        error_messages={
            "blank": "Template title is required.",
            "min_length": "Template title must be at least 2 characters.",
            "max_length": "Template title cannot exceed 100 characters.",
        },
    )

    text = serializers.CharField(
        min_length=10,
        max_length=1000,
        error_messages={
            "blank": "Template response is required.",
            "min_length": "Template response must be at least 10 characters.",
            "max_length": "Template response cannot exceed 1000 characters.",
        },
    )


class ReplyTemplateUpdateSerializer(serializers.Serializer):
    """Validates updates to a merchant's saved reply template."""

    title = serializers.CharField(
        min_length=2,
        max_length=100,
        required=False,
        error_messages={
            "blank": "Template title cannot be empty.",
            "min_length": "Template title must be at least 2 characters.",
            "max_length": "Template title cannot exceed 100 characters.",
        },
    )

    text = serializers.CharField(
        min_length=10,
        max_length=1000,
        required=False,
        error_messages={
            "blank": "Template response cannot be empty.",
            "min_length": "Template response must be at least 10 characters.",
            "max_length": "Template response cannot exceed 1000 characters.",
        },
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