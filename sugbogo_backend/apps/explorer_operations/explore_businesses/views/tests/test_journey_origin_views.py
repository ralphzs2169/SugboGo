from unittest.mock import patch

from django.contrib.gis.geos import MultiPolygon, Polygon
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.business.models import ServiceableBoundary
from apps.users.models import User


class JourneyOriginViewTests(APITestCase):
    """Tests Explorer journey-origin place and geocoding endpoints."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="journey-origin@example.com",
            password="StrongPassword123!",
            USER_FNAME="Journey",
            USER_LNAME="Origin",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.client.force_authenticate(
            user=self.user,
        )
        self.place_search_url = reverse("journey-origin-place-search")
        self.place_details_url = reverse("journey-origin-place-details")
        self.reverse_geocode_url = reverse("journey-origin-reverse-geocode")
        ServiceableBoundary.objects.create(
            SBND_NAME="Cebu City Business Boundary",
            SBND_IS_ACTIVE=True,
            SBND_BOUNDARY=MultiPolygon(
                Polygon(
                    (
                        (123.87, 10.28),
                        (123.93, 10.28),
                        (123.93, 10.34),
                        (123.87, 10.34),
                        (123.87, 10.28),
                    ),
                    srid=4326,
                ),
            ),
        )

    @patch(
        "apps.business.services.serviceable_boundary_service."
        "ServiceableBoundaryService.get_autocomplete_location_restriction"
    )
    @patch(
        "apps.explorer_operations.explore_businesses.views."
        "journey_origin_views.GoogleMapsService.search_places"
    )
    def test_search_uses_metro_cebu_scope_instead_of_business_boundary(
        self,
        mock_search_places,
        mock_get_business_restriction,
    ):
        restriction = {
            "rectangle": {
                "low": {
                    "latitude": 10.20,
                    "longitude": 123.75,
                },
                "high": {
                    "latitude": 10.50,
                    "longitude": 124.05,
                },
            },
        }
        mock_search_places.return_value = []

        response = self.client.post(
            self.place_search_url,
            {
                "input": "Mandaue",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        mock_search_places.assert_called_once_with(
            "Mandaue",
            restriction,
        )
        mock_get_business_restriction.assert_not_called()

    @patch(
        "apps.explorer_operations.explore_businesses.views."
        "journey_origin_views.GoogleMapsService.get_place_details"
    )
    def test_mandaue_place_is_not_rejected_by_business_boundary(
        self,
        mock_get_place_details,
    ):
        location = {
            "latitude": 10.34,
            "longitude": 123.95,
            "formattedAddress": "Mandaue City, Cebu",
            "province": "Cebu",
            "city": "Mandaue City",
            "barangay": "",
            "streetAddress": "",
        }
        mock_get_place_details.return_value = location

        response = self.client.post(
            self.place_details_url,
            {
                "place_id": "ChIJMandaue",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            response.data["data"]["location"],
            location,
        )

    @patch(
        "apps.explorer_operations.explore_businesses.views."
        "journey_origin_views.GoogleMapsService.reverse_geocode"
    )
    def test_cebu_city_origin_is_accepted(
        self,
        mock_reverse_geocode,
    ):
        address = {
            "formattedAddress": "Cebu City, Cebu",
            "province": "Cebu",
            "city": "Cebu City",
            "barangay": "",
            "streetAddress": "",
        }
        mock_reverse_geocode.return_value = address

        response = self.client.post(
            self.reverse_geocode_url,
            {
                "latitude": 10.31,
                "longitude": 123.89,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            response.data["data"]["address"],
            address,
        )

    @patch(
        "apps.explorer_operations.explore_businesses.views."
        "journey_origin_views.GoogleMapsService.reverse_geocode"
    )
    def test_lapu_lapu_map_point_is_not_rejected_by_business_boundary(
        self,
        mock_reverse_geocode,
    ):
        mock_reverse_geocode.return_value = {
            "formattedAddress": "Lapu-Lapu City, Cebu",
            "province": "Cebu",
            "city": "Lapu-Lapu City",
            "barangay": "",
            "streetAddress": "",
        }

        response = self.client.post(
            self.reverse_geocode_url,
            {
                "latitude": 10.31,
                "longitude": 123.97,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertTrue(response.data["success"])
