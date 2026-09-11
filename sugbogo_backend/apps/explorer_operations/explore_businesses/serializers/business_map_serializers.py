from apps.business.models import Business
from rest_framework import serializers


class ExploreMapPreviewQuerySerializer(serializers.Serializer):
    """Validate coordinates used to load nearby map-preview businesses."""

    latitude = serializers.FloatField(
        min_value=-90,
        max_value=90,
    )
    longitude = serializers.FloatField(
        min_value=-180,
        max_value=180,
    )


class ExploreMapPreviewBusinessSerializer(serializers.ModelSerializer):
    """Serialize lightweight business marker data for the Explore preview."""

    id = serializers.IntegerField(
        source="BUSN_ID",
        read_only=True,
    )

    cluster_icon = serializers.CharField(
        source="CTGRY_ID.CLUS_ID.CLUS_ICON",
        read_only=True,
    )

    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()

    def get_latitude(self, obj):
        return obj.LOCT_ID.LOCT_POINT.y

    def get_longitude(self, obj):
        return obj.LOCT_ID.LOCT_POINT.x

    class Meta:
        model = Business
        fields = (
            "id",
            "cluster_icon",
            "latitude",
            "longitude",
        )


class ExploreMapBusinessSerializer(serializers.ModelSerializer):
    """Serialize business information used by the full Explorer map."""

    id = serializers.IntegerField(
        source="BUSN_ID",
        read_only=True,
    )

    business_name = serializers.CharField(
        source="BUSN_NAME",
        read_only=True,
    )

    cover_photo_url = serializers.CharField(
        source="BUSN_COVER_PHOTO_URL",
        read_only=True,
    )

    category_name = serializers.CharField(
        source="CTGRY_ID.CTGRY_NAME",
        read_only=True,
    )

    cluster_name = serializers.CharField(
        source="CTGRY_ID.CLUS_ID.CLUS_NAME",
        read_only=True,
    )

    cluster_icon = serializers.CharField(
        source="CTGRY_ID.CLUS_ID.CLUS_ICON",
        read_only=True,
    )

    location = serializers.CharField(
        source="LOCT_ID.LOCT_ADDRESS",
        read_only=True,
    )

    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()

    def get_latitude(self, obj):
        return obj.LOCT_ID.LOCT_POINT.y

    def get_longitude(self, obj):
        return obj.LOCT_ID.LOCT_POINT.x

    class Meta:
        model = Business
        fields = (
            "id",
            "business_name",
            "cover_photo_url",
            "category_name",
            "cluster_name",
            "cluster_icon",
            "location",
            "latitude",
            "longitude",
        )