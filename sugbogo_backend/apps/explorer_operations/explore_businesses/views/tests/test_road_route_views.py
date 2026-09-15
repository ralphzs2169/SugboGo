from unittest.mock import patch

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.explorer_operations.explore_businesses.services.road_route_service import (
    RoadRouteService,
)
from apps.shared.services.google_routes_service import RoadRouteServiceUnavailable
from apps.users.models import User


class RoadRouteViewTests(TestCase):
    """Test the protected Explorer-facing road-route endpoint."""

    def setUp(self):
        """Create an authenticated Explorer and endpoint inputs."""

        self.client = APIClient()
        self.explorer = User.objects.create_user(
            email="road-route-explorer@example.com",
            password="StrongPassword123!",
            USER_FNAME="Road",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.client.force_authenticate(
            self.explorer,
        )
        self.url = "/api/explorer/explore/businesses/21/road-route/"
        self.query_params = {
            "latitude": "10.123",
            "longitude": "123.456",
        }

    @patch.object(
        RoadRouteService,
        "get_road_route",
    )
    def test_returns_normalized_route_in_standard_envelope(
        self,
        mock_get_route,
    ):
        """Serialize route summary, polyline, and authoritative endpoints."""

        mock_get_route.return_value = {
            "route": {
                "distance_meters": 5800,
                "duration_seconds": 1080,
                "encoded_polyline": "encoded-road-route",
                "origin": {
                    "latitude": 10.123,
                    "longitude": 123.456,
                },
                "destination": {
                    "latitude": 10.789,
                    "longitude": 123.987,
                },
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
        self.assertEqual(
            response.data["data"],
            mock_get_route.return_value,
        )
        mock_get_route.assert_called_once_with(
            business_id=21,
            latitude=10.123,
            longitude=123.456,
        )

    @patch.object(
        RoadRouteService,
        "get_road_route",
        return_value={
            "route": None,
        },
    )
    def test_no_route_is_a_successful_null_result(
        self,
        _mock_get_route,
    ):
        """Keep an unavailable road route at HTTP 200."""

        response = self.client.get(
            self.url,
            self.query_params,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertIsNone(
            response.data["data"]["route"],
        )

    @patch.object(
        RoadRouteService,
        "get_road_route",
    )
    def test_rejects_malformed_coordinates_before_service_call(
        self,
        mock_get_route,
    ):
        """Use serializer validation for missing and out-of-range coordinates."""

        response = self.client.get(
            self.url,
            {
                "latitude": "91",
                "longitude": "invalid",
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
        mock_get_route.assert_not_called()

    def test_missing_destination_business_uses_controlled_not_found(self):
        """Return the established business not-found envelope."""

        response = self.client.get(
            "/api/explorer/explore/businesses/999999/road-route/",
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

    @patch.object(
        RoadRouteService,
        "get_road_route",
        side_effect=RoadRouteServiceUnavailable(),
    )
    def test_upstream_failure_uses_controlled_error_envelope(
        self,
        _mock_get_route,
    ):
        """Return a generic gateway failure without exposing Google details."""

        response = self.client.get(
            self.url,
            self.query_params,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_502_BAD_GATEWAY,
        )
        self.assertEqual(
            response.data,
            {
                "success": False,
                "message": "Road route guidance is temporarily unavailable.",
                "code": "ROAD_ROUTE_SERVICE_UNAVAILABLE",
            },
        )

    def test_authentication_is_required(self):
        """Reject anonymous road-route requests."""

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
        """Apply the same business-profile role boundary as direct journeys."""

        admin = User.objects.create_user(
            email="road-route-admin@example.com",
            password="StrongPassword123!",
            USER_FNAME="Road",
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
