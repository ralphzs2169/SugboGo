from unittest.mock import patch

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.transit.services.direct_journey_service import DirectJourneyService
from apps.users.models import User


class DirectJourneySearchViewTests(TestCase):
    """Test the protected Explorer-facing direct journey endpoint."""

    def setUp(self):
        """Create an authenticated Explorer and endpoint helpers."""

        self.client = APIClient()
        self.explorer = User.objects.create_user(
            email="direct-journey-explorer@example.com",
            password="StrongPassword123!",
            USER_FNAME="Direct",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.client.force_authenticate(
            self.explorer,
        )
        self.url = "/api/explorer/explore/businesses/21/direct-journeys/"
        self.query_params = {
            "latitude": "10.3000",
            "longitude": "123.8800",
        }

    @patch.object(
        DirectJourneyService,
        "search_direct_journeys",
    )
    def test_returns_structured_direct_journeys_in_standard_envelope(
        self,
        mock_search,
    ):
        """Serialize one direct option through the SugboGo success envelope."""

        mock_search.return_value = {
            "journeys": [
                {
                    "journey_type": "direct",
                    "jeepney_route_code": "14D",
                    "route_variant_id": 8,
                    "route_variant_origin": {
                        "id": 1,
                        "name": "Kamputhaw",
                    },
                    "route_variant_destination": {
                        "id": 4,
                        "name": "Colon",
                    },
                    "boarding_transit_point": {
                        "id": 2,
                        "name": "Capitol",
                        "latitude": 10.3173,
                        "longitude": 123.8908,
                    },
                    "boarding_sequence": 2,
                    "explorer_to_boarding_distance_meters": 120.5,
                    "alighting_transit_point": {
                        "id": 4,
                        "name": "Colon",
                        "latitude": 10.2940,
                        "longitude": 123.9003,
                    },
                    "alighting_sequence": 4,
                    "alighting_to_business_distance_meters": 180.25,
                    "total_access_egress_distance_meters": 300.75,
                    "approximate_ride_distance_meters": 3500.0,
                    "landmark_context": {
                        "id": 12,
                        "name": "Gaisano Capital South",
                        "distance_from_alighting_meters": 85.0,
                    },
                },
            ],
            "reason": None,
        }

        response = self.client.get(
            self.url,
            self.query_params,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertTrue(
            response.data["success"],
        )
        self.assertEqual(
            response.data["message"],
            "Direct jeepney journeys retrieved successfully.",
        )
        self.assertEqual(
            response.data["data"]["journeys"][0]["jeepney_route_code"],
            "14D",
        )
        self.assertIsNone(
            response.data["data"]["reason"],
        )
        self.assertEqual(
            response.data["data"]["journeys"][0]["landmark_context"],
            {
                "id": 12,
                "name": "Gaisano Capital South",
                "distance_from_alighting_meters": 85.0,
            },
        )
        mock_search.assert_called_once_with(
            business_id=21,
            latitude=10.3,
            longitude=123.88,
        )

    @patch.object(
        DirectJourneyService,
        "search_direct_journeys",
    )
    def test_no_route_is_a_successful_empty_result(
        self,
        mock_search,
    ):
        """Keep an ordinary no-route result at HTTP 200."""

        mock_search.return_value = {
            "journeys": [],
            "reason": "no_direct_route_match",
        }

        response = self.client.get(
            self.url,
            self.query_params,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            response.data["data"],
            {
                "journeys": [],
                "reason": "no_direct_route_match",
            },
        )

    @patch.object(
        DirectJourneyService,
        "search_direct_journeys",
    )
    def test_missing_landmark_context_is_a_successful_null_value(
        self,
        mock_search,
    ):
        """Serialize a valid journey without requiring landmark context."""

        mock_search.return_value = {
            "journeys": [
                {
                    "journey_type": "direct",
                    "jeepney_route_code": "14D",
                    "route_variant_id": 8,
                    "route_variant_origin": {
                        "id": 1,
                        "name": "Kamputhaw",
                    },
                    "route_variant_destination": {
                        "id": 4,
                        "name": "Colon",
                    },
                    "boarding_transit_point": {
                        "id": 2,
                        "name": "Capitol",
                        "latitude": 10.3173,
                        "longitude": 123.8908,
                    },
                    "boarding_sequence": 2,
                    "explorer_to_boarding_distance_meters": 120.5,
                    "alighting_transit_point": {
                        "id": 4,
                        "name": "Colon",
                        "latitude": 10.2940,
                        "longitude": 123.9003,
                    },
                    "alighting_sequence": 4,
                    "alighting_to_business_distance_meters": 180.25,
                    "total_access_egress_distance_meters": 300.75,
                    "approximate_ride_distance_meters": 3500.0,
                    "landmark_context": None,
                },
            ],
            "reason": None,
        }

        response = self.client.get(
            self.url,
            self.query_params,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertIsNone(
            response.data["data"]["journeys"][0]["landmark_context"],
        )

    @patch.object(
        DirectJourneyService,
        "search_direct_journeys",
    )
    def test_malformed_coordinates_use_serializer_validation(
        self,
        mock_search,
    ):
        """Reject out-of-range coordinates before invoking routing."""

        response = self.client.get(
            self.url,
            {
                "latitude": "91",
                "longitude": "not-a-number",
            },
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertFalse(
            response.data["success"],
        )
        self.assertEqual(
            response.data["code"],
            "VALIDATION_ERROR",
        )
        mock_search.assert_not_called()

    def test_missing_destination_business_uses_controlled_not_found(self):
        """Return the established business not-found envelope."""

        response = self.client.get(
            "/api/explorer/explore/businesses/999999/direct-journeys/",
            self.query_params,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            response.data,
            {
                "success": False,
                "message": "The business could not be found.",
                "code": "NOT_FOUND",
            },
        )

    def test_authentication_is_required(self):
        """Reject anonymous direct journey searches."""

        self.client.force_authenticate(
            user=None,
        )

        response = self.client.get(
            self.url,
            self.query_params,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_unrelated_admin_role_is_forbidden(self):
        """Apply the same Explorer business-profile role boundary."""

        admin = User.objects.create_user(
            email="direct-journey-admin@example.com",
            password="StrongPassword123!",
            USER_FNAME="Direct",
            USER_LNAME="Admin",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.client.force_authenticate(
            admin,
        )

        response = self.client.get(
            self.url,
            self.query_params,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )
