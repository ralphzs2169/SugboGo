from math import isfinite

from django.conf import settings
from rest_framework import serializers

from apps.business.models import Business
from .discovery_feed_serializer import TaxonomyFilterQuerySerializer

from .explore_business_serializer import (
    ExploreCategorySerializer,
    ExploreClusterSerializer,
    ExploreLocationSerializer,
)


class MapDiscoveryQuerySerializer(TaxonomyFilterQuerySerializer):
    """Validate a finite, non-crossing viewport before any database queries."""

    north = serializers.FloatField(
        min_value=-90,
        max_value=90,
    )
    south = serializers.FloatField(
        min_value=-90,
        max_value=90,
    )
    east = serializers.FloatField(
        min_value=-180,
        max_value=180,
    )
    west = serializers.FloatField(
        min_value=-180,
        max_value=180,
    )
    hidden_gems = serializers.BooleanField(
        required=False,
        default=False,
    )
    open_now = serializers.BooleanField(
        required=False,
        default=False,
    )
    business = serializers.IntegerField(
        min_value=1,
        required=False,
    )

    def validate(
        self,
        attrs,
    ):
        """Reject degenerate, inverted, antimeridian-crossing, or oversized bounds."""
        for field_name in ("north", "south", "east", "west"):
            coordinate = attrs[field_name]
            if not isfinite(coordinate):
                raise serializers.ValidationError(
                    {
                        field_name: "Enter a finite geographic coordinate.",
                    },
                )

        if attrs["south"] >= attrs["north"]:
            raise serializers.ValidationError(
                {
                    "north": "North must be greater than south.",
                },
            )

        if attrs["west"] >= attrs["east"]:
            raise serializers.ValidationError(
                {
                    "east": (
                        "East must be greater than west. "
                        "Antimeridian-crossing viewports are not supported."
                    ),
                },
            )

        maximum_span = settings.MAP_DISCOVERY_MAX_VIEWPORT_SPAN
        if (
            attrs["north"] - attrs["south"] > maximum_span
            or attrs["east"] - attrs["west"] > maximum_span
        ):
            raise serializers.ValidationError(
                {
                    "bounds": (
                        "Zoom in to search a smaller area. "
                        f"Viewport spans must not exceed {maximum_span:g} degrees."
                    ),
                },
            )

        return attrs


class MapDiscoverySpecialtyTagSerializer(serializers.Serializer):
    """Serialize active specialty labels without vouch state or internal scores."""

    id = serializers.IntegerField(
        source="TAG_ID.TAG_ID",
        read_only=True,
    )
    name = serializers.CharField(
        source="TAG_ID.TAG_NAME",
        read_only=True,
    )
    color = serializers.CharField(
        source="TAG_ID.TAG_COLOR",
        read_only=True,
    )
    icon = serializers.CharField(
        source="TAG_ID.TAG_ICON",
        read_only=True,
    )


class MapDiscoveryBusinessSerializer(serializers.ModelSerializer):
    """Serialize compact map previews with Explore's public naming and photo fallback."""

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
    display_cover_photo_url = serializers.URLField(
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
    location = ExploreLocationSerializer(
        source="LOCT_ID",
        read_only=True,
    )
    specialty_tags = MapDiscoverySpecialtyTagSerializer(
        source="active_specialty_tag_links",
        many=True,
        read_only=True,
    )
    is_hidden_gem = serializers.BooleanField(
        read_only=True,
    )

    class Meta:
        model = Business
        fields = (
            "id",
            "business_name",
            "cover_photo_url",
            "display_cover_photo_url",
            "cluster",
            "category",
            "location",
            "specialty_tags",
            "is_hidden_gem",
        )
