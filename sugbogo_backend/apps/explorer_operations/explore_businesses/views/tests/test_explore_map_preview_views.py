from types import SimpleNamespace
from unittest.mock import patch

from apps.explorer_operations.explore_businesses.views.explore_map_preview_views import (
    ExploreMapPreviewView,
)
from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIRequestFactory


class ExploreMapPreviewViewTests(SimpleTestCase):
    """Tests the nearby business endpoint used by the Explore map preview."""

    def setUp(self):
        self.factory = APIRequestFactory()

    def make_request(self, query_params):
        request = self.factory.get(
            "/explorer/explore/map-preview/",
            query_params,
        )

        view = ExploreMapPreviewView()

        return view, view.initialize_request(request)

    def make_business(
        self,
        business_id,
        latitude,
        longitude,
        cluster_icon="store",
    ):
        return SimpleNamespace(
            BUSN_ID=business_id,
            CTGRY_ID=SimpleNamespace(
                CLUS_ID=SimpleNamespace(
                    CLUS_ICON=cluster_icon,
                ),
            ),
            LOCT_ID=SimpleNamespace(
                LOCT_POINT=SimpleNamespace(
                    y=latitude,
                    x=longitude,
                ),
            ),
        )

    @patch(
        "apps.explorer_operations.explore_businesses.views."
        "explore_map_preview_views."
        "ExploreMapPreviewService.list_nearby_preview_businesses",
    )
    def test_returns_serialized_nearby_businesses(
        self,
        mock_list_nearby_businesses,
    ):
        mock_list_nearby_businesses.return_value = [
            self.make_business(
                business_id=1,
                latitude=10.3157,
                longitude=123.8854,
                cluster_icon="silverware-fork-knife",
            ),
            self.make_business(
                business_id=2,
                latitude=10.317,
                longitude=123.887,
                cluster_icon="palette",
            ),
        ]

        view, request = self.make_request(
            {
                "latitude": "10.3157",
                "longitude": "123.8854",
            },
        )

        response = view.get(request)

        self.assertEqual(
            response.status_code,
            200,
        )

        self.assertTrue(
            response.data["success"],
        )

        self.assertEqual(
            response.data["message"],
            "Nearby map businesses retrieved successfully.",
        )

        self.assertEqual(
            response.data["data"],
            [
                {
                    "id": 1,
                    "cluster_icon": "silverware-fork-knife",
                    "latitude": 10.3157,
                    "longitude": 123.8854,
                },
                {
                    "id": 2,
                    "cluster_icon": "palette",
                    "latitude": 10.317,
                    "longitude": 123.887,
                },
            ],
        )

        mock_list_nearby_businesses.assert_called_once_with(
            latitude=10.3157,
            longitude=123.8854,
        )

    @patch(
        "apps.explorer_operations.explore_businesses.views."
        "explore_map_preview_views."
        "ExploreMapPreviewService.list_nearby_preview_businesses",
    )
    def test_returns_successful_empty_list_when_no_nearby_businesses_exist(
        self,
        mock_list_nearby_businesses,
    ):
        mock_list_nearby_businesses.return_value = []

        view, request = self.make_request(
            {
                "latitude": "10.3157",
                "longitude": "123.8854",
            },
        )

        response = view.get(request)

        self.assertEqual(
            response.status_code,
            200,
        )

        self.assertTrue(
            response.data["success"],
        )

        self.assertEqual(
            response.data["data"],
            [],
        )

        mock_list_nearby_businesses.assert_called_once_with(
            latitude=10.3157,
            longitude=123.8854,
        )

    @patch(
        "apps.explorer_operations.explore_businesses.views."
        "explore_map_preview_views."
        "ExploreMapPreviewService.list_nearby_preview_businesses",
    )
    def test_rejects_request_when_latitude_is_missing(
        self,
        mock_list_nearby_businesses,
    ):
        view, request = self.make_request(
            {
                "longitude": "123.8854",
            },
        )

        with self.assertRaises(ValidationError):
            view.get(request)

        mock_list_nearby_businesses.assert_not_called()

    @patch(
        "apps.explorer_operations.explore_businesses.views."
        "explore_map_preview_views."
        "ExploreMapPreviewService.list_nearby_preview_businesses",
    )
    def test_rejects_request_when_longitude_is_missing(
        self,
        mock_list_nearby_businesses,
    ):
        view, request = self.make_request(
            {
                "latitude": "10.3157",
            },
        )

        with self.assertRaises(ValidationError):
            view.get(request)

        mock_list_nearby_businesses.assert_not_called()

    @patch(
        "apps.explorer_operations.explore_businesses.views."
        "explore_map_preview_views."
        "ExploreMapPreviewService.list_nearby_preview_businesses",
    )
    def test_rejects_latitude_outside_valid_range(
        self,
        mock_list_nearby_businesses,
    ):
        view, request = self.make_request(
            {
                "latitude": "91",
                "longitude": "123.8854",
            },
        )

        with self.assertRaises(ValidationError):
            view.get(request)

        mock_list_nearby_businesses.assert_not_called()

    @patch(
        "apps.explorer_operations.explore_businesses.views."
        "explore_map_preview_views."
        "ExploreMapPreviewService.list_nearby_preview_businesses",
    )
    def test_rejects_longitude_outside_valid_range(
        self,
        mock_list_nearby_businesses,
    ):
        view, request = self.make_request(
            {
                "latitude": "10.3157",
                "longitude": "181",
            },
        )

        with self.assertRaises(ValidationError):
            view.get(request)

        mock_list_nearby_businesses.assert_not_called()