import logging
import math

import requests
from django.conf import settings
from rest_framework import status
from rest_framework.exceptions import APIException

logger = logging.getLogger(__name__)


class RoadRouteServiceUnavailable(APIException):
    """Represent a safe client-facing failure from Google Routes."""

    status_code = status.HTTP_502_BAD_GATEWAY
    default_detail = "Road route guidance is temporarily unavailable."
    default_code = "road_route_service_unavailable"


class GoogleRoutesService:
    """Request and normalize driving routes from Google Routes API."""

    COMPUTE_ROUTES_URL = (
        "https://routes.googleapis.com/directions/v2:computeRoutes"
    )
    FIELD_MASK = (
        "routes.distanceMeters,"
        "routes.duration,"
        "routes.polyline.encodedPolyline"
    )
    REQUEST_TIMEOUT_SECONDS = 10

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