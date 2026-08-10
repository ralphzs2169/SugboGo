from rest_framework import serializers

from apps.business.models import SpecialtyTag


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
    color = serializers.CharField(
        source="TAG_COLOR",
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
    is_used_by_applications = serializers.BooleanField(
        source="merchant_application_identities.exists",
        read_only=True,
    )
    application_count = serializers.IntegerField(
        source="merchant_application_identities.count",
        read_only=True,
    )

    class Meta:
        model = SpecialtyTag
        fields = (
            "id",
            "name",
            "color",
            "created_at",
            "updated_at",
            "is_used_by_applications",
            "application_count",    
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

    color = serializers.ChoiceField(
        source="TAG_COLOR",
        choices=SpecialtyTag.TagColor.choices,
        required=False,
        default=SpecialtyTag.TagColor.BLUE,
    )

    class Meta:
        model = SpecialtyTag
        fields = (
            "name",
            "color",
        )

    def validate_name(self, value):
        value = value.strip()

        if SpecialtyTag.objects.filter(TAG_NAME__iexact=value).exists():
            raise serializers.ValidationError(
                "A specialty tag with this name already exists."
            )

        return value


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

    color = serializers.ChoiceField(
        source="TAG_COLOR",
        choices=SpecialtyTag.TagColor.choices,
        required=False,
    )

    class Meta:
        model = SpecialtyTag
        fields = (
            "name",
            "color",
        )


    def validate_name(self, value):
        value = value.strip()

        queryset = SpecialtyTag.objects.filter(
            TAG_NAME__iexact=value
        )

        if self.instance:
            queryset = queryset.exclude(
                TAG_ID=self.instance.TAG_ID
            )

        if queryset.exists():
            raise serializers.ValidationError(
                "A specialty tag with this name already exists."
            )

        return value