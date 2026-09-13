from rest_framework import serializers

from apps.business.models import Category, SpecialtyTag


class InterestClusterSerializer(serializers.Serializer):
    """Serializes cluster information for an interest category."""

    id = serializers.IntegerField(
        source="CLUS_ID",
        read_only=True,
    )

    name = serializers.CharField(
        source="CLUS_NAME",
        read_only=True,
    )

    icon = serializers.CharField(
        source="CLUS_ICON",
        read_only=True,
    )


class InterestCategorySerializer(serializers.ModelSerializer):
    """Serializes a category available for user interests."""

    id = serializers.IntegerField(
        source="CTGRY_ID",
        read_only=True,
    )

    name = serializers.CharField(
        source="CTGRY_NAME",
        read_only=True,
    )

    cluster = InterestClusterSerializer(
        source="CLUS_ID",
        read_only=True,
    )

    class Meta:
        model = Category
        fields = (
            "id",
            "name",
            "cluster",
        )


class InterestSpecialtyTagSerializer(serializers.ModelSerializer):
    """Serializes a specialty tag available for user interests."""

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

    class Meta:
        model = SpecialtyTag
        fields = (
            "id",
            "name",
            "color",
            "icon",
        )