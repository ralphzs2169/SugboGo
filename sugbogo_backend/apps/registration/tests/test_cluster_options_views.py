from unittest.mock import Mock, patch

from django.urls import reverse
from rest_framework.test import APITestCase

from core.tests.assertions import APIResponseAssertionsMixin


class ClusterOptionsViewTests(
    APIResponseAssertionsMixin,
    APITestCase,
):
    """Tests for the cluster registration options endpoint."""

    def setUp(self):
        self.url = reverse("cluster-options")

    @patch(
        "apps.registration.views.cluster_options_views.ClusterService.list_registration_options"
    )
    def test_returns_cluster_options_successfully(
        self,
        mock_list_registration_options,
    ):
        cluster_one = Mock(
            CLUS_ID=1,
            CLUS_NAME="Food & Beverage",
            CLUS_DESCRIPTION="Food and beverage businesses.",
            CLUS_CREATED_AT="2026-08-01T10:00:00Z",
            category_count=3,
        )

        cluster_two = Mock(
            CLUS_ID=2,
            CLUS_NAME="Accommodation",
            CLUS_DESCRIPTION="Accommodation businesses.",
            CLUS_CREATED_AT="2026-08-01T11:00:00Z",
            category_count=2,
        )

        mock_list_registration_options.return_value = [
            cluster_one,
            cluster_two,
        ]

        response = self.client.get(self.url)

        self.assertSuccessResponse(
            response,
            message="Success.",
        )

        self.assertEqual(
            response.data["data"],
            [
                {
                    "id": 1,
                    "name": "Food & Beverage",
                    "description": "Food and beverage businesses.",
                    "category_count": 3,
                    "created_at": "2026-08-01T10:00:00Z",
                },
                {
                    "id": 2,
                    "name": "Accommodation",
                    "description": "Accommodation businesses.",
                    "category_count": 2,
                    "created_at": "2026-08-01T11:00:00Z",
                },
            ],
        )

        mock_list_registration_options.assert_called_once_with()

    @patch(
        "apps.registration.views.cluster_options_views.ClusterService.list_registration_options"
    )
    def test_returns_empty_list_when_no_cluster_options_exist(
        self,
        mock_list_registration_options,
    ):
        mock_list_registration_options.return_value = []

        response = self.client.get(self.url)

        self.assertSuccessResponse(
            response,
            message="Success.",
        )

        self.assertEqual(
            response.data["data"],
            [],
        )

        mock_list_registration_options.assert_called_once_with()