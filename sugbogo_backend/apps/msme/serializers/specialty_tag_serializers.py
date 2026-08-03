from rest_framework import serializers

from apps.msme.models import SpecialtyTag


class SpecialtyTagSerializer(serializers.ModelSerializer):
    """Serializer for retrieving specialty tag data."""

    class Meta:
        model = SpecialtyTag
        fields = (
            "TAG_ID",
            "TAG_NAME",
            "TAG_CREATED_AT",
            "TAG_UPDATED_AT",
        )


class SpecialtyTagCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a specialty tag."""

    class Meta:
        model = SpecialtyTag
        fields = (
            "TAG_NAME",
        )


class SpecialtyTagUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating a specialty tag."""

    class Meta:
        model = SpecialtyTag
        fields = (
            "TAG_NAME",
        )