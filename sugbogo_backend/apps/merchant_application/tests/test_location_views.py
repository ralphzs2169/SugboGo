from unittest.mock import patch

from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin
from django.urls import reverse
from requests import RequestException
from rest_framework import status
from rest_framework.test import APITestCase


class GoogleMapsViewTests(APIResponseAssertionsMixin, APITestCase):
    """Tests for Google Maps location-related API views."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="john@example.com",
            password="StrongPassword123!",
            USER_FNAME="John",
            USER_LNAME="Doe",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.client.force_authenticate(user=self.user)

        self.reverse_geocode_url = reverse("reverse-geocode")
        self.place_search_url = reverse("place-search")
        self.place_details_url = reverse("place-details")
        self.nearby_landmarks_url = reverse("nearby-landmarks")

        self.coordinates = {
            "latitude": 10.3157,
            "longitude": 123.8854,
        }

    # Reverse Geocode

    @patch(
        "apps.merchant_application.views.location_views.GoogleMapsService.reverse_geocode"
    )
    def test_reverse_geocode_successfully_returns_address(
        self,
        mock_reverse_geocode,
    ):
        address = {
            "formattedAddress": "Cebu City, Cebu, Philippines",
            "province": "Cebu",
            "city": "Cebu City",
            "barangay": "Lahug",
            "streetAddress": "Gorordo Avenue",
        }

        mock_reverse_geocode.return_value = address

        response = self.client.post(
            self.reverse_geocode_url,
            self.coordinates,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertTrue(response.data["success"])

        self.assertEqual(
            response.data["message"],
            "Location resolved successfully.",
        )

        self.assertEqual(
            response.data["data"],
            {"address": address},
        )

        mock_reverse_geocode.assert_called_once_with(
            10.3157,
            123.8854,
        )

    @patch(
        "apps.merchant_application.views.location_views.GoogleMapsService.reverse_geocode",
        side_effect=RequestException("Google API unavailable"),
    )
    def test_reverse_geocode_returns_service_unavailable(
        self,
        mock_reverse_geocode,
    ):
        response = self.client.post(
            self.reverse_geocode_url,
            self.coordinates,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_502_BAD_GATEWAY,
        )

        self.assertFalse(response.data["success"])

        self.assertEqual(
            response.data["message"],
            "Unable to connect to the location service.",
        )

        self.assertEqual(
            response.data["code"],
            "LOCATION_SERVICE_UNAVAILABLE",
        )

        mock_reverse_geocode.assert_called_once_with(
            10.3157,
            123.8854,
        )

    @patch(
        "apps.merchant_application.views.location_views.GoogleMapsService.reverse_geocode",
        side_effect=ValueError("Unable to determine the location."),
    )
    def test_reverse_geocode_returns_geocoding_error(
        self,
        mock_reverse_geocode,
    ):
        response = self.client.post(
            self.reverse_geocode_url,
            self.coordinates,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_502_BAD_GATEWAY,
        )

        self.assertFalse(response.data["success"])

        self.assertEqual(
            response.data["message"],
            "Unable to determine the location.",
        )

        self.assertEqual(
            response.data["code"],
            "GEOCODING_FAILED",
        )

        mock_reverse_geocode.assert_called_once_with(
            10.3157,
            123.8854,
        )

    # Place Search

    @patch(
        "apps.merchant_application.views.location_views.GoogleMapsService.search_places"
    )
    def test_place_search_successfully_returns_suggestions(
        self,
        mock_search_places,
    ):
        suggestions = [
            {
                "placeId": "ChIJ123",
                "mainText": "Ayala Center Cebu",
                "secondaryText": "Cebu City, Cebu",
            },
            {
                "placeId": "ChIJ456",
                "mainText": "SM City Cebu",
                "secondaryText": "Cebu City, Cebu",
            },
        ]

        mock_search_places.return_value = suggestions

        response = self.client.post(
            self.place_search_url,
            {"input": "Ayala Cebu"},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertTrue(response.data["success"])

        self.assertEqual(
            response.data["message"],
            "Places retrieved successfully.",
        )

        self.assertEqual(
            response.data["data"],
            {"suggestions": suggestions},
        )

        mock_search_places.assert_called_once_with(
            "Ayala Cebu",
        )

    @patch(
        "apps.merchant_application.views.location_views.GoogleMapsService.search_places",
        side_effect=RequestException("Google API unavailable"),
    )
    def test_place_search_returns_service_unavailable(
        self,
        mock_search_places,
    ):
        response = self.client.post(
            self.place_search_url,
            {"input": "Ayala Cebu"},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_502_BAD_GATEWAY,
        )

        self.assertFalse(response.data["success"])

        self.assertEqual(
            response.data["message"],
            "Unable to connect to the location service.",
        )

        self.assertEqual(
            response.data["code"],
            "LOCATION_SERVICE_UNAVAILABLE",
        )

        mock_search_places.assert_called_once_with(
            "Ayala Cebu",
        )

    @patch(
        "apps.merchant_application.views.location_views.GoogleMapsService.search_places",
        side_effect=ValueError("Invalid place search."),
    )
    def test_place_search_returns_search_error(
        self,
        mock_search_places,
    ):
        response = self.client.post(
            self.place_search_url,
            {"input": "Ayala Cebu"},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_502_BAD_GATEWAY,
        )

        self.assertFalse(response.data["success"])

        self.assertEqual(
            response.data["message"],
            "Invalid place search.",
        )

        self.assertEqual(
            response.data["code"],
            "PLACE_SEARCH_FAILED",
        )

        mock_search_places.assert_called_once_with(
            "Ayala Cebu",
        )

    # Place Details

    @patch(
        "apps.merchant_application.views.location_views.GoogleMapsService.get_place_details"
    )
    def test_place_details_successfully_returns_location(
        self,
        mock_get_place_details,
    ):
        location = {
            "latitude": 10.3160,
            "longitude": 123.9050,
            "formattedAddress": "Ayala Center Cebu, Cebu City",
            "province": "Cebu",
            "city": "Cebu City",
            "barangay": "Lahug",
            "streetAddress": "Cebu Business Park",
        }

        mock_get_place_details.return_value = location

        response = self.client.post(
            self.place_details_url,
            {"place_id": "ChIJ123"},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertTrue(response.data["success"])

        self.assertEqual(
            response.data["message"],
            "Place details retrieved successfully.",
        )

        self.assertEqual(
            response.data["data"],
            {"location": location},
        )

        mock_get_place_details.assert_called_once_with(
            "ChIJ123",
        )

    @patch(
        "apps.merchant_application.views.location_views.GoogleMapsService.get_place_details",
        side_effect=RequestException("Google API unavailable"),
    )
    def test_place_details_returns_service_unavailable(
        self,
        mock_get_place_details,
    ):
        response = self.client.post(
            self.place_details_url,
            {"place_id": "ChIJ123"},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_502_BAD_GATEWAY,
        )

        self.assertFalse(response.data["success"])

        self.assertEqual(
            response.data["message"],
            "Unable to connect to the location service.",
        )

        self.assertEqual(
            response.data["code"],
            "LOCATION_SERVICE_UNAVAILABLE",
        )

        mock_get_place_details.assert_called_once_with(
            "ChIJ123",
        )

    @patch(
        "apps.merchant_application.views.location_views.GoogleMapsService.get_place_details",
        side_effect=ValueError("Place details unavailable."),
    )
    def test_place_details_returns_details_error(
        self,
        mock_get_place_details,
    ):
        response = self.client.post(
            self.place_details_url,
            {"place_id": "ChIJ123"},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_502_BAD_GATEWAY,
        )

        self.assertFalse(response.data["success"])

        self.assertEqual(
            response.data["message"],
            "Place details unavailable.",
        )

        self.assertEqual(
            response.data["code"],
            "PLACE_DETAILS_FAILED",
        )

        mock_get_place_details.assert_called_once_with(
            "ChIJ123",
        )

    # Nearby Landmarks

    @patch(
        "apps.merchant_application.views.location_views.GoogleMapsService.search_nearby_landmarks"
    )
    def test_nearby_landmarks_successfully_returns_landmarks(
        self,
        mock_search_nearby_landmarks,
    ):
        landmarks = [
            {
                "placeId": "ChIJ123",
                "name": "Ayala Center Cebu",
                "address": "Cebu Business Park, Cebu City",
                "latitude": 10.3170,
                "longitude": 123.9050,
            },
            {
                "placeId": "ChIJ456",
                "name": "Cebu IT Park",
                "address": "Lahug, Cebu City",
                "latitude": 10.3300,
                "longitude": 123.9060,
            },
        ]

        mock_search_nearby_landmarks.return_value = landmarks

        response = self.client.post(
            self.nearby_landmarks_url,
            self.coordinates,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertTrue(response.data["success"])

        self.assertEqual(
            response.data["message"],
            "Nearby landmarks retrieved successfully.",
        )

        self.assertEqual(
            response.data["data"],
            {"landmarks": landmarks},
        )

        mock_search_nearby_landmarks.assert_called_once_with(
            10.3157,
            123.8854,
        )

    @patch(
        "apps.merchant_application.views.location_views.GoogleMapsService.search_nearby_landmarks",
        side_effect=RequestException("Google API unavailable"),
    )
    def test_nearby_landmarks_returns_service_unavailable(
        self,
        mock_search_nearby_landmarks,
    ):
        response = self.client.post(
            self.nearby_landmarks_url,
            self.coordinates,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_502_BAD_GATEWAY,
        )

        self.assertFalse(response.data["success"])

        self.assertEqual(
            response.data["message"],
            "Unable to connect to the location service.",
        )

        self.assertEqual(
            response.data["code"],
            "LOCATION_SERVICE_UNAVAILABLE",
        )

        mock_search_nearby_landmarks.assert_called_once_with(
            10.3157,
            123.8854,
        )

    @patch(
        "apps.merchant_application.views.location_views.GoogleMapsService.search_nearby_landmarks",
        side_effect=ValueError("Unable to find nearby landmarks."),
    )
    def test_nearby_landmarks_returns_landmark_error(
        self,
        mock_search_nearby_landmarks,
    ):
        response = self.client.post(
            self.nearby_landmarks_url,
            self.coordinates,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_502_BAD_GATEWAY,
        )

        self.assertFalse(response.data["success"])

        self.assertEqual(
            response.data["message"],
            "Unable to find nearby landmarks.",
        )

        self.assertEqual(
            response.data["code"],
            "LANDMARK_SEARCH_FAILED",
        )

        mock_search_nearby_landmarks.assert_called_once_with(
            10.3157,
            123.8854,
        )