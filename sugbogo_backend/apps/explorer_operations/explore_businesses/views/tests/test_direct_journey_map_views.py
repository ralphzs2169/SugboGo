from unittest.mock import patch

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.transit.services.direct_journey_map_service import (
    DirectJourneyMapService,
)
from apps.users.models import User


class DirectJourneyMapViewTests(TestCase):
    """Test the protected Explorer direct-journey map endpoint."""

    def setUp(self):
        """Create one authenticated Explorer and valid map query parameters."""

        self.client = APIClient()
        self.explorer = User.objects.create_user(
            email="journey-map-explorer@example.com",
            password="StrongPassword123!",
            USER_FNAME="Journey",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.client.force_authenticate(
            self.explorer,
        )
        self.url = "/api/explorer/explore/businesses/21/direct-journeys/map/"
        self.query_params = {
            "route_variant_id": 8,
            "boarding_transit_point_id": 2,
            "alighting_transit_point_id": 4,
        }

    @patch.object(
        DirectJourneyMapService,
        "get_map_guidance",
    )
    def test_returns_map_guidance_in_standard_envelope(
        self,
        mock_get_guidance,
    ):
        """Serialize the selected journey geometry through the API envelope."""

        mock_get_guidance.return_value = {
            "journey": {
                "jeepney_route_code": "14D",
                "route_variant": {
                    "id": 8,
                    "origin": {
                        "id": 1,
                        "name": "Kamputhaw",
                    },
                    "destination": {
                        "id": 4,
                        "name": "Colon",
                    },
                },
                "boarding_transit_point": {
                    "id": 2,
                    "name": "Capitol",
                    "latitude": 10.3173,
                    "longitude": 123.8908,
                    "sequence": 2,
                },
                "alighting_transit_point": {
                    "id": 4,
                    "name": "Colon",
                    "latitude": 10.2940,
                    "longitude": 123.9003,
                    "sequence": 4,
                },
                "ride": {
                    "approximate_distance_meters": 3500.0,
                    "full_variant_geometry": [
                        {
                            "latitude": 10.3200,
                            "longitude": 123.8800,
                        },
                        {
                            "latitude": 10.2940,
                            "longitude": 123.9003,
                        },
                    ],
                    "selected_segment_geometry": [
                        {
                            "latitude": 10.3173,
                            "longitude": 123.8908,
                        },
                        {
                            "latitude": 10.2940,
                            "longitude": 123.9003,
                        },
                    ],
                },
                "business_location": {
                    "latitude": 10.2935,
                    "longitude": 123.9010,
                },
                "landmark_context": None,
            },
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
            "Direct journey map guidance retrieved successfully.",
        )
        self.assertEqual(
            response.data["data"]["journey"]["jeepney_route_code"],
            "14D",
        )
        mock_get_guidance.assert_called_once_with(
            business_id=21,
            route_variant_id=8,
            boarding_transit_point_id=2,
            alighting_transit_point_id=4,
        )

    @patch.object(
        DirectJourneyMapService,
        "get_map_guidance",
    )
    def test_rejects_invalid_selected_journey_identifiers(
        self,
        mock_get_guidance,
    ):
        """Validate positive selected journey IDs before invoking the service."""

        response = self.client.get(
            self.url,
            {
                **self.query_params,
                "route_variant_id": 0,
            },
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            response.data["code"],
            "VALIDATION_ERROR",
        )
        mock_get_guidance.assert_not_called()

    def test_authentication_is_required(self):
        """Reject anonymous map-guidance requests."""

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
        """Apply the Explorer business-profile role boundary."""

        admin = User.objects.create_user(
            email="journey-map-admin@example.com",
            password="StrongPassword123!",
            USER_FNAME="Journey",
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
