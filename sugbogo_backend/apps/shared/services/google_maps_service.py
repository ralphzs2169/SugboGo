from math import asin, cos, radians, sin, sqrt

import requests
from django.conf import settings


class GoogleMapsService:
    """Provides access to Google Maps and Places location services."""

    GOOGLE_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
    GOOGLE_PLACES_URL = "https://places.googleapis.com/v1/places"

    NEARBY_LANDMARK_CANDIDATE_POOL_SIZE = 20
    NEARBY_LANDMARK_RADIUS_METERS = 500.0
    NEARBY_LANDMARK_MAX_RESULTS = 3

    SELECTED_LOCATION_EXCLUSION_RADIUS_METERS = 10.0
    REQUEST_TIMEOUT_SECONDS = 20 # Maximum time to wait for a Google Maps API response.

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
    def _calculate_distance_meters(
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

        return 2 * earth_radius_meters * asin(sqrt(a))


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
    def search_nearby_landmarks(latitude, longitude):
        """Returns nearby places that can serve as useful business landmarks."""

        response = requests.post(
            f"{GoogleMapsService.GOOGLE_PLACES_URL}:searchNearby",
            json={
                "maxResultCount": (
                    GoogleMapsService.NEARBY_LANDMARK_CANDIDATE_POOL_SIZE
                ),
                "locationRestriction": {
                    "circle": {
                        "center": {
                            "latitude": latitude,
                            "longitude": longitude,
                        },
                        "radius": (
                            GoogleMapsService.NEARBY_LANDMARK_RADIUS_METERS
                        ),
                    }
                },
                # Favor recognizable places while keeping every result
                # inside the configured landmark radius.
                "rankPreference": "POPULARITY",
            },
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": settings.GOOGLE_MAPS_API_KEY,
                "X-Goog-FieldMask": (
                    "places.id,"
                    "places.displayName,"
                    "places.formattedAddress,"
                    "places.location"
                ),
            },
            timeout=GoogleMapsService.REQUEST_TIMEOUT_SECONDS,
        )

        response.raise_for_status()

        data = response.json()
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
