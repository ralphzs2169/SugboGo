from apps.business.models import SpecialtyTag
from rest_framework import serializers


class ExploreSpecialtySerializer(serializers.ModelSerializer):
    """Serialize a Specialty Tag used as an Explorer discovery shortcut."""

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

    icon = serializers.CharField(
        source="TAG_ICON",
        read_only=True,
    )

    business_count = serializers.IntegerField(
        read_only=True,
    )

    class Meta:
        model = SpecialtyTag
        fields = (
            "id",
            "name",
            "color",
            "icon",
            "business_count",
        )