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
    """Serializes saved-membership totals separately from available listings."""

    id = serializers.IntegerField(source="PCOL_ID", read_only=True)
    name = serializers.CharField(source="PCOL_NAME", read_only=True)
    is_default = serializers.BooleanField(source="PCOL_IS_DEFAULT", read_only=True)
    business_count = serializers.IntegerField(read_only=True)
    available_business_count = serializers.IntegerField(read_only=True)
    created_at = serializers.DateTimeField(source="PCOL_CREATED_AT", read_only=True)
    updated_at = serializers.DateTimeField(source="PCOL_UPDATED_AT", read_only=True)

    class Meta:
        model = PocketCollection
        fields = (
            "id",
            "name",
            "is_default",
            "business_count",
            "available_business_count",
            "created_at",
            "updated_at",
        )


class BusinessPocketMembershipSerializer(serializers.Serializer):
    """Accepts the complete selection, including an explicit empty set to unsave."""

    pocket_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=True,
    )


class PocketBusinessListSerializer(serializers.ListSerializer):
    """Hydrate active cards in one batch and disclose only saved identity otherwise."""

    def to_representation(
        self,
        data,
    ):
        """Serialize an already owner-authorized page without per-business detail lookups."""
        from django.utils import timezone
        from apps.business.models import Business
        from ..services.new_businesses_service import NewBusinessesService
        from .explore_business_serializer import ExploreBusinessSerializer

        rows = list(data)
        active_ids = [
            row.pk
            for row in rows
            if row.BUSN_STATUS == Business.BusinessStatus.ACTIVE
        ]
        cards = ExploreBusinessSerializer(
            NewBusinessesService.list_new_businesses(
                self.context["request"].user,
            ).filter(pk__in=active_ids),
            many=True,
            context=self.context,
        ).data
        by_id = {
            card["id"]: dict(card)
            for card in cards
        }
        checked_at = timezone.now().isoformat()
        result = []
        for row in rows:
            card = by_id.get(row.pk)
            if card is None:
                card = {
                    "id": row.pk,
                    "business_name": row.BUSN_NAME,
                    "is_pocketed": True,
                }
            if row.pk in by_id:
                card["availability"] = "available"
            else:
                card["availability"] = "unavailable"
            card["availability_checked_at"] = checked_at
            result.append(card)
        return result


class PocketBusinessSerializer(serializers.Serializer):
    """Use the page serializer to keep restricted profiles out of private collections."""

    class Meta:
        list_serializer_class = PocketBusinessListSerializer
