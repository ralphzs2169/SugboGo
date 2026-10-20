from rest_framework import serializers

from apps.business.models import PocketCollection
from apps.business.services.pocket_collection_service import PocketCollectionService


class PocketCollectionWriteSerializer(serializers.Serializer):
    """Validates the editable name shared by collection creation and renaming."""

    name = serializers.CharField(trim_whitespace=False, allow_blank=True)

    def validate_name(self, value):
        """Normalizes names consistently for API and direct service callers."""
        try:
            return PocketCollectionService.normalize_name(value)
        except serializers.ValidationError as exc:
            raise serializers.ValidationError(exc.detail["name"]) from None


class PocketCollectionSerializer(serializers.ModelSerializer):
    """Serializes collection metadata and its available-business count."""

    id = serializers.IntegerField(source="PCOL_ID", read_only=True)
    name = serializers.CharField(source="PCOL_NAME", read_only=True)
    is_default = serializers.BooleanField(source="PCOL_IS_DEFAULT", read_only=True)
    business_count = serializers.IntegerField(read_only=True)
    created_at = serializers.DateTimeField(source="PCOL_CREATED_AT", read_only=True)
    updated_at = serializers.DateTimeField(source="PCOL_UPDATED_AT", read_only=True)

    class Meta:
        model = PocketCollection
        fields = (
            "id", "name", "is_default", "business_count", "created_at", "updated_at",
        )


class BusinessPocketMembershipSerializer(serializers.Serializer):
    """Accepts the complete selection, including an explicit empty set to unsave."""

    pocket_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=True,
    )
