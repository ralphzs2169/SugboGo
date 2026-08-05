from core.responses import error_response, success_response
from requests import RequestException
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated

from apps.merchant_application.serializers.location_serializers import (
    NearbyLandmarksSerializer,
    PlaceDetailsSerializer,
    PlaceSearchSerializer,
    ReverseGeocodeSerializer,
)
from apps.merchant_application.throttles import (
    NearbyLandmarksThrottle,
    PlaceDetailsThrottle,
    PlaceSearchThrottle,
    ReverseGeocodeThrottle,
)
from apps.shared.services.google_maps_service import GoogleMapsService


def _handle_google_maps_error(error, code):
    """Handles errors from Google Maps API requests and returns appropriate error responses."""

    if isinstance(error, RequestException):
        return error_response(
            message="Unable to connect to the location service.",
            code="LOCATION_SERVICE_UNAVAILABLE",
            status_code=status.HTTP_502_BAD_GATEWAY,
        )

    return error_response(
        message=str(error),
        code=code,
        status_code=status.HTTP_502_BAD_GATEWAY,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([ReverseGeocodeThrottle])
def reverse_geocode_view(request):
    """Return the formatted address for the provided coordinates."""

    serializer = ReverseGeocodeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    latitude = serializer.validated_data["latitude"]
    longitude = serializer.validated_data["longitude"]

    try:
        address = GoogleMapsService.reverse_geocode(
            latitude,
            longitude,
        )
    except (RequestException, ValueError) as error:
        return _handle_google_maps_error(
            error,
            "GEOCODING_FAILED",
        )

    return success_response(
        data={"address": address},
        message="Location resolved successfully.",
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([PlaceSearchThrottle])
def place_search_view(request):
    """Return place suggestions matching the provided search input."""

    serializer = PlaceSearchSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    search_input = serializer.validated_data["input"]

    try:
        suggestions = GoogleMapsService.search_places(search_input)
    except (RequestException, ValueError) as error:
        return _handle_google_maps_error(
            error,
            "PLACE_SEARCH_FAILED",
        )

    return success_response(
        data={"suggestions": suggestions},
        message="Places retrieved successfully.",
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([PlaceDetailsThrottle])
def place_details_view(request):
    """Return location and address details for the provided place ID."""

    serializer = PlaceDetailsSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    place_id = serializer.validated_data["place_id"]

    try:
        location = GoogleMapsService.get_place_details(place_id)
    except (RequestException, ValueError) as error:
        return _handle_google_maps_error(
            error,
            "PLACE_DETAILS_FAILED",
        )

    return success_response(
        data={"location": location},
        message="Place details retrieved successfully.",
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([NearbyLandmarksThrottle])
def nearby_landmarks_view(request):
    """Returns nearby places that may be useful as business landmarks."""

    serializer = NearbyLandmarksSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    latitude = serializer.validated_data["latitude"]
    longitude = serializer.validated_data["longitude"]

    try:
        landmarks = GoogleMapsService.search_nearby_landmarks(
            latitude,
            longitude,
        )
    except (RequestException, ValueError) as error:
        return _handle_google_maps_error(
            error,
            "LANDMARK_SEARCH_FAILED",
        )

    return success_response(
        data={"landmarks": landmarks},
        message="Nearby landmarks retrieved successfully.",
    )