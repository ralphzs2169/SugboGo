from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.test import SimpleTestCase
from rest_framework.exceptions import NotFound

from apps.business.models import Business
from apps.explorer_operations.explore_businesses.services.road_route_service import (
    RoadRouteService,
)
from apps.shared.services.google_routes_service import GoogleRoutesService


class RoadRouteServiceTests(SimpleTestCase):
    """Test business destination ownership and road-route assembly."""

    @patch.object(
        GoogleRoutesService,
        "compute_road_route",
    )
    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "road_route_service.Business.objects.select_related",
    )
    def test_uses_backend_owned_destination_and_adds_endpoints(
        self,
        mock_select_related,
        mock_compute_route,
    ):
        """Read destination coordinates from the active business location."""

        mock_select_related.return_value.get.return_value = SimpleNamespace(
            LOCT_ID=SimpleNamespace(
                LOCT_POINT=Point(
                    123.987,
                    10.789,
                    srid=4326,
                ),
            ),
        )
        mock_compute_route.return_value = {
            "distance_meters": 5800,
            "duration_seconds": 1080,
            "encoded_polyline": "encoded-road-route",
        }

        result = RoadRouteService.get_road_route(
            business_id=21,
            latitude=10.123,
            longitude=123.456,
        )

        mock_select_related.return_value.get.assert_called_once_with(
            BUSN_ID=21,
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
        )
        mock_compute_route.assert_called_once_with(
            origin_latitude=10.123,
            origin_longitude=123.456,
            destination_latitude=10.789,
            destination_longitude=123.987,
        )
        self.assertEqual(
            result["route"]["origin"],
            {
                "latitude": 10.123,
                "longitude": 123.456,
            },
        )
        self.assertEqual(
            result["route"]["destination"],
            {
                "latitude": 10.789,
                "longitude": 123.987,
            },
        )

    @patch.object(
        GoogleRoutesService,
        "compute_road_route",
        return_value=None,
    )
    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "road_route_service.Business.objects.select_related",
    )
    def test_no_available_google_route_returns_null(
        self,
        mock_select_related,
        _mock_compute_route,
    ):
        """Keep no-route as a successful service result."""

        mock_select_related.return_value.get.return_value = SimpleNamespace(
            LOCT_ID=SimpleNamespace(
                LOCT_POINT=Point(
                    123.987,
                    10.789,
                    srid=4326,
                ),
            ),
        )

        result = RoadRouteService.get_road_route(
            business_id=21,
            latitude=10.123,
            longitude=123.456,
        )

        self.assertEqual(
            result,
            {
                "route": None,
            },
        )

    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "road_route_service.Business.objects.select_related",
    )
    def test_missing_business_raises_controlled_not_found(
        self,
        mock_select_related,
    ):
        """Use the established active-business not-found behavior."""

        mock_select_related.return_value.get.side_effect = Business.DoesNotExist

        with self.assertRaisesMessage(
            NotFound,
            "The business could not be found.",
        ):
            RoadRouteService.get_road_route(
                business_id=999999,
                latitude=10.123,
                longitude=123.456,
            )

    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "road_route_service.Business.objects.select_related",
    )
    def test_missing_location_raises_controlled_not_found(
        self,
        mock_select_related,
    ):
        """Reject an active legacy business without a usable location."""

        mock_select_related.return_value.get.return_value = SimpleNamespace(
            LOCT_ID=None,
        )

        with self.assertRaisesMessage(
            NotFound,
            "The business location could not be found.",
        ):
            RoadRouteService.get_road_route(
                business_id=21,
                latitude=10.123,
                longitude=123.456,
            )
