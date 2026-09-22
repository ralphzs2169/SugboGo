"""Administrator-facing persisted Discovery Score serializers."""

from rest_framework import serializers

from apps.business.models import Business, DiscoveryScore


class DiscoveryScoreBusinessSerializer(serializers.ModelSerializer):
    """Expose concise business identity for a score row."""

    id = serializers.IntegerField(source="BUSN_ID", read_only=True)
    business_name = serializers.CharField(source="BUSN_NAME", read_only=True)
    cover_photo_url = serializers.CharField(
        source="BUSN_COVER_PHOTO_URL",
        read_only=True,
    )
    status = serializers.CharField(source="BUSN_STATUS", read_only=True)
    cluster_name = serializers.CharField(
        source="CTGRY_ID.CLUS_ID.CLUS_NAME",
        read_only=True,
    )
    category_name = serializers.CharField(
        source="CTGRY_ID.CTGRY_NAME",
        read_only=True,
    )
    specialty_tags = serializers.SerializerMethodField()

    class Meta:
        model = Business
        fields = (
            "id",
            "business_name",
            "cover_photo_url",
            "status",
            "cluster_name",
            "category_name",
            "specialty_tags",
        )

    def get_specialty_tags(self, obj):
        """Return only the prefetched active tag identities."""

        return [
            {
                "id": link.TAG_ID.TAG_ID,
                "name": link.TAG_ID.TAG_NAME,
                "icon": link.TAG_ID.TAG_ICON,
                "color": link.TAG_ID.TAG_COLOR,
            }
            for link in obj.active_specialty_tag_links
        ]


class AdminDiscoveryScoreSerializer(serializers.ModelSerializer):
    """Expose only persisted scores and their computed time."""

    business = DiscoveryScoreBusinessSerializer(source="BUSN_ID", read_only=True)
    specialty_score = serializers.DecimalField(
        source="DSC_S_SCORE",
        max_digits=6,
        decimal_places=5,
        read_only=True,
    )
    visibility_gap = serializers.DecimalField(
        source="DSC_V_SCORE",
        max_digits=6,
        decimal_places=5,
        read_only=True,
    )
    discovery_score = serializers.DecimalField(
        source="DSC_D_SCORE",
        max_digits=6,
        decimal_places=5,
        read_only=True,
    )
    computed_at = serializers.DateTimeField(
        source="DSC_COMPUTED_AT",
        read_only=True,
    )

    class Meta:
        model = DiscoveryScore
        fields = (
            "business",
            "specialty_score",
            "visibility_gap",
            "discovery_score",
            "computed_at",
        )
