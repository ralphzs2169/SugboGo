import logging
import math
from dataclasses import dataclass
from enum import StrEnum

import requests
from django.conf import settings
from rest_framework import status
from rest_framework.exceptions import APIException

from apps.shared.services.google_maps_service import GoogleMapsService, valid_latitude_longitude

logger = logging.getLogger(__name__)


class RoadRouteServiceUnavailable(APIException):
    """Represent a safe client-facing failure from Google Routes."""

    status_code = status.HTTP_502_BAD_GATEWAY
    default_detail = "Road route guidance is temporarily unavailable."
    default_code = "road_route_service_unavailable"


class GoogleWalkingStatus(StrEnum):
    """Distinguish mapped walks from provider failures and unsuitable results."""

    AVAILABLE = "available"
    NO_ROUTE = "no_route"
    TIMEOUT = "timeout"
    QUOTA_OR_BILLING = "quota_or_billing"
    INVALID_COORDINATES = "invalid_coordinates"
    UNSUITABLE_ENDPOINTS = "unsuitable_endpoints"
    PROVIDER_ERROR = "provider_error"


@dataclass(frozen=True)
class GoogleWalkingRoute:
    """Request-scoped Google walking geometry and snapped latitude/longitude pairs."""

    distance_meters: int
    duration_seconds: int
    encoded_polyline: str | None
    start_location: tuple[float, float] | None
    end_location: tuple[float, float] | None
    warnings: tuple[str, ...]
    source: str = "google_routes"


@dataclass(frozen=True)
class GoogleWalkingResult:
    """The result of evaluating one directed pedestrian path."""

    status: GoogleWalkingStatus
    route: GoogleWalkingRoute | None = None


class GoogleRoutesService:
    """Request and normalize travel routes from Google Routes API."""

    COMPUTE_ROUTES_URL = (
        "https://routes.googleapis.com/directions/v2:computeRoutes"
    )
    FIELD_MASK = (
        "routes.distanceMeters,"
        "routes.duration,"
        "routes.polyline.encodedPolyline"
    )
    REQUEST_TIMEOUT_SECONDS = 10
    WALK_REQUEST_TIMEOUT_SECONDS = 5
    WALK_MAXIMUM_ENDPOINT_DISPLACEMENT_METERS = 30.0
    WALK_FIELD_MASK = (
        "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,"
        "routes.legs.startLocation.latLng,routes.legs.endLocation.latLng,routes.warnings"
    )

    @staticmethod
    def _parse_duration_seconds(
        duration,
    ):
        """Convert Google's protobuf duration string into whole seconds."""

        if not isinstance(duration, str) or not duration.endswith("s"):
            raise ValueError("Google Routes returned an invalid duration.")

        duration_seconds = float(duration[:-1])

        if not math.isfinite(duration_seconds) or duration_seconds < 0:
            raise ValueError("Google Routes returned an invalid duration.")

        return round(duration_seconds)

    @staticmethod
    def _walking_error_status(response) -> GoogleWalkingStatus:
        """Classify quota and timeout errors without exposing provider messages."""
        if response is None:
            return GoogleWalkingStatus.PROVIDER_ERROR
        if response.status_code in (408, 504):
            return GoogleWalkingStatus.TIMEOUT
        if response.status_code in (402, 429):
            return GoogleWalkingStatus.QUOTA_OR_BILLING

        try:
            payload = response.json()
        except ValueError:
            return GoogleWalkingStatus.PROVIDER_ERROR
        error = payload.get("error") if isinstance(payload, dict) else None
        if not isinstance(error, dict):
            return GoogleWalkingStatus.PROVIDER_ERROR
        if error.get("status") == "DEADLINE_EXCEEDED":
            return GoogleWalkingStatus.TIMEOUT
        if error.get("status") == "RESOURCE_EXHAUSTED":
            return GoogleWalkingStatus.QUOTA_OR_BILLING

        details = error.get("details")
        if isinstance(details, list) and any(
            isinstance(detail, dict)
            and (
                detail.get("reason") in (
                    "BILLING_DISABLED",
                    "BILLING_NOT_ENABLED",
                    "BILLING_ACCOUNT_DISABLED",
                    "QUOTA_EXCEEDED",
                    "RATE_LIMIT_EXCEEDED",
                )
                or detail.get("@type") == "type.googleapis.com/google.rpc.QuotaFailure"
            )
            for detail in details
        ):
            return GoogleWalkingStatus.QUOTA_OR_BILLING
        message = error.get("message")
        if (
            response.status_code == 403
            and isinstance(message, str)
            and "billing" in message.lower()
        ):
            return GoogleWalkingStatus.QUOTA_OR_BILLING
        return GoogleWalkingStatus.PROVIDER_ERROR

    @staticmethod
    def _walking_endpoint(location) -> tuple[float, float] | None:
        """Read a snapped route endpoint only when its latitude and longitude are valid."""
        coordinates = location.get("latLng") if isinstance(location, dict) else None
        if not isinstance(coordinates, dict):
            return None
        latitude = coordinates.get("latitude")
        longitude = coordinates.get("longitude")
        if not valid_latitude_longitude(latitude, longitude):
            return None
        return latitude, longitude

    @classmethod
    def compute_walking_route(
        cls,
        *,
        origin_latitude,
        origin_longitude,
        destination_latitude,
        destination_longitude,
        maximum_endpoint_displacement_meters=WALK_MAXIMUM_ENDPOINT_DISPLACEMENT_METERS,
    ) -> GoogleWalkingResult:
        """Compute a WALK route and reject paths whose snapped endpoints are unsuitable."""
        if (
            not valid_latitude_longitude(origin_latitude, origin_longitude)
            or not valid_latitude_longitude(destination_latitude, destination_longitude)
        ):
            return GoogleWalkingResult(GoogleWalkingStatus.INVALID_COORDINATES)
        if (
            not math.isfinite(maximum_endpoint_displacement_meters)
            or maximum_endpoint_displacement_meters <= 0
        ):
            raise ValueError("Provide a positive finite walking endpoint tolerance.")
        if not settings.GOOGLE_MAPS_API_KEY:
            return GoogleWalkingResult(GoogleWalkingStatus.PROVIDER_ERROR)

        try:
            response = requests.post(
                cls.COMPUTE_ROUTES_URL,
                json={
                    "origin": {
                        "location": {
                            "latLng": {
                                "latitude": origin_latitude,
                                "longitude": origin_longitude,
                            },
                        },
                    },
                    "destination": {
                        "location": {
                            "latLng": {
                                "latitude": destination_latitude,
                                "longitude": destination_longitude,
                            },
                        },
                    },
                    "travelMode": "WALK",
                    "computeAlternativeRoutes": False,
                    "units": "METRIC",
                },
                headers={
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": settings.GOOGLE_MAPS_API_KEY,
                    "X-Goog-FieldMask": cls.WALK_FIELD_MASK,
                },
                timeout=cls.WALK_REQUEST_TIMEOUT_SECONDS,
                allow_redirects=False,
            )
            response.raise_for_status()
            if not 200 <= response.status_code < 300:
                return GoogleWalkingResult(GoogleWalkingStatus.PROVIDER_ERROR)
            data = response.json()
        except requests.Timeout:
            return GoogleWalkingResult(GoogleWalkingStatus.TIMEOUT)
        except requests.HTTPError as error:
            return GoogleWalkingResult(cls._walking_error_status(error.response))
        except (requests.RequestException, ValueError):
            return GoogleWalkingResult(GoogleWalkingStatus.PROVIDER_ERROR)

        if not isinstance(data, dict):
            return GoogleWalkingResult(GoogleWalkingStatus.PROVIDER_ERROR)
        if "error" in data:
            return GoogleWalkingResult(cls._walking_error_status(response))
        routes = data.get("routes", [])
        if not isinstance(routes, list):
            return GoogleWalkingResult(GoogleWalkingStatus.PROVIDER_ERROR)
        if not routes:
            return GoogleWalkingResult(GoogleWalkingStatus.NO_ROUTE)
        if not isinstance(routes[0], dict):
            return GoogleWalkingResult(GoogleWalkingStatus.PROVIDER_ERROR)

        route = routes[0]
        origin = (origin_latitude, origin_longitude)
        destination = (destination_latitude, destination_longitude)
        same_location = origin == destination
        distance = route.get("distanceMeters", 0 if same_location else None)
        polyline = route.get("polyline")
        encoded_polyline = polyline.get("encodedPolyline") if isinstance(polyline, dict) else None
        if (
            type(distance) is not int
            or distance < 0
            or (
                distance > 0
                and (not isinstance(encoded_polyline, str) or not encoded_polyline.strip())
            )
        ):
            return GoogleWalkingResult(GoogleWalkingStatus.PROVIDER_ERROR)
        try:
            duration = cls._parse_duration_seconds(route.get("duration"))
        except ValueError:
            return GoogleWalkingResult(GoogleWalkingStatus.PROVIDER_ERROR)

        legs = route.get("legs")
        leg = legs[0] if isinstance(legs, list) and len(legs) == 1 else None
        start = cls._walking_endpoint(leg.get("startLocation")) if isinstance(leg, dict) else None
        end = cls._walking_endpoint(leg.get("endLocation")) if isinstance(leg, dict) else None
        warnings = route.get("warnings")
        if not isinstance(warnings, list):
            warnings = []
        normalized = GoogleWalkingRoute(
            distance_meters=distance,
            duration_seconds=duration,
            encoded_polyline=encoded_polyline if isinstance(encoded_polyline, str) else None,
            start_location=start,
            end_location=end,
            warnings=tuple(warning for warning in warnings if isinstance(warning, str)),
        )
        if (
            start is None
            or end is None
            or (start == end and not same_location)
            or (distance == 0 and (not same_location or start != end))
            or GoogleMapsService.calculate_distance_meters(*origin, *start) > maximum_endpoint_displacement_meters
            or GoogleMapsService.calculate_distance_meters(*destination, *end) > maximum_endpoint_displacement_meters
        ):
            return GoogleWalkingResult(GoogleWalkingStatus.UNSUITABLE_ENDPOINTS, normalized)
        return GoogleWalkingResult(GoogleWalkingStatus.AVAILABLE, normalized)

    @classmethod
    def compute_road_route(
        cls,
        *,
        origin_latitude,
        origin_longitude,
        destination_latitude,
        destination_longitude,
    ):
        """Return one normalized traffic-aware driving route, if available."""

        try:
            response = requests.post(
                cls.COMPUTE_ROUTES_URL,
                json={
                    "origin": {
                        "location": {
                            "latLng": {
                                "latitude": origin_latitude,
                                "longitude": origin_longitude,
                            },
                        },
                    },
                    "destination": {
                        "location": {
                            "latLng": {
                                "latitude": destination_latitude,
                                "longitude": destination_longitude,
                            },
                        },
                    },
                    "travelMode": "DRIVE",
                    "routingPreference": "TRAFFIC_AWARE",
                    "computeAlternativeRoutes": False,
                    "units": "METRIC",
                },
                headers={
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": settings.GOOGLE_MAPS_API_KEY,
                    "X-Goog-FieldMask": cls.FIELD_MASK,
                },
                timeout=cls.REQUEST_TIMEOUT_SECONDS,
            )

            response.raise_for_status()
            data = response.json()

            if not isinstance(data, dict):
                raise ValueError("Google Routes returned an invalid response.")

            if "routes" not in data:
                return None

            routes = data["routes"]

            if routes == []:
                return None

            if not isinstance(routes, list) or not routes:
                raise ValueError("Google Routes returned an invalid route list.")

            route = routes[0]
            polyline = route.get("polyline", {}).get("encodedPolyline")
            distance_meters = route.get("distanceMeters")

            if (
                not isinstance(distance_meters, int)
                or distance_meters < 0
                or not isinstance(polyline, str)
                or not polyline
            ):
                raise ValueError("Google Routes returned an invalid route.")

            return {
                "distance_meters": distance_meters,
                "duration_seconds": cls._parse_duration_seconds(
                    route.get("duration"),
                ),
                "encoded_polyline": polyline,
            }

        except requests.HTTPError as error:
            response = error.response

            logger.exception(
                "Google Routes returned HTTP %s: %s",
                response.status_code if response is not None else "unknown",
                response.text if response is not None else "no response body",
            )

            raise RoadRouteServiceUnavailable() from error

        except (
            requests.RequestException,
            TypeError,
            ValueError,
        ) as error:
            logger.exception(
                "Google Routes request failed: %s",
                error,  # noqa: TRY401
            )

            raise RoadRouteServiceUnavailable() from error
