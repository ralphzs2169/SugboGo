from unittest.mock import Mock, patch

import requests
from django.test import SimpleTestCase, override_settings

from apps.shared.services.google_maps_service import GoogleMapsService


@override_settings(GOOGLE_MAPS_API_KEY="test-google-maps-key")
class GoogleMapsServiceTests(SimpleTestCase):
    """Tests for Google Maps and Places service integrations."""

    def setUp(self):
        self.service = GoogleMapsService

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

        result = self.service.search_places("Ayala Cebu")

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

        result = self.service.search_places("Cebu")

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
            self.service.search_places("Ayala")

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
    def test_get_place_details_raises_when_location_is_missing(self, mock_get):
        mock_response = Mock()

        mock_response.json.return_value = {
            "formattedAddress": "Cebu City, Cebu",
            "addressComponents": [],
        }

        mock_get.return_value = mock_response

        with self.assertRaises(
            TypeError,
            msg="Place location is unavailable.",
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

    # Nearby landmarks

    @patch("apps.shared.services.google_maps_service.requests.post")
    def test_search_nearby_landmarks_returns_landmarks(self, mock_post):
        mock_response = Mock()

        mock_response.json.return_value = {
            "places": [
                {
                    "id": "ChIJLANDMARK1",
                    "displayName": {
                        "text": "Ayala Center Cebu",
                    },
                    "formattedAddress": "Cebu Business Park, Cebu City",
                    "location": {
                        "latitude": 10.3188,
                        "longitude": 123.9058,
                    },
                },
                {
                    "id": "ChIJLANDMARK2",
                    "displayName": {
                        "text": "Fuente Osmeña Circle",
                    },
                    "formattedAddress": "Fuente Osmeña, Cebu City",
                    "location": {
                        "latitude": 10.3106,
                        "longitude": 123.8930,
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
                    "name": "Ayala Center Cebu",
                    "address": "Cebu Business Park, Cebu City",
                    "latitude": 10.3188,
                    "longitude": 123.9058,
                },
                {
                    "placeId": "ChIJLANDMARK2",
                    "name": "Fuente Osmeña Circle",
                    "address": "Fuente Osmeña, Cebu City",
                    "latitude": 10.3106,
                    "longitude": 123.8930,
                },
            ],
        )

        mock_post.assert_called_once_with(
            "https://places.googleapis.com/v1/places:searchNearby",
            json={
                "maxResultCount": 5,
                "locationRestriction": {
                    "circle": {
                        "center": {
                            "latitude": 10.3157,
                            "longitude": 123.8854,
                        },
                        "radius": 1000.0,
                    }
                },
                "rankPreference": "DISTANCE",
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

    @patch("apps.shared.services.google_maps_service.requests.post")
    def test_search_nearby_landmarks_returns_empty_list_when_no_places(
        self,
        mock_post,
    ):
        mock_response = Mock()
        mock_response.json.return_value = {
            "places": []
        }

        mock_post.return_value = mock_response

        result = self.service.search_nearby_landmarks(
            10.3157,
            123.8854,
        )

        self.assertEqual(
            result,
            []
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