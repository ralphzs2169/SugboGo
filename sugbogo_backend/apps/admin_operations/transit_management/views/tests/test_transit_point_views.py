from rest_framework import status
from rest_framework.test import APITestCase

from apps.admin_operations.transit_management.views.tests import (
    TransitManagementViewTestMixin,
)


class TransitPointViewTests(
    TransitManagementViewTestMixin,
    APITestCase,
):
    """Test protected administrator Transit Point APIs."""

    def test_transit_point_list_detail_create_and_update_coordinates(self):
        """Expose Transit Point CRUD with latitude and longitude."""

        list_response = self.client.get(
            "/api/admin/transit/transit-points/",
        )
        detail_response = self.client.get(
            f"/api/admin/transit/transit-points/{self.colon.TRPT_ID}/",
        )
        create_response = self.client.post(
            "/api/admin/transit/transit-points/",
            {
                "name": "Fuente",
                "latitude": 10.3103,
                "longitude": 123.8958,
            },
            format="json",
        )
        update_response = self.client.patch(
            f"/api/admin/transit/transit-points/{self.colon.TRPT_ID}/",
            {
                "name": "Colon Street",
                "latitude": 10.2941,
                "longitude": 123.9004,
            },
            format="json",
        )

        self.assertEqual(
            list_response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            detail_response.data["data"]["latitude"],
            10.2940,
        )
        self.assertEqual(
            create_response.status_code,
            status.HTTP_201_CREATED,
        )
        self.assertEqual(
            create_response.data["data"]["longitude"],
            123.8958,
        )
        self.assertEqual(
            update_response.data["data"]["latitude"],
            10.2941,
        )

        self.colon.refresh_from_db()
        self.assertEqual(
            self.colon.TRPT_POINT.x,
            123.9004,
        )
