from rest_framework import serializers


class RoadRouteQuerySerializer(serializers.Serializer):
    """Validate Explorer coordinates used to request a driving route."""

    latitude = serializers.FloatField(
        min_value=-90,
        max_value=90,
    )
    longitude = serializers.FloatField(
        min_value=-180,
        max_value=180,
    )


class RoadRouteCoordinateSerializer(serializers.Serializer):
    """Serialize one frontend-friendly road-route coordinate."""

    latitude = serializers.FloatField()
    longitude = serializers.FloatField()


class RoadRouteSerializer(serializers.Serializer):
    """Serialize normalized Google road-route data."""

    distance_meters = serializers.IntegerField()
    duration_seconds = serializers.IntegerField()
    encoded_polyline = serializers.CharField()
    origin = RoadRouteCoordinateSerializer()
    destination = RoadRouteCoordinateSerializer()


class RoadRouteSearchResultSerializer(serializers.Serializer):
    """Serialize an available road route or a successful empty result."""

    route = RoadRouteSerializer(
        allow_null=True,
    )
