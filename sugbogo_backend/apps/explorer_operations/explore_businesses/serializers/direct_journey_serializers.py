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


class JourneyLandmarkContextSerializer(serializers.Serializer):
    """Serialize an optional approved-business landmark near the alighting point."""

    id = serializers.IntegerField()
    name = serializers.CharField()
    distance_from_alighting_meters = serializers.FloatField()


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
    landmark_context = JourneyLandmarkContextSerializer(
        allow_null=True,
    )


class DirectJourneyRouteOptionSerializer(serializers.Serializer):
    """Serialize one route code and its ranked ways to ride."""

    jeepney_route_code = serializers.CharField()
    recommended_journey = DirectJourneySerializer()
    alternative_journeys = DirectJourneySerializer(
        many=True,
    )


class DirectJourneySearchResultSerializer(serializers.Serializer):
    """Serialize grouped route options and the reason for an empty result."""

    route_options = DirectJourneyRouteOptionSerializer(
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


class DirectJourneyMapQuerySerializer(serializers.Serializer):
    """Validate the selected direct journey used for map guidance."""

    route_variant_id = serializers.IntegerField(
        min_value=1,
    )
    boarding_transit_point_id = serializers.IntegerField(
        min_value=1,
    )
    alighting_transit_point_id = serializers.IntegerField(
        min_value=1,
    )


class JourneyMapTransitPointSerializer(JourneyTransitPointSerializer):
    """Serialize a mapped Transit Point and its authoritative sequence."""

    sequence = serializers.IntegerField()


class JourneyMapCoordinateSerializer(serializers.Serializer):
    """Serialize one WGS 84 coordinate for a journey map."""

    latitude = serializers.FloatField()
    longitude = serializers.FloatField()


class JourneyMapVariantSerializer(serializers.Serializer):
    """Serialize identifying context for the selected route variant."""

    id = serializers.IntegerField()
    origin = JourneyEndpointSerializer()
    destination = JourneyEndpointSerializer()


class JourneyMapRideSerializer(serializers.Serializer):
    """Serialize full-route and selected-segment ride geometry."""

    approximate_distance_meters = serializers.FloatField()
    full_variant_geometry = JourneyMapCoordinateSerializer(
        many=True,
    )
    selected_segment_geometry = JourneyMapCoordinateSerializer(
        many=True,
    )


class JourneyMapBusinessLocationSerializer(serializers.Serializer):
    """Serialize the authoritative business destination coordinate."""

    latitude = serializers.FloatField()
    longitude = serializers.FloatField()


class DirectJourneyMapSerializer(serializers.Serializer):
    """Serialize map-ready context for one selected direct journey."""

    jeepney_route_code = serializers.CharField()
    route_variant = JourneyMapVariantSerializer()
    boarding_transit_point = JourneyMapTransitPointSerializer()
    alighting_transit_point = JourneyMapTransitPointSerializer()
    ride = JourneyMapRideSerializer()
    business_location = JourneyMapBusinessLocationSerializer()
    landmark_context = JourneyLandmarkContextSerializer(
        allow_null=True,
    )


class DirectJourneyMapResultSerializer(serializers.Serializer):
    """Serialize the selected direct journey map result."""

    journey = DirectJourneyMapSerializer()
