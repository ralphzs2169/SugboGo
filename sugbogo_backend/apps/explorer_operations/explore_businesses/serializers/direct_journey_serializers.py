from rest_framework import serializers


class DirectJourneyQuerySerializer(serializers.Serializer):
    """Validate explorer coordinates used for direct journey routing."""

    latitude = serializers.FloatField(
        min_value=-90,
        max_value=90,
    )
    longitude = serializers.FloatField(
        min_value=-180,
        max_value=180,
    )


class JourneyEndpointSerializer(serializers.Serializer):
    """Serialize a route variant endpoint Transit Point."""

    id = serializers.IntegerField()
    name = serializers.CharField()


class JourneyTransitPointSerializer(JourneyEndpointSerializer):
    """Serialize a managed Transit Point used to board or alight."""

    latitude = serializers.FloatField()
    longitude = serializers.FloatField()


class DirectJourneySerializer(serializers.Serializer):
    """Serialize one ranked zero-transfer jeepney journey."""

    journey_type = serializers.ChoiceField(
        choices=(
            "direct",
        ),
    )
    jeepney_route_code = serializers.CharField()
    route_variant_id = serializers.IntegerField()
    route_variant_origin = JourneyEndpointSerializer()
    route_variant_destination = JourneyEndpointSerializer()
    boarding_transit_point = JourneyTransitPointSerializer()
    boarding_sequence = serializers.IntegerField()
    explorer_to_boarding_distance_meters = serializers.FloatField()
    alighting_transit_point = JourneyTransitPointSerializer()
    alighting_sequence = serializers.IntegerField()
    alighting_to_business_distance_meters = serializers.FloatField()
    total_access_egress_distance_meters = serializers.FloatField()
    approximate_ride_distance_meters = serializers.FloatField()


class DirectJourneySearchResultSerializer(serializers.Serializer):
    """Serialize journey options and the reason for an empty result."""

    journeys = DirectJourneySerializer(
        many=True,
    )
    reason = serializers.ChoiceField(
        choices=(
            "no_nearby_boarding_point",
            "no_nearby_alighting_point",
            "no_direct_route_match",
        ),
        allow_null=True,
    )
