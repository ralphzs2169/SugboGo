from unittest.mock import Mock, patch

import requests
from django.test import SimpleTestCase, override_settings

from apps.shared.services.google_maps_service import GoogleMapsService


@override_settings(GOOGLE_MAPS_API_KEY="test-google-maps-key")
class GoogleMapsServiceTests(SimpleTestCase):
    """Tests for Google Maps and Places service integrations."""

    def setUp(self):
        self.service = GoogleMapsService
        self.location_restriction = {
            "rectangle": {
                "low": {
                    "latitude": 10.30,
                    "longitude": 123.87,
                },
                "high": {
                    "latitude": 10.34,
                    "longitude": 123.92,
                },
            },
        }

    # Address parsing

    def test_parse_address_components_parses_places_components(self):
        components = [
            {
                "types": ["street_number"],
                "longText": "123",
            },
            {
                "types": ["route"],
                "longText": "Osmeña Boulevard",
            },
            {
                "types": ["sublocality_level_1"],
                "longText": "Capitol Site",
            },
            {
                "types": ["locality"],
                "longText": "Cebu City",
            },
            {
                "types": ["administrative_area_level_2"],
                "longText": "Cebu",
            },
        ]

        result = self.service._parse_address_components(components)

        self.assertEqual(
            result,
            {
                "province": "Cebu",
                "city": "Cebu City",
                "barangay": "Capitol Site",
                "streetAddress": "123 Osmeña Boulevard",
            },
        )

    def test_parse_address_components_parses_geocoding_components(self):
        components = [
            {
                "types": ["street_number"],
                "long_name": "456",
            },
            {
                "types": ["route"],
                "long_name": "Colon Street",
            },
            {
                "types": ["sublocality"],
                "long_name": "Tinago",
            },
            {
                "types": ["locality"],
                "long_name": "Cebu City",
            },
            {
                "types": ["administrative_area_level_2"],
                "long_name": "Cebu",
            },
        ]

        result = self.service._parse_address_components(
            components,
            geocoding_api=True,
        )

        self.assertEqual(
            result["province"],
            "Cebu",
        )

        self.assertEqual(
            result["city"],
            "Cebu City",
        )

        self.assertEqual(
            result["barangay"],
            "Tinago",
        )

        self.assertEqual(
            result["streetAddress"],
            "456 Colon Street",
        )

    def test_parse_address_components_handles_missing_components(self):
        result = self.service._parse_address_components([])

        self.assertEqual(
            result,
            {
                "province": "",
                "city": "",
                "barangay": "",
                "streetAddress": "",
            },
        )

    # Place search

    @patch("apps.shared.services.google_maps_service.requests.post")
    def test_search_places_returns_place_suggestions(self, mock_post):
        mock_response = Mock()

        mock_response.json.return_value = {
            "suggestions": [
                {
                    "placePrediction": {
                        "placeId": "ChIJ123",
                        "text": {
                            "text": "Ayala Center Cebu",
                        },
                        "structuredFormat": {
                            "mainText": {
                                "text": "Ayala Center Cebu",
                            },
                            "secondaryText": {
                                "text": "Cebu City, Cebu",
                            },
                        },
                    }
                },
            ]
        }

        mock_post.return_value = mock_response

        result = self.service.search_places(
            "Ayala Cebu",
            self.location_restriction,
        )

        self.assertEqual(
            result,
            [
                {
                    "placeId": "ChIJ123",
                    "mainText": "Ayala Center Cebu",
                    "secondaryText": "Cebu City, Cebu",
                }
            ],
        )

        mock_post.assert_called_once_with(
            "https://places.googleapis.com/v1/places:autocomplete",
            json={
                "input": "Ayala Cebu",
                "includedRegionCodes": ["ph"],
                "locationRestriction": self.location_restriction,
            },
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": "test-google-maps-key",
                "X-Goog-FieldMask": (
                    "suggestions.placePrediction.placeId,"
                    "suggestions.placePrediction.text,"
                    "suggestions.placePrediction.structuredFormat"
                ),
            },
            timeout=10,
        )

        mock_response.raise_for_status.assert_called_once()

    @patch("apps.shared.services.google_maps_service.requests.post")
    def test_search_places_returns_no_suggestions_without_a_restriction(
        self,
        mock_post,
    ):
        result = self.service.search_places(
            "Cebu",
            None,
        )

        self.assertEqual(result, [])
        mock_post.assert_not_called()

    @patch("apps.shared.services.google_maps_service.requests.post")
    def test_search_places_ignores_invalid_suggestions(self, mock_post):
        mock_response = Mock()

        mock_response.json.return_value = {
            "suggestions": [
                {},
                {
                    "placePrediction": None,
                },
                {
                    "placePrediction": {
                        "placeId": "ChIJ123",
                        "text": {
                            "text": "Cebu City",
                        },
                        "structuredFormat": {},
                    },
                },
            ]
        }

        mock_post.return_value = mock_response

        result = self.service.search_places(
            "Cebu",
            self.location_restriction,
        )

        self.assertEqual(
            result,
            [
                {
                    "placeId": "ChIJ123",
                    "mainText": "Cebu City",
                    "secondaryText": "",
                }
            ],
        )

    @patch("apps.shared.services.google_maps_service.requests.post")
    def test_search_places_raises_when_google_request_fails(
        self,
        mock_post,
    ):
        mock_response = Mock()
        mock_response.raise_for_status.side_effect = requests.HTTPError(
            "Google API unavailable"
        )

        mock_post.return_value = mock_response

        with self.assertRaises(requests.HTTPError):
            self.service.search_places(
                "Ayala",
                self.location_restriction,
            )

        mock_response.raise_for_status.assert_called_once()

    # Place details

    @patch("apps.shared.services.google_maps_service.requests.get")
    def test_get_place_details_returns_location_and_address(self, mock_get):
        mock_response = Mock()

        mock_response.json.return_value = {
            "location": {
                "latitude": 10.3157,
                "longitude": 123.8854,
            },
            "formattedAddress": "123 Osmeña Boulevard, Cebu City",
            "addressComponents": [
                {
                    "types": ["street_number"],
                    "longText": "123",
                },
                {
                    "types": ["route"],
                    "longText": "Osmeña Boulevard",
                },
                {
                    "types": ["locality"],
                    "longText": "Cebu City",
                },
                {
                    "types": ["administrative_area_level_2"],
                    "longText": "Cebu",
                },
            ],
        }

        mock_get.return_value = mock_response

        result = self.service.get_place_details("ChIJ123")

        self.assertEqual(
            result["latitude"],
            10.3157,
        )

        self.assertEqual(
            result["longitude"],
            123.8854,
        )

        self.assertEqual(
            result["formattedAddress"],
            "123 Osmeña Boulevard, Cebu City",
        )

        self.assertEqual(
            result["streetAddress"],
            "123 Osmeña Boulevard",
        )

        self.assertEqual(
            result["city"],
            "Cebu City",
        )

        self.assertEqual(
            result["province"],
            "Cebu",
        )

        mock_get.assert_called_once_with(
            "https://places.googleapis.com/v1/places/ChIJ123",
            headers={
                "X-Goog-Api-Key": "test-google-maps-key",
                "X-Goog-FieldMask": (
                    "location,formattedAddress,addressComponents"
                ),
            },
            timeout=10,
        )

    @patch("apps.shared.services.google_maps_service.requests.get")
    def test_get_place_details_raises_when_location_is_missing(
        self,
        mock_get,
    ):
        mock_response = Mock()

        mock_response.json.return_value = {
            "formattedAddress": "Cebu City, Cebu",
            "addressComponents": [],
        }

        mock_get.return_value = mock_response

        with self.assertRaisesRegex(
            TypeError,
            "Place location is unavailable.",
        ):
            self.service.get_place_details("ChIJ123")

    # Reverse geocoding

    @patch("apps.shared.services.google_maps_service.requests.get")
    def test_reverse_geocode_returns_structured_address(self, mock_get):
        mock_response = Mock()

        mock_response.json.return_value = {
            "status": "OK",
            "results": [
                {
                    "formatted_address": "123 Colon Street, Cebu City",
                    "address_components": [
                        {
                            "types": ["street_number"],
                            "long_name": "123",
                        },
                        {
                            "types": ["route"],
                            "long_name": "Colon Street",
                        },
                        {
                            "types": ["locality"],
                            "long_name": "Cebu City",
                        },
                        {
                            "types": ["administrative_area_level_2"],
                            "long_name": "Cebu",
                        },
                    ],
                }
            ],
        }

        mock_get.return_value = mock_response

        result = self.service.reverse_geocode(
            10.3157,
            123.8854,
        )

        self.assertEqual(
            result,
            {
                "formattedAddress": "123 Colon Street, Cebu City",
                "province": "Cebu",
                "city": "Cebu City",
                "barangay": "",
                "streetAddress": "123 Colon Street",
            },
        )

        mock_get.assert_called_once_with(
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={
                "latlng": "10.3157,123.8854",
                "key": "test-google-maps-key",
            },
            timeout=10,
        )

    @patch("apps.shared.services.google_maps_service.requests.get")
    def test_reverse_geocode_raises_when_google_returns_error_status(
        self,
        mock_get,
    ):
        mock_response = Mock()

        mock_response.json.return_value = {
            "status": "ZERO_RESULTS",
            "error_message": "No results found.",
        }

        mock_get.return_value = mock_response

        with self.assertRaisesRegex(
            ValueError,
            "No results found.",
        ):
            self.service.reverse_geocode(
                10.3157,
                123.8854,
            )

    @patch("apps.shared.services.google_maps_service.requests.get")
    def test_reverse_geocode_uses_default_error_message_when_error_message_missing(
        self,
        mock_get,
    ):
        mock_response = Mock()

        mock_response.json.return_value = {
            "status": "ZERO_RESULTS",
        }

        mock_get.return_value = mock_response

        with self.assertRaisesRegex(
            ValueError,
            "Unable to determine the location.",
        ):
            self.service.reverse_geocode(
                10.3157,
                123.8854,
            )

    # Distance calculation

    def test_calculate_distance_meters_returns_zero_for_same_location(self):
        result = self.service._calculate_distance_meters(
            10.3157,
            123.8854,
            10.3157,
            123.8854,
        )

        self.assertEqual(
            result,
            0,
        )

    def test_calculate_distance_meters_returns_distance_between_locations(self):
        result = self.service._calculate_distance_meters(
            10.3157,
            123.8854,
            10.3160,
            123.8860,
        )

        self.assertAlmostEqual(
            result,
            73.63,
            places=2,
        )

    # Nearby landmarks

    @patch("apps.shared.services.google_maps_service.requests.post")
    def test_search_nearby_landmarks_returns_landmarks(self, mock_post):
        mock_response = Mock()

        mock_response.json.return_value = {
            "places": [
                {
                    "id": "ChIJLANDMARK1",
                    "displayName": {
                        "text": "Cebu Provincial Capitol",
                    },
                    "formattedAddress": "Capitol Site, Cebu City",
                    "location": {
                        "latitude": 10.3160,
                        "longitude": 123.8860,
                    },
                },
                {
                    "id": "ChIJLANDMARK2",
                    "displayName": {
                        "text": "Nearby Shopping Center",
                    },
                    "formattedAddress": "Cebu City, Cebu",
                    "location": {
                        "latitude": 10.3170,
                        "longitude": 123.8865,
                    },
                },
            ]
        }

        mock_post.return_value = mock_response

        result = self.service.search_nearby_landmarks(
            10.3157,
            123.8854,
        )

        self.assertEqual(
            result,
            [
                {
                    "placeId": "ChIJLANDMARK1",
                    "name": "Cebu Provincial Capitol",
                    "address": "Capitol Site, Cebu City",
                    "latitude": 10.3160,
                    "longitude": 123.8860,
                    "distanceMeters": 74,
                },
                {
                    "placeId": "ChIJLANDMARK2",
                    "name": "Nearby Shopping Center",
                    "address": "Cebu City, Cebu",
                    "latitude": 10.3170,
                    "longitude": 123.8865,
                    "distanceMeters": 188,
                },
            ],
        )

        mock_post.assert_called_once_with(
            "https://places.googleapis.com/v1/places:searchNearby",
            json={
                "maxResultCount": 20,
                "locationRestriction": {
                    "circle": {
                        "center": {
                            "latitude": 10.3157,
                            "longitude": 123.8854,
                        },
                        "radius": 500.0,
                    }
                },
                "rankPreference": "POPULARITY",
            },
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": "test-google-maps-key",
                "X-Goog-FieldMask": (
                    "places.id,"
                    "places.displayName,"
                    "places.formattedAddress,"
                    "places.location"
                ),
            },
            timeout=10,
        )

        mock_response.raise_for_status.assert_called_once()

    @patch("apps.shared.services.google_maps_service.requests.post")
    def test_search_nearby_landmarks_sorts_candidates_by_distance(
        self,
        mock_post,
    ):
        mock_response = Mock()

        # Google returns candidates by popularity, not necessarily distance.
        mock_response.json.return_value = {
            "places": [
                {
                    "id": "ChIJFARTHER",
                    "displayName": {
                        "text": "Farther Landmark",
                    },
                    "formattedAddress": "Cebu City, Cebu",
                    "location": {
                        "latitude": 10.3180,
                        "longitude": 123.8865,
                    },
                },
                {
                    "id": "ChIJNEAREST",
                    "displayName": {
                        "text": "Nearest Landmark",
                    },
                    "formattedAddress": "Cebu City, Cebu",
                    "location": {
                        "latitude": 10.3160,
                        "longitude": 123.8860,
                    },
                },
                {
                    "id": "ChIJMIDDLE",
                    "displayName": {
                        "text": "Middle Landmark",
                    },
                    "formattedAddress": "Cebu City, Cebu",
                    "location": {
                        "latitude": 10.3170,
                        "longitude": 123.8865,
                    },
                },
            ]
        }

        mock_post.return_value = mock_response

        result = self.service.search_nearby_landmarks(
            10.3157,
            123.8854,
        )

        self.assertEqual(
            [landmark["placeId"] for landmark in result],
            [
                "ChIJNEAREST",
                "ChIJMIDDLE",
                "ChIJFARTHER",
            ],
        )

        self.assertEqual(
            [landmark["distanceMeters"] for landmark in result],
            [
                74,
                188,
                283,
            ],
        )

    @patch("apps.shared.services.google_maps_service.requests.post")
    def test_search_nearby_landmarks_excludes_pinned_business_location(
        self,
        mock_post,
    ):
        mock_response = Mock()

        mock_response.json.return_value = {
            "places": [
                {
                    "id": "ChIJBUSINESS",
                    "displayName": {
                        "text": "Pinned Business",
                    },
                    "formattedAddress": "Cebu City, Cebu",
                    "location": {
                        # Effectively the same location as the merchant pin.
                        "latitude": 10.3157001,
                        "longitude": 123.8854001,
                    },
                },
                {
                    "id": "ChIJLANDMARK",
                    "displayName": {
                        "text": "Valid Nearby Landmark",
                    },
                    "formattedAddress": "Cebu City, Cebu",
                    "location": {
                        "latitude": 10.3160,
                        "longitude": 123.8860,
                    },
                },
            ]
        }

        mock_post.return_value = mock_response

        result = self.service.search_nearby_landmarks(
            10.3157,
            123.8854,
        )

        self.assertEqual(
            len(result),
            1,
        )

        self.assertEqual(
            result[0]["placeId"],
            "ChIJLANDMARK",
        )

        self.assertEqual(
            result[0]["name"],
            "Valid Nearby Landmark",
        )

    @patch("apps.shared.services.google_maps_service.requests.post")
    def test_search_nearby_landmarks_keeps_place_outside_exclusion_radius(
        self,
        mock_post,
    ):
        mock_response = Mock()

        mock_response.json.return_value = {
            "places": [
                {
                    "id": "ChIJLANDMARK",
                    "displayName": {
                        "text": "Nearby Landmark",
                    },
                    "formattedAddress": "Cebu City, Cebu",
                    "location": {
                        # Approximately 16 meters from the selected location.
                        "latitude": 10.3158,
                        "longitude": 123.8855,
                    },
                },
            ]
        }

        mock_post.return_value = mock_response

        result = self.service.search_nearby_landmarks(
            10.3157,
            123.8854,
        )

        self.assertEqual(
            len(result),
            1,
        )

        self.assertEqual(
            result[0]["placeId"],
            "ChIJLANDMARK",
        )

        self.assertEqual(
            result[0]["distanceMeters"],
            16,
        )

    @patch("apps.shared.services.google_maps_service.requests.post")
    def test_search_nearby_landmarks_limits_results_to_three(
        self,
        mock_post,
    ):
        mock_response = Mock()

        mock_response.json.return_value = {
            "places": [
                {
                    "id": "ChIJLANDMARK4",
                    "displayName": {
                        "text": "Landmark Four",
                    },
                    "formattedAddress": "Cebu City, Cebu",
                    "location": {
                        "latitude": 10.3190,
                        "longitude": 123.8870,
                    },
                },
                {
                    "id": "ChIJLANDMARK2",
                    "displayName": {
                        "text": "Landmark Two",
                    },
                    "formattedAddress": "Cebu City, Cebu",
                    "location": {
                        "latitude": 10.3170,
                        "longitude": 123.8865,
                    },
                },
                {
                    "id": "ChIJLANDMARK1",
                    "displayName": {
                        "text": "Landmark One",
                    },
                    "formattedAddress": "Cebu City, Cebu",
                    "location": {
                        "latitude": 10.3160,
                        "longitude": 123.8860,
                    },
                },
                {
                    "id": "ChIJLANDMARK3",
                    "displayName": {
                        "text": "Landmark Three",
                    },
                    "formattedAddress": "Cebu City, Cebu",
                    "location": {
                        "latitude": 10.3180,
                        "longitude": 123.8865,
                    },
                },
            ]
        }

        mock_post.return_value = mock_response

        result = self.service.search_nearby_landmarks(
            10.3157,
            123.8854,
        )

        self.assertEqual(
            len(result),
            3,
        )

        self.assertEqual(
            [landmark["placeId"] for landmark in result],
            [
                "ChIJLANDMARK1",
                "ChIJLANDMARK2",
                "ChIJLANDMARK3",
            ],
        )

    @patch("apps.shared.services.google_maps_service.requests.post")
    def test_search_nearby_landmarks_ignores_places_with_missing_coordinates(
        self,
        mock_post,
    ):
        mock_response = Mock()

        mock_response.json.return_value = {
            "places": [
                {
                    "id": "ChIJMISSING",
                    "displayName": {
                        "text": "Missing Location",
                    },
                    "formattedAddress": "Cebu City, Cebu",
                },
                {
                    "id": "ChIJINVALID",
                    "displayName": {
                        "text": "Invalid Location",
                    },
                    "formattedAddress": "Cebu City, Cebu",
                    "location": {
                        "latitude": "10.3160",
                        "longitude": "123.8860",
                    },
                },
                {
                    "id": "ChIJVALID",
                    "displayName": {
                        "text": "Valid Landmark",
                    },
                    "formattedAddress": "Cebu City, Cebu",
                    "location": {
                        "latitude": 10.3160,
                        "longitude": 123.8860,
                    },
                },
            ]
        }

        mock_post.return_value = mock_response

        result = self.service.search_nearby_landmarks(
            10.3157,
            123.8854,
        )

        self.assertEqual(
            len(result),
            1,
        )

        self.assertEqual(
            result[0]["placeId"],
            "ChIJVALID",
        )

    @patch("apps.shared.services.google_maps_service.requests.post")
    def test_search_nearby_landmarks_handles_missing_display_name(
        self,
        mock_post,
    ):
        mock_response = Mock()

        mock_response.json.return_value = {
            "places": [
                {
                    "id": "ChIJLANDMARK",
                    "formattedAddress": "Cebu City, Cebu",
                    "location": {
                        "latitude": 10.3160,
                        "longitude": 123.8860,
                    },
                },
            ]
        }

        mock_post.return_value = mock_response

        result = self.service.search_nearby_landmarks(
            10.3157,
            123.8854,
        )

        self.assertEqual(
            result[0]["name"],
            "",
        )

    @patch("apps.shared.services.google_maps_service.requests.post")
    def test_search_nearby_landmarks_returns_empty_list_when_no_places(
        self,
        mock_post,
    ):
        mock_response = Mock()
        mock_response.json.return_value = {
            "places": [],
        }

        mock_post.return_value = mock_response

        result = self.service.search_nearby_landmarks(
            10.3157,
            123.8854,
        )

        self.assertEqual(
            result,
            [],
        )

        mock_response.raise_for_status.assert_called_once()

    @patch("apps.shared.services.google_maps_service.requests.post")
    def test_search_nearby_landmarks_returns_empty_list_when_places_missing(
        self,
        mock_post,
    ):
        mock_response = Mock()
        mock_response.json.return_value = {}

        mock_post.return_value = mock_response

        result = self.service.search_nearby_landmarks(
            10.3157,
            123.8854,
        )

        self.assertEqual(
            result,
            [],
        )

    @patch("apps.shared.services.google_maps_service.requests.post")
    def test_search_nearby_landmarks_raises_when_google_request_fails(
        self,
        mock_post,
    ):
        mock_response = Mock()
        mock_response.raise_for_status.side_effect = requests.HTTPError(
            "Google API unavailable"
        )

        mock_post.return_value = mock_response

        with self.assertRaises(requests.HTTPError):
            self.service.search_nearby_landmarks(
                10.3157,
                123.8854,
            )

        mock_response.raise_for_status.assert_called_once()
