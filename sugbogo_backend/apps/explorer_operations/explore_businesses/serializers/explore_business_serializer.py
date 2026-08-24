from apps.business.models import (
    Business,
    BusinessOperatingHours,
    BusinessPhoto,
)
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
    """Serializes a specialty tag with its Explorer vouch information."""

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
    vouch_count = serializers.IntegerField(
        read_only=True,
    )
    is_vouched = serializers.BooleanField(
        read_only=True,
    )


class ExploreLocationSerializer(serializers.Serializer):
    """Serializes location information shown on Explorer business cards."""

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
    latitude = serializers.FloatField(
        source="LOCT_POINT.y",
        read_only=True,
    )
    longitude = serializers.FloatField(
        source="LOCT_POINT.x",
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
    is_pocketed = serializers.BooleanField(
        read_only=True,
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
            "is_pocketed",
            "cluster",
            "category",
            "specialty_tags",
            "location",
        )

class ExploreBusinessPhotoSerializer(serializers.ModelSerializer):
    """Serializes a public business photo for Explorer."""

    id = serializers.IntegerField(
        source="BPHO_ID",
        read_only=True,
    )
    photo_url = serializers.URLField(
        source="BPHO_PHOTO_URL",
        read_only=True,
    )
    category = serializers.CharField(
        source="BPHO_CATEGORY",
        read_only=True,
    )

    class Meta:
        model = BusinessPhoto
        fields = (
            "id",
            "photo_url",
            "category",
        )


class ExploreOperatingHoursSerializer(serializers.ModelSerializer):
    """Serializes business operating hours for Explorer."""

    id = serializers.IntegerField(
        source="BOHR_ID",
        read_only=True,
    )
    day = serializers.CharField(
        source="BOHR_DAY",
        read_only=True,
    )
    is_open = serializers.BooleanField(
        source="BOHR_IS_OPEN",
        read_only=True,
    )
    is_24_hours = serializers.BooleanField(
        source="BOHR_IS_24_HOURS",
        read_only=True,
    )
    open_time = serializers.TimeField(
        source="BOHR_OPEN_TIME",
        read_only=True,
        allow_null=True,
    )
    close_time = serializers.TimeField(
        source="BOHR_CLOSE_TIME",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = BusinessOperatingHours
        fields = (
            "id",
            "day",
            "is_open",
            "is_24_hours",
            "open_time",
            "close_time",
        )


class ExploreBusinessDetailSerializer(ExploreBusinessSerializer):
    """Serializes the complete public business profile for Explorer."""

    description = serializers.CharField(
        source="BUSN_DESCRIPTION",
        read_only=True,
        allow_null=True,
    )

    photos = ExploreBusinessPhotoSerializer(
        many=True,
        read_only=True,
    )

    operating_hours = ExploreOperatingHoursSerializer(
        many=True,
        read_only=True,
    )

    class Meta(ExploreBusinessSerializer.Meta):
        fields = ExploreBusinessSerializer.Meta.fields + (
            "description",
            "photos",
            "operating_hours",
        )