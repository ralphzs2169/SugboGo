from rest_framework import serializers


class FilterOptionClusterSerializer(serializers.Serializer):
    """Serializes an Explorer cluster filter option."""

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


class FilterOptionCategorySerializer(serializers.Serializer):
    """Serializes an Explorer category filter option."""

    id = serializers.IntegerField(
        source="CTGRY_ID",
        read_only=True,
    )
    name = serializers.CharField(
        source="CTGRY_NAME",
        read_only=True,
    )
    cluster_id = serializers.IntegerField(
        source="CLUS_ID_id",
        read_only=True,
    )


class FilterOptionSpecialtySerializer(serializers.Serializer):
    """Serializes an Explorer specialty filter option."""

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
