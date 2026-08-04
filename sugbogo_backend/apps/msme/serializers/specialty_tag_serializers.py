from rest_framework import serializers

from apps.msme.models import SpecialtyTag


class SpecialtyTagSerializer(serializers.ModelSerializer):
    """Serializer for retrieving specialty tag data."""

    id = serializers.IntegerField(
        source="TAG_ID",
        read_only=True,
    )
    name = serializers.CharField(
        source="TAG_NAME",
        read_only=True,
    )
    created_at = serializers.DateTimeField(
        source="TAG_CREATED_AT",
        read_only=True,
    )
    updated_at = serializers.DateTimeField(
        source="TAG_UPDATED_AT",
        read_only=True,
    )

    class Meta:
        model = SpecialtyTag
        fields = (
            "id",
            "name",
            "created_at",
            "updated_at",
        )


class SpecialtyTagCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a specialty tag."""

    name = serializers.CharField(
        source="TAG_NAME",
        error_messages={
            "blank": "Specialty tag name is required.",
            "null": "Specialty tag name is required.",
            "required": "Specialty tag name is required.",
        },
    )

    class Meta:
        model = SpecialtyTag
        fields = (
            "name",
        )


class SpecialtyTagUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating a specialty tag."""

    name = serializers.CharField(
        source="TAG_NAME",
        required=False,
        error_messages={
            "blank": "Specialty tag name is required.",
            "null": "Specialty tag name is required.",
        },
    )

    class Meta:
        model = SpecialtyTag
        fields = (
            "name",
        )