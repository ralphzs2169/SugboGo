import json
from unittest.mock import patch

import requests
from django.test import SimpleTestCase, override_settings

from apps.shared.services.google_maps_service import GoogleMapsService
from apps.shared.services.google_routes_service import GoogleRoutesService, GoogleWalkingStatus


def _response(
    payload,
    status=200,
):
    response = requests.Response()
    response.status_code = status
    response._content = json.dumps(payload).encode()
    return response


@override_settings(GOOGLE_MAPS_API_KEY="test-pedestrian-key")
class GoogleWalkingServiceTests(SimpleTestCase):
    def _walk(self, **overrides):
        coordinates = {
            "origin_latitude": 10.310,
            "origin_longitude": 123.900,
            "destination_latitude": 10.312,
            "destination_longitude": 123.901,
        }
        coordinates.update(overrides)
        return GoogleRoutesService.compute_walking_route(**coordinates)

    def _route(self):
        return {
            "routes": [{
                "distanceMeters": 280,
                "duration": "220.4s",
                "polyline": {"encodedPolyline": "encoded-walk"},
                "legs": [{
                    "startLocation": {"latLng": {"latitude": 10.310, "longitude": 123.900}},
                    "endLocation": {"latLng": {"latitude": 10.312, "longitude": 123.901}},
                }],
                "warnings": ["Provider walking warning"],
            }],
        }

    @patch("apps.shared.services.google_routes_service.requests.post")
    def test_walk_returns_distance_duration_geometry_endpoints_and_warnings(self, post):
        post.return_value = _response(self._route())

        result = self._walk()

        self.assertEqual(result.status, GoogleWalkingStatus.AVAILABLE)
        self.assertEqual(result.route.distance_meters, 280)
        self.assertEqual(result.route.duration_seconds, 220)
        self.assertEqual(result.route.encoded_polyline, "encoded-walk")
        self.assertEqual(result.route.start_location, (10.310, 123.900))
        self.assertEqual(result.route.end_location, (10.312, 123.901))
        self.assertEqual(result.route.warnings, ("Provider walking warning",))
        _, kwargs = post.call_args
        self.assertEqual(kwargs["json"]["travelMode"], "WALK")
        self.assertNotIn("routingPreference", kwargs["json"])
        self.assertEqual(kwargs["timeout"], 5)
        self.assertFalse(kwargs["allow_redirects"])
        self.assertIn("routes.legs.endLocation.latLng", kwargs["headers"]["X-Goog-FieldMask"])

    @patch("apps.shared.services.google_routes_service.requests.post")
    def test_walk_distinguishes_no_route_timeout_quota_and_provider_errors(self, post):
        for response, expected in (
            (_response({}), GoogleWalkingStatus.NO_ROUTE),
            (_response({"routes": []}), GoogleWalkingStatus.NO_ROUTE),
            (_response({"error": {"status": "RESOURCE_EXHAUSTED"}}, 429), GoogleWalkingStatus.QUOTA_OR_BILLING),
            (
                _response({"error": {"details": [{"reason": "BILLING_DISABLED"}]}}, 403),
                GoogleWalkingStatus.QUOTA_OR_BILLING,
            ),
            (_response({"error": {"status": "PERMISSION_DENIED"}}, 403), GoogleWalkingStatus.PROVIDER_ERROR),
            (_response({}, 504), GoogleWalkingStatus.TIMEOUT),
            (_response({"routes": [{"distanceMeters": 20}]}), GoogleWalkingStatus.PROVIDER_ERROR),
        ):
            with self.subTest(expected=expected):
                post.return_value = response
                result = self._walk()
                self.assertEqual(result.status, expected)
                self.assertIsNone(result.route)
        post.side_effect = requests.Timeout("internal provider message")
        self.assertEqual(self._walk().status, GoogleWalkingStatus.TIMEOUT)
        post.side_effect = requests.ConnectionError("internal provider message")
        self.assertEqual(self._walk().status, GoogleWalkingStatus.PROVIDER_ERROR)

    @patch("apps.shared.services.google_routes_service.requests.post")
    def test_invalid_coordinates_are_rejected_before_calling_google(self, post):
        for field, value in (
            ("origin_latitude", float("nan")),
            ("destination_longitude", 181),
            ("origin_longitude", False),
        ):
            with self.subTest(field=field):
                self.assertEqual(
                    self._walk(**{field: value}).status,
                    GoogleWalkingStatus.INVALID_COORDINATES,
                )
        post.assert_not_called()

    @patch("apps.shared.services.google_routes_service.requests.post")
    def test_unsuitable_start_or_end_is_retained_for_internal_diagnosis(self, post):
        for endpoint in ("startLocation", "endLocation"):
            for displaced in (False, True):
                with self.subTest(endpoint=endpoint, displaced=displaced):
                    payload = self._route()
                    leg = payload["routes"][0]["legs"][0]
                    if displaced:
                        leg[endpoint]["latLng"]["latitude"] = 10.323
                    else:
                        leg[endpoint]["latLng"]["latitude"] = 100
                    post.return_value = _response(payload)

                    result = self._walk()

                    self.assertEqual(result.status, GoogleWalkingStatus.UNSUITABLE_ENDPOINTS)
                    self.assertEqual(result.route.distance_meters, 280)
                    self.assertEqual(
                        result.diagnostic_code,
                        "displaced_provider_endpoint" if displaced else "missing_provider_endpoint",
                    )

    @patch("apps.shared.services.google_routes_service.requests.post")
    def test_collapsing_distinct_requested_points_to_one_snap_is_unsuitable(self, post):
        payload = self._route()
        leg = payload["routes"][0]["legs"][0]
        leg["endLocation"] = leg["startLocation"]
        post.return_value = _response(payload)

        result = self._walk(destination_latitude=10.310, destination_longitude=123.9001)

        self.assertEqual(result.status, GoogleWalkingStatus.UNSUITABLE_ENDPOINTS)
        self.assertEqual(result.diagnostic_code, "collapsed_provider_path")

    @patch("apps.shared.services.google_routes_service.requests.post")
    def test_default_zero_walk_requires_coincident_requests_and_provider_endpoints(self, post):
        payload = self._route()
        route = payload["routes"][0]
        for field in ("distanceMeters", "duration", "polyline"):
            del route[field]
        leg = route["legs"][0]
        leg["endLocation"] = leg["startLocation"]
        post.return_value = _response(payload)

        result = self._walk(destination_latitude=10.310, destination_longitude=123.900)
        self.assertEqual(result.status, GoogleWalkingStatus.AVAILABLE)
        self.assertEqual(result.route.distance_meters, 0)
        self.assertEqual(result.route.duration_seconds, 0)
        self.assertIsNone(result.route.encoded_polyline)

        result = self._walk()
        self.assertEqual(result.status, GoogleWalkingStatus.UNSUITABLE_ENDPOINTS)
        self.assertEqual(result.diagnostic_code, "collapsed_provider_path")

    @patch("apps.shared.services.google_routes_service.requests.post")
    def test_provider_failure_diagnostics_exclude_provider_messages(self, post):
        post.return_value = _response({"error": {"message": "private provider details"}}, 403)
        self.assertEqual(self._walk().diagnostic_code, "provider_http_error")

        post.side_effect = requests.ConnectionError("private transport details")
        self.assertEqual(self._walk().diagnostic_code, "request_failed")

        with override_settings(GOOGLE_MAPS_API_KEY=""):
            post.reset_mock()
            self.assertEqual(self._walk().diagnostic_code, "missing_api_key")
            post.assert_not_called()


@override_settings(GOOGLE_MAPS_API_KEY="test-pedestrian-key")
class GoogleTransitLandmarkTests(SimpleTestCase):
    @patch("apps.shared.services.google_maps_service.requests.post")
    def test_uses_recognizable_nearby_places_and_retains_provider_attribution(self, post):
        post.return_value = _response({
            "places": [
                {
                    "id": "closed",
                    "displayName": {"text": "Closed Station"},
                    "location": {"latitude": 10.310, "longitude": 123.900},
                    "primaryType": "bus_station",
                    "businessStatus": "CLOSED_PERMANENTLY",
                },
                {
                    "id": "office",
                    "displayName": {"text": "Unnamed Office Block"},
                    "location": {"latitude": 10.310, "longitude": 123.900},
                    "primaryType": "corporate_office",
                },
                {
                    "id": "hospital",
                    "displayName": {"text": "Community Hospital"},
                    "location": {"latitude": 10.31015, "longitude": 123.900},
                    "formattedAddress": "Main road",
                    "primaryType": "hospital",
                    "attributions": [{"provider": "Local provider", "providerUri": "https://example.com"}],
                },
                {
                    "id": "shop",
                    "displayName": {"text": "Corner Store"},
                    "location": {"latitude": 10.31001, "longitude": 123.900},
                    "primaryType": "convenience_store",
                },
            ],
        })

        landmark = GoogleMapsService.search_transit_landmark(10.310, 123.900)

        self.assertEqual(landmark.place_id, "hospital")
        self.assertEqual(landmark.name, "Community Hospital")
        self.assertEqual(landmark.latitude, 10.31015)
        self.assertEqual(landmark.address, "Main road")
        self.assertEqual(landmark.attributions, (("Local provider", "https://example.com"),))
        _, kwargs = post.call_args
        self.assertEqual(kwargs["json"]["rankPreference"], "POPULARITY")
        self.assertIn("hospital", kwargs["json"]["includedPrimaryTypes"])
        self.assertIn("places.attributions", kwargs["headers"]["X-Goog-FieldMask"])
        self.assertEqual(kwargs["timeout"], 5)

    @patch("apps.shared.services.google_maps_service.requests.post")
    def test_no_suitable_landmark_is_a_normal_result(self, post):
        post.return_value = _response({
            "places": [{
                "id": "far",
                "displayName": {"text": "Distant Hospital"},
                "location": {"latitude": 10.320, "longitude": 123.900},
                "primaryType": "hospital",
            }],
        })

        self.assertIsNone(GoogleMapsService.search_transit_landmark(10.310, 123.900))
