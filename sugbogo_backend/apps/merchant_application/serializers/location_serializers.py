from rest_framework import serializers


class ReverseGeocodeSerializer(serializers.Serializer):
    """Validates coordinates used for reverse geocoding."""

    latitude = serializers.FloatField()
    longitude = serializers.FloatField()


class PlaceSearchSerializer(serializers.Serializer):
    """Validates text used to search for places."""

    input = serializers.CharField(max_length=255, allow_blank=False)


class PlaceDetailsSerializer(serializers.Serializer):
    """Validates a Google Place ID used to retrieve place details."""

    place_id = serializers.CharField(max_length=255)


class NearbyLandmarksSerializer(serializers.Serializer):
    """Validates coordinates used to find nearby landmarks."""

    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    place_id = serializers.CharField(max_length=255, required=False, allow_blank=True)