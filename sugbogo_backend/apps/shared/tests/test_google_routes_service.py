from unittest.mock import Mock, patch

import requests
from django.test import SimpleTestCase, override_settings

from apps.shared.services.google_routes_service import (
    GoogleRoutesService,
    RoadRouteServiceUnavailable,
)


@override_settings(
    GOOGLE_MAPS_API_KEY="test-google-routes-key",
)
class GoogleRoutesServiceTests(SimpleTestCase):
    """Test the narrow Google Routes request and normalized response."""

    @patch("apps.shared.services.google_routes_service.requests.post")
    def test_requests_and_normalizes_one_driving_route(
        self,
        mock_post,
    ):
        """Send the required route options and return frontend-safe fields."""

        response = Mock()
        response.json.return_value = {
            "routes": [
                {
                    "distanceMeters": 5800,
                    "duration": "1080.4s",
                    "polyline": {
                        "encodedPolyline": "encoded-road-route",
                    },
                },
            ],
        }
        mock_post.return_value = response

        result = GoogleRoutesService.compute_road_route(
            origin_latitude=10.123,
            origin_longitude=123.456,
            destination_latitude=10.789,
            destination_longitude=123.987,
        )

        self.assertEqual(
            result,
            {
                "distance_meters": 5800,
                "duration_seconds": 1080,
                "encoded_polyline": "encoded-road-route",
            },
        )
        mock_post.assert_called_once_with(
            GoogleRoutesService.COMPUTE_ROUTES_URL,
            json={
                "origin": {
                    "location": {
                        "latLng": {
                            "latitude": 10.123,
                            "longitude": 123.456,
                        },
                    },
                },
                "destination": {
                    "location": {
                        "latLng": {
                            "latitude": 10.789,
                            "longitude": 123.987,
                        },
                    },
                },
                "travelMode": "DRIVE",
                "routingPreference": "TRAFFIC_UNAWARE",
                "computeAlternativeRoutes": False,
                "units": "METRIC",
            },
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": "test-google-routes-key",
                "X-Goog-FieldMask": (
                    "routes.distanceMeters,"
                    "routes.duration,"
                    "routes.polyline.encodedPolyline"
                ),
            },
            timeout=10,
        )
        response.raise_for_status.assert_called_once_with()

    @patch("apps.shared.services.google_routes_service.requests.post")
    def test_empty_routes_is_a_normal_no_route_result(
        self,
        mock_post,
    ):
        """Return null instead of treating Google's empty route list as failure."""

        response = Mock()
        response.json.return_value = {}
        mock_post.return_value = response

        result = GoogleRoutesService.compute_road_route(
            origin_latitude=10.123,
            origin_longitude=123.456,
            destination_latitude=10.789,
            destination_longitude=123.987,
        )

        self.assertIsNone(result)

    @patch("apps.shared.services.google_routes_service.requests.post")
    def test_network_and_upstream_failures_are_safely_normalized(
        self,
        mock_post,
    ):
        """Hide timeout, connection, and unsuccessful HTTP response details."""

        failures = (
            requests.Timeout("timed out"),
            requests.ConnectionError("connection reset"),
            requests.HTTPError("bad gateway"),
        )

        for failure in failures:
            with self.subTest(failure=type(failure).__name__):
                mock_post.side_effect = failure

                with self.assertRaises(RoadRouteServiceUnavailable):
                    GoogleRoutesService.compute_road_route(
                        origin_latitude=10.123,
                        origin_longitude=123.456,
                        destination_latitude=10.789,
                        destination_longitude=123.987,
                    )

    @patch("apps.shared.services.google_routes_service.requests.post")
    def test_malformed_upstream_response_is_safely_normalized(
        self,
        mock_post,
    ):
        """Reject incomplete route data without exposing its raw shape."""

        response = Mock()
        response.json.return_value = {
            "routes": [
                {
                    "distanceMeters": 5800,
                    "duration": "invalid",
                    "polyline": {},
                },
            ],
        }
        mock_post.return_value = response

        with self.assertRaises(RoadRouteServiceUnavailable):
            GoogleRoutesService.compute_road_route(
                origin_latitude=10.123,
                origin_longitude=123.456,
                destination_latitude=10.789,
                destination_longitude=123.987,
            )
