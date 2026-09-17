from requests import RequestException
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.merchant_application.serializers.location_serializers import (
    PlaceDetailsSerializer,
    PlaceSearchSerializer,
    ReverseGeocodeSerializer,
)
from apps.merchant_application.throttles import (
    PlaceDetailsThrottle,
    PlaceSearchThrottle,
    ReverseGeocodeThrottle,
)
from apps.shared.services.google_maps_service import GoogleMapsService
from apps.transit.services.transit_coverage_service import (
    TransitCoverageService,
)
from apps.users.models import User
from core.responses import error_response, success_response


def _handle_google_maps_error(error, code):
    """Return the established error envelope for Google Maps failures."""

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


class JourneyOriginPermissionMixin:
    """Apply the established Explorer journey permissions."""

    permission_classes = (
        IsAuthenticated,
        HasRole(
            User.UserRole.EXPLORER,
            User.UserRole.MERCHANT,
        ),
    )


class JourneyOriginPlaceSearchView(
    JourneyOriginPermissionMixin,
    APIView,
):
    """Search for journey origins within the configured MVP search area."""

    throttle_classes = (
        PlaceSearchThrottle,
    )

    def post(self, request):
        """Return suggestions restricted to the Metro Cebu search area."""

        serializer = PlaceSearchSerializer(
            data=request.data,
        )
        serializer.is_valid(
            raise_exception=True,
        )

        location_restriction = (
            TransitCoverageService.get_autocomplete_location_restriction()
        )

        try:
            suggestions = GoogleMapsService.search_places(
                serializer.validated_data["input"],
                location_restriction,
            )
        except (RequestException, ValueError) as error:
            return _handle_google_maps_error(
                error,
                "PLACE_SEARCH_FAILED",
            )

        return success_response(
            data={
                "suggestions": suggestions,
            },
            message="Journey origin places retrieved successfully.",
        )


class JourneyOriginPlaceDetailsView(
    JourneyOriginPermissionMixin,
    APIView,
):
    """Resolve a journey-origin suggestion without business validation."""

    throttle_classes = (
        PlaceDetailsThrottle,
    )

    def post(self, request):
        """Return provider details for a selected journey origin."""

        serializer = PlaceDetailsSerializer(
            data=request.data,
        )
        serializer.is_valid(
            raise_exception=True,
        )

        try:
            location = GoogleMapsService.get_place_details(
                serializer.validated_data["place_id"],
            )
        except (RequestException, ValueError) as error:
            return _handle_google_maps_error(
                error,
                "PLACE_DETAILS_FAILED",
            )

        return success_response(
            data={
                "location": location,
            },
            message="Journey origin details retrieved successfully.",
        )


class JourneyOriginReverseGeocodeView(
    JourneyOriginPermissionMixin,
    APIView,
):
    """Resolve journey-origin coordinates without business validation."""

    throttle_classes = (
        ReverseGeocodeThrottle,
    )

    def post(self, request):
        """Return an address label for journey-origin coordinates."""

        serializer = ReverseGeocodeSerializer(
            data=request.data,
        )
        serializer.is_valid(
            raise_exception=True,
        )

        try:
            address = GoogleMapsService.reverse_geocode(
                serializer.validated_data["latitude"],
                serializer.validated_data["longitude"],
            )
        except (RequestException, ValueError) as error:
            return _handle_google_maps_error(
                error,
                "GEOCODING_FAILED",
            )

        return success_response(
            data={
                "address": address,
            },
            message="Journey origin resolved successfully.",
        )
