from dataclasses import dataclass
from math import asin, cos, radians, sin, sqrt

import requests
from django.conf import settings


def valid_latitude_longitude(
    latitude,
    longitude,
):
    """Check geographic coordinate types and bounds for a Google request or response."""
    return (
        type(latitude) in (int, float)
        and type(longitude) in (int, float)
        and -90 <= latitude <= 90
        and -180 <= longitude <= 180
    )


@dataclass(frozen=True)
class GoogleNearbyLandmark:
    """Request-scoped Google Places context for a pedestrian access location."""

    place_id: str
    name: str
    address: str
    latitude: float
    longitude: float
    distance_meters: float
    attributions: tuple[tuple[str, str], ...]
    source: str = "google_places"


class GoogleMapsService:
    """Provides access to Google Maps and Places location services."""

    GOOGLE_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
    GOOGLE_PLACES_URL = "https://places.googleapis.com/v1/places"

    NEARBY_LANDMARK_CANDIDATE_POOL_SIZE = 20
    NEARBY_LANDMARK_RADIUS_METERS = 500.0
    NEARBY_LANDMARK_MAX_RESULTS = 3

    SELECTED_LOCATION_EXCLUSION_RADIUS_METERS = 10.0
    REQUEST_TIMEOUT_SECONDS = 20 # Maximum time to wait for a Google Maps API response.

    TRANSIT_LANDMARK_RADIUS_METERS = 150.0
    TRANSIT_LANDMARK_TIMEOUT_SECONDS = 5
    TRANSIT_LANDMARK_PRIMARY_TYPES = (
        "bus_station",
        "transit_station",
        "train_station",
        "shopping_mall",
        "supermarket",
        "university",
        "school",
        "hospital",
        "church",
        "park",
        "tourist_attraction",
        "city_hall",
        "library",
        "police",
        "convenience_store",
        "gas_station",
    )

    @staticmethod
    def _parse_address_components(components, *, geocoding_api=False):
        """Extracts registration address fields from Google address components."""

        address = {
            "province": "",
            "city": "",
            "barangay": "",
            "streetAddress": "",
        }

        street_number = ""

        for component in components:
            types = component.get("types", [])

            # The Places API uses "longText", while the Geocoding API
            # uses "long_name" for the component's readable value.
            value = component.get(
                "long_name" if geocoding_api else "longText",
                "",
            )

            if "street_number" in types:
                street_number = value

            # Map Google's administrative area to the registration fields.
            if "administrative_area_level_2" in types:
                address["province"] = value

            if "locality" in types:
                address["city"] = value

            # Google may identify the barangay using different
            # sublocality component types.
            if (
                "sublocality_level_1" in types
                or "sublocality_level_2" in types
                or "sublocality" in types
            ):
                address["barangay"] = value

            # The route represents the street or road name.
            if "route" in types:
                address["streetAddress"] = value

        # Combine the street number and street name into one
        # street address when both values are available.
        if street_number and address["streetAddress"]:
            address["streetAddress"] = (
                f"{street_number} {address['streetAddress']}"
            )

        return address


    @staticmethod
    def search_places(
        search_input,
        location_restriction,
    ):
        """Returns place suggestions matching the provided search input."""

        request_data = {
            "input": search_input,
            "includedRegionCodes": ["ph"],
        }

        if location_restriction is None:
            return []

        request_data["locationRestriction"] = location_restriction

        response = requests.post(
            f"{GoogleMapsService.GOOGLE_PLACES_URL}:autocomplete",
            json=request_data,
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": settings.GOOGLE_MAPS_API_KEY,
                "X-Goog-FieldMask": (
                    "suggestions.placePrediction.placeId,"
                    "suggestions.placePrediction.text,"
                    "suggestions.placePrediction.structuredFormat"
                ),
            },
            timeout=GoogleMapsService.REQUEST_TIMEOUT_SECONDS,
        )

        response.raise_for_status()

        data = response.json()
        suggestions = []

        for suggestion in data.get("suggestions", []):
            prediction = suggestion.get("placePrediction")

            if not prediction:
                continue

            # Google separates the primary and secondary display text
            # inside the structured format of the place prediction.
            structured_format = prediction.get("structuredFormat", {})
            main_text = structured_format.get("mainText", {})
            secondary_text = structured_format.get("secondaryText", {})

            suggestions.append(
                {
                    "placeId": prediction.get("placeId", ""),
                    # Prefer the structured main text, falling back to
                    # the prediction text when structured text is unavailable.
                    "mainText": (
                        main_text.get("text")
                        or prediction.get("text", {}).get("text", "")
                    ),
                    "secondaryText": secondary_text.get("text", ""),
                }
            )

        return suggestions

    @staticmethod
    def get_place_details(place_id):
        """Returns coordinates and structured address details for a place."""

        response = requests.get(
            f"{GoogleMapsService.GOOGLE_PLACES_URL}/{place_id}",
            headers={
                "X-Goog-Api-Key": settings.GOOGLE_MAPS_API_KEY,
                "X-Goog-FieldMask": (
                    "location,formattedAddress,addressComponents"
                ),
            },
            timeout=GoogleMapsService.REQUEST_TIMEOUT_SECONDS,
        )

        response.raise_for_status()

        data = response.json()


        location = data.get("location", {})
        
        latitude = location.get("latitude")
        longitude = location.get("longitude")

        if not isinstance(latitude, (int, float)) or not isinstance(
            longitude, (int, float)
        ):
            raise TypeError("Place location is unavailable.")

        address = {
            "formattedAddress": data.get("formattedAddress", ""),
            **GoogleMapsService._parse_address_components(
                data.get("addressComponents", [])
            ),
        }

        return {
            "latitude": latitude,
            "longitude": longitude,
            **address,
        }


    @staticmethod
    def reverse_geocode(latitude, longitude):
        """Resolves geographic coordinates into structured business address details."""

        response = requests.get(
            GoogleMapsService.GOOGLE_GEOCODE_URL,
            params={
                "latlng": f"{latitude},{longitude}",
                "key": settings.GOOGLE_MAPS_API_KEY,
            },
            timeout=GoogleMapsService.REQUEST_TIMEOUT_SECONDS,
        )

        response.raise_for_status()

        data = response.json()

        if data.get("status") != "OK":
            raise ValueError(
                data.get("error_message")
                or "Unable to determine the location."
            )

        result = data["results"][0]

        address = {
            "formattedAddress": result.get("formatted_address", ""),
            **GoogleMapsService._parse_address_components(
                result.get("address_components", []),
                geocoding_api=True,
            ),
        }

        return address

    @staticmethod
    def calculate_distance_meters(
        latitude,
        longitude,
        target_latitude,
        target_longitude,
    ):
        """Calculates the distance in meters between two geographic coordinates."""

        earth_radius_meters = 6_371_000

        latitude_difference = radians(target_latitude - latitude)
        longitude_difference = radians(target_longitude - longitude)

        a = (
            sin(latitude_difference / 2) ** 2
            + cos(radians(latitude))
            * cos(radians(target_latitude))
            * sin(longitude_difference / 2) ** 2
        )

        return 2 * earth_radius_meters * asin(sqrt(min(a, 1.0)))

    _calculate_distance_meters = calculate_distance_meters


    @staticmethod
    def _is_within_distance(
        latitude,
        longitude,
        target_latitude,
        target_longitude,
        max_distance_meters,
    ):
        """Checks whether two geographic coordinates are within a given distance."""

        distance = GoogleMapsService._calculate_distance_meters(
            latitude,
            longitude,
            target_latitude,
            target_longitude,
        )

        return distance <= max_distance_meters

    @staticmethod
    def _request_nearby_places(
        latitude,
        longitude,
        *,
        radius_meters,
        field_mask,
        timeout,
        included_primary_types=(),
    ):
        """Send a popularity-ranked Nearby Search using the caller's field mask."""
        payload = {
            "maxResultCount": GoogleMapsService.NEARBY_LANDMARK_CANDIDATE_POOL_SIZE,
            "locationRestriction": {
                "circle": {
                    "center": {
                        "latitude": latitude,
                        "longitude": longitude,
                    },
                    "radius": radius_meters,
                },
            },
            "rankPreference": "POPULARITY",
        }
        request_options = {}
        if included_primary_types:
            payload["includedPrimaryTypes"] = list(included_primary_types)
            request_options["allow_redirects"] = False
        response = requests.post(
            f"{GoogleMapsService.GOOGLE_PLACES_URL}:searchNearby",
            json=payload,
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": settings.GOOGLE_MAPS_API_KEY,
                "X-Goog-FieldMask": field_mask,
            },
            timeout=timeout,
            **request_options,
        )
        response.raise_for_status()
        if included_primary_types and not 200 <= response.status_code < 300:
            raise requests.HTTPError("Unexpected Nearby Search response status.", response=response)
        return response.json()

    @staticmethod
    def search_nearby_landmarks(
        latitude,
        longitude,
    ):
        """Return nearby places that may be useful as business landmarks."""
        data = GoogleMapsService._request_nearby_places(
            latitude,
            longitude,
            radius_meters=GoogleMapsService.NEARBY_LANDMARK_RADIUS_METERS,
            field_mask="places.id,places.displayName,places.formattedAddress,places.location",
            timeout=GoogleMapsService.REQUEST_TIMEOUT_SECONDS,
        )
        candidates = []

        for place in data.get("places", []):
            location = place.get("location", {})
            place_latitude = location.get("latitude")
            place_longitude = location.get("longitude")

            if not isinstance(place_latitude, (int, float)) or not isinstance(
                place_longitude,
                (int, float),
            ):
                continue

            distance_meters = GoogleMapsService._calculate_distance_meters(
                latitude,
                longitude,
                place_latitude,
                place_longitude,
            )

            # Avoid suggesting the pinned business location itself.
            if (
                distance_meters
                <= GoogleMapsService.SELECTED_LOCATION_EXCLUSION_RADIUS_METERS
            ):
                continue

            display_name = place.get("displayName", {})

            candidates.append(
                {
                    "placeId": place.get("id", ""),
                    "name": display_name.get("text", ""),
                    "address": place.get("formattedAddress", ""),
                    "latitude": place_latitude,
                    "longitude": place_longitude,
                    "distanceMeters": round(distance_meters),
                }
            )

        # Google provides a pool of popular nearby places. From that pool,
        # prefer landmarks that are geographically closer to the business.
        candidates.sort(
            key=lambda landmark: landmark["distanceMeters"],
        )

        return candidates[
            : GoogleMapsService.NEARBY_LANDMARK_MAX_RESULTS
        ]

    @staticmethod
    def search_transit_landmark(
        latitude: float,
        longitude: float,
    ) -> GoogleNearbyLandmark | None:
        """Find nearby recognizable context without using it as an access coordinate."""
        if (
            not valid_latitude_longitude(latitude, longitude)
            or not settings.GOOGLE_MAPS_API_KEY
        ):
            return None

        data = GoogleMapsService._request_nearby_places(
            latitude,
            longitude,
            radius_meters=GoogleMapsService.TRANSIT_LANDMARK_RADIUS_METERS,
            field_mask=(
                "places.id,places.displayName,places.formattedAddress,places.location,"
                "places.primaryType,places.businessStatus,places.attributions"
            ),
            timeout=GoogleMapsService.TRANSIT_LANDMARK_TIMEOUT_SECONDS,
            included_primary_types=GoogleMapsService.TRANSIT_LANDMARK_PRIMARY_TYPES,
        )
        if not isinstance(data, dict) or not isinstance(data.get("places", []), list):
            return None

        candidates = []
        for popularity_rank, place in enumerate(data.get("places", [])):
            if not isinstance(place, dict):
                continue
            location = place.get("location")
            display_name = place.get("displayName")
            place_id = place.get("id")
            if (
                not isinstance(location, dict)
                or not isinstance(display_name, dict)
                or not isinstance(place_id, str)
                or not place_id
                or place.get("primaryType") not in GoogleMapsService.TRANSIT_LANDMARK_PRIMARY_TYPES
                or place.get("businessStatus") in ("CLOSED_TEMPORARILY", "CLOSED_PERMANENTLY")
            ):
                continue

            name = display_name.get("text")
            place_latitude = location.get("latitude")
            place_longitude = location.get("longitude")
            if (
                not isinstance(name, str)
                or not name.strip()
                or not valid_latitude_longitude(place_latitude, place_longitude)
            ):
                continue
            distance = GoogleMapsService.calculate_distance_meters(
                latitude,
                longitude,
                place_latitude,
                place_longitude,
            )
            if distance > GoogleMapsService.TRANSIT_LANDMARK_RADIUS_METERS:
                continue

            attributions = place.get("attributions")
            if not isinstance(attributions, list):
                attributions = []
            address = place.get("formattedAddress")
            landmark = GoogleNearbyLandmark(
                place_id=place_id,
                name=name.strip(),
                address=address if isinstance(address, str) else "",
                latitude=place_latitude,
                longitude=place_longitude,
                distance_meters=distance,
                attributions=tuple(
                    (
                        item["provider"],
                        item["providerUri"] if isinstance(item.get("providerUri"), str) else "",
                    )
                    for item in attributions
                    if (
                        isinstance(item, dict)
                        and isinstance(item.get("provider"), str)
                        and item["provider"]
                    )
                ),
            )
            # Use popularity to break ties between similarly close places of useful types.
            candidates.append((int(distance // 25), popularity_rank, landmark))
        if not candidates:
            return None
        return min(candidates, key=lambda candidate: candidate[:2])[2]
