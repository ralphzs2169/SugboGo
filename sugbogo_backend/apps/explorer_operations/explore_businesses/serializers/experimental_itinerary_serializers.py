"""Version 1 experimental itinerary inputs and map-ready output."""

import math

from rest_framework import serializers

from apps.explorer_operations.explore_businesses.serializers.direct_journey_serializers import (
    DirectJourneyQuerySerializer,
    JourneyMapCoordinateSerializer,
)
from apps.explorer_operations.explore_businesses.services.experimental_itinerary_service import RouteAlignmentStatus
from apps.transit.services.coordinate_journey_service import MAXIMUM_SUPPORTED_TRANSFERS
from apps.transit.services.direct_journey_map_service import DirectJourneyMapService
from apps.shared.services.google_maps_service import GoogleMapsService


class ItinerarySearchSerializer(DirectJourneyQuerySerializer):
    """Validate an origin and the maximum number of transfers."""

    max_transfers = serializers.IntegerField(min_value=0, max_value=MAXIMUM_SUPPORTED_TRANSFERS, default=2)

    def validate(self, attrs):
        """Reject non-finite floats before they reach PostGIS."""
        for field in ("latitude", "longitude"):
            if not math.isfinite(attrs[field]):
                raise serializers.ValidationError({field: "Provide a finite coordinate."})
        return attrs


class ItinerarySelectionSerializer(serializers.Serializer):
    """Accept the signed selection in the request body."""

    selection = serializers.CharField(max_length=4096)


def _coordinate(point):
    """Convert a WGS84 point to the existing map coordinate shape."""
    if point is None:
        return None
    return {"latitude": point.y, "longitude": point.x}


def _provider_coordinate(location):
    """Convert a provider's snapped latitude and longitude to the map coordinate shape."""
    if location is None:
        return None
    return {"latitude": location[0], "longitude": location[1]}


def _landmark(value):
    """Expose optional Google context independently of the route and access positions."""
    if value is None:
        return None
    return {
        "place_id": value.place_id,
        "name": value.name,
        "address": value.address,
        "location": {"latitude": value.latitude, "longitude": value.longitude},
        "distance_meters": value.distance_meters,
        "source": value.source,
        "attributions": [{"name": name, "url": url} for name, url in value.attributions],
    }


def _access(location, landmark):
    """Keep provisional access and operational permission separate from centerline geometry."""
    return {
        "route_position": {"fraction": location.route_position.fraction, **_coordinate(location.route_position.point)},
        "access_coordinate": _coordinate(location.point),
        "coordinate_status": location.coordinate_status,
        "permission": location.permission,
        "passenger_location_verified": location.passenger_location_verified,
        "landmark": _landmark(landmark),
    }


def _walk(walk):
    """Expose accepted mapped walks and distinguish their estimates and failures."""
    route = walk.route
    return {
        "from": _coordinate(walk.origin),
        "to": _coordinate(walk.destination),
        "status": walk.status,
        "diagnostic_code": walk.diagnostic_code,
        "straight_line_distance_meters": walk.straight_line_distance_meters,
        "mapped_distance_meters": walk.mapped_distance_meters,
        "provider_distance_meters": route.distance_meters if route else None,
        "distance_limit_meters": walk.distance_limit_meters,
        "duration_seconds": route.duration_seconds if walk.mapped_distance_meters is not None else None,
        "encoded_polyline": route.encoded_polyline if walk.mapped_distance_meters is not None else None,
        "provider_start": _provider_coordinate(route.start_location) if route else None,
        "provider_end": _provider_coordinate(route.end_location) if route else None,
        "provider_start_displacement_meters": (
            GoogleMapsService.calculate_distance_meters(walk.origin.y, walk.origin.x, *route.start_location)
            if walk.origin is not None and route and route.start_location else None
        ),
        "provider_end_displacement_meters": (
            GoogleMapsService.calculate_distance_meters(walk.destination.y, walk.destination.x, *route.end_location)
            if walk.destination is not None and route and route.end_location else None
        ),
        "source": route.source if route else None,
        "warnings": list(route.warnings) if route else [],
    }


class ItineraryOptionSerializer(serializers.Serializer):
    """Expose ranked route sequences and evidence without transferring map geometry in search."""

    selection = serializers.CharField()
    rank = serializers.IntegerField()
    route_sequence = serializers.SerializerMethodField()
    transfer_count = serializers.IntegerField(source="result.journey.transfer_count")
    route_alignment_status = serializers.ChoiceField(choices=tuple(RouteAlignmentStatus))
    passenger_access_verified = serializers.BooleanField()
    passenger_ready = serializers.BooleanField()
    has_blocking_evidence = serializers.BooleanField(source="result.has_blocking_evidence")
    mapped_walking_distance_meters = serializers.IntegerField(
        source="result.mapped_walking_distance_meters",
        allow_null=True,
    )
    straight_line_walking_distance_meters = serializers.SerializerMethodField()
    ride_distance_meters = serializers.FloatField(source="result.journey.total_ride_distance_meters")
    transfer_penalty_meters = serializers.FloatField(source="result.journey.transfer_penalty_meters")
    ranking_cost_meters = serializers.FloatField(source="result.ranking_cost_meters")
    walking_statuses = serializers.SerializerMethodField()

    def get_route_sequence(self, option):
        """Return route codes in travel order."""
        return [leg.jeepney_route_code for leg in option["result"].journey.ride_legs]

    def get_straight_line_walking_distance_meters(self, option):
        """Sum the separate geometric walking estimates."""
        return sum(walk.straight_line_distance_meters for walk in option["result"].walks)

    def get_walking_statuses(self, option):
        """Hold one walking status for access, each transfer, and egress."""
        return [walk.status for walk in option["result"].walks]


class ItineraryCoverageSerializer(serializers.Serializer):
    """Report the shortlist boundary to distinguish bounded search from exhaustive results."""

    incomplete_reason = serializers.ChoiceField(
        choices=("candidate_budget", "connection_budget"),
        allow_null=True,
    )
    graph_revision = serializers.CharField(required=False)
    graph_variant_count = serializers.IntegerField(required=False)
    variants_outside_graph = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
    )
    nearby_origin_variants = serializers.IntegerField()
    nearby_destination_variants = serializers.IntegerField()
    variants_excluded_by_spatial_validation = serializers.IntegerField()
    geometric_candidates_considered = serializers.IntegerField()
    geometric_candidates_truncated = serializers.BooleanField()
    candidates_evaluated = serializers.IntegerField()
    alternatives_unchecked = serializers.BooleanField()
    walking_checks_deferred = serializers.BooleanField()
    walking_provider_unavailable = serializers.BooleanField()


class ItineraryContextSerializer(serializers.Serializer):
    """Serialize the business and exact origin and destination used in a calculation."""

    business_id = serializers.IntegerField()
    guidance_mode = serializers.CharField(default="geometry", read_only=True)
    origin = JourneyMapCoordinateSerializer(source="origin_coords", read_only=True)
    destination = JourneyMapCoordinateSerializer(source="destination_coords", read_only=True)
    max_transfers = serializers.IntegerField()

    def to_representation(self, instance):
        """Adapt GEOS coordinates before applying the shared coordinate serializer."""
        return super().to_representation({
            **instance,
            "origin_coords": _coordinate(instance["origin"]),
            "destination_coords": _coordinate(instance["destination"]),
        })


class ItinerarySearchResultSerializer(ItineraryContextSerializer):
    """Serialize the v1 ranked result and search coverage."""

    options = ItineraryOptionSerializer(many=True)
    reason = serializers.ChoiceField(
        choices=(
            "no_route_near_origin",
            "no_route_near_destination",
            "no_forward_journey",
            "candidate_excluded_by_validation",
            "search_incomplete",
        ),
        allow_null=True,
    )
    validation_stage = serializers.ChoiceField(
        choices=("spatial", "minimum_ride_distance"),
        allow_null=True,
    )
    coverage = ItineraryCoverageSerializer()


class ItineraryDetailSerializer(ItineraryContextSerializer):
    """Serialize ordered map segments and pedestrian evidence for one itinerary."""

    rank = serializers.IntegerField()
    route_alignment_status = serializers.ChoiceField(choices=tuple(RouteAlignmentStatus))
    passenger_access_verified = serializers.BooleanField()
    passenger_ready = serializers.BooleanField()
    has_blocking_evidence = serializers.BooleanField(source="result.has_blocking_evidence")
    transfer_count = serializers.IntegerField(source="result.journey.transfer_count")
    access_walk = serializers.SerializerMethodField()
    egress_walk = serializers.SerializerMethodField()
    ride_legs = serializers.SerializerMethodField()
    transfers = serializers.SerializerMethodField()
    totals = serializers.SerializerMethodField()

    def get_access_walk(self, value):
        """Serialize the first walking leg."""
        return _walk(value["result"].access_walk)

    def get_egress_walk(self, value):
        """Serialize the final walking leg."""
        return _walk(value["result"].egress_walk)

    def get_ride_legs(self, value):
        """Serialize each directed ride and its two distinct access positions."""
        result = value["result"]
        variants = value["variants"]
        return [
            {
                "variant_id": leg.variant_id,
                "geometry_revision": variants[leg.variant_id].revision,
                "route_code": leg.jeepney_route_code,
                "route_alignment_status": variants[leg.variant_id].alignment_status,
                "route_provenance": variants[leg.variant_id].provenance,
                "direction": {
                    "from": variants[leg.variant_id].origin_name,
                    "toward": variants[leg.variant_id].destination_name,
                },
                "boarding": _access(access.boarding, access.boarding_landmark),
                "alighting": _access(access.alighting, access.alighting_landmark),
                "ride_distance_meters": leg.ride_distance_meters,
                "geometry": DirectJourneyMapService._serialize_geometry(leg.ride_geometry),
            }
            for leg, access in zip(result.journey.ride_legs, result.ride_access, strict=True)
        ]

    def get_transfers(self, value):
        """Serialize each directed connection and its walking verdict."""
        variants = value["variants"]
        return [
            {
                "from_variant_id": transfer.connection.from_variant_id,
                "to_variant_id": transfer.connection.to_variant_id,
                "validation_status": transfer.connection.validation_status,
                "passenger_access_verified": transfer.passenger_ready,
                "passenger_ready": (
                    transfer.passenger_ready
                    and variants[transfer.connection.from_variant_id].alignment_status is RouteAlignmentStatus.REVIEWED
                    and variants[transfer.connection.to_variant_id].alignment_status is RouteAlignmentStatus.REVIEWED
                ),
                "centerline_gap_meters": transfer.connection.straight_line_distance_meters,
                "alighting_route_fraction": transfer.alighting.route_position.fraction,
                "boarding_route_fraction": transfer.boarding.route_position.fraction,
                "walk": _walk(transfer.walking),
            }
            for transfer in value["result"].transfers
        ]

    def get_totals(self, value):
        """Serialize walking and ranking costs from independent evidence sources."""
        result = value["result"]
        return {
            "mapped_walking_distance_meters": result.mapped_walking_distance_meters,
            "straight_line_walking_distance_meters": sum(walk.straight_line_distance_meters for walk in result.walks),
            "ride_distance_meters": result.journey.total_ride_distance_meters,
            "transfer_penalty_meters": result.journey.transfer_penalty_meters,
            "ranking_cost_meters": result.ranking_cost_meters,
        }
