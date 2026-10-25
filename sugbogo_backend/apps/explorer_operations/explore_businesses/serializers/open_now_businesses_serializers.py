from math import isfinite

from rest_framework import serializers

from .business_map_serializers import ExploreMapPreviewQuerySerializer


class OpenNowBusinessesQuerySerializer(ExploreMapPreviewQuerySerializer):
    """Validate finite device coordinates for the nearby open-business preview."""

    def validate(
        self,
        attrs,
    ):
        """Reject non-finite coordinates before constructing a geographic point."""
        for field_name in ("latitude", "longitude"):
            if not isfinite(attrs[field_name]):
                raise serializers.ValidationError(
                    {
                        field_name: "Enter a finite geographic coordinate.",
                    },
                )

        return attrs
