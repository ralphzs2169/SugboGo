from apps.business.models import Business
from rest_framework import serializers


class ExploreClusterSerializer(serializers.Serializer):
    """Serializes the cluster information shown on Explorer business cards."""

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


class ExploreCategorySerializer(serializers.Serializer):
    """Serializes the category information shown on Explorer business cards."""

    id = serializers.IntegerField(
        source="CTGRY_ID",
        read_only=True,
    )
    name = serializers.CharField(
        source="CTGRY_NAME",
        read_only=True,
    )


class ExploreSpecialtyTagSerializer(serializers.Serializer):
    """Serializes a specialty tag shown on Explorer business cards."""

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


class ExploreLocationSerializer(serializers.Serializer):
    """Serializes the location information shown on Explorer business cards."""

    address = serializers.CharField(
        source="LOCT_ADDRESS",
        read_only=True,
    )
    city = serializers.CharField(
        source="LOCT_CITY",
        read_only=True,
    )
    province = serializers.CharField(
        source="LOCT_PROVINCE",
        read_only=True,
    )


class ExploreBusinessSerializer(serializers.ModelSerializer):
    """Serializes the public business information used by Explorer."""

    id = serializers.IntegerField(
        source="BUSN_ID",
        read_only=True,
    )
    business_name = serializers.CharField(
        source="BUSN_NAME",
        read_only=True,
    )
    cover_photo_url = serializers.URLField(
        source="BUSN_COVER_PHOTO_URL",
        read_only=True,
        allow_null=True,
    )

    cluster = ExploreClusterSerializer(
        source="CTGRY_ID.CLUS_ID",
        read_only=True,
    )
    category = ExploreCategorySerializer(
        source="CTGRY_ID",
        read_only=True,
    )
    specialty_tags = ExploreSpecialtyTagSerializer(
        source="SPECIALTY_TAGS",
        many=True,
        read_only=True,
    )
    location = ExploreLocationSerializer(
        source="LOCT_ID",
        read_only=True,
    )

    class Meta:
        model = Business
        fields = (
            "id",
            "business_name",
            "cover_photo_url",
            "cluster",
            "category",
            "specialty_tags",
            "location",
        )