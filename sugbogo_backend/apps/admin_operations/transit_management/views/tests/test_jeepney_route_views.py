from rest_framework import status
from rest_framework.test import APITestCase

from apps.admin_operations.transit_management.views.tests import (
    TransitManagementViewTestMixin,
)


class JeepneyRouteViewTests(
    TransitManagementViewTestMixin,
    APITestCase,
):
    """Test protected administrator jeepney-route APIs."""

    def test_route_list_detail_create_and_update(self):
        """Expose route management and variants in route detail."""

        list_response = self.client.get(
            "/api/admin/transit/routes/",
        )
        detail_response = self.client.get(
            f"/api/admin/transit/routes/{self.route_14d.JRT_ID}/",
        )
        create_response = self.client.post(
            "/api/admin/transit/routes/",
            {
                "code": "04l",
            },
            format="json",
        )
        update_response = self.client.patch(
            f"/api/admin/transit/routes/{self.route_14d.JRT_ID}/",
            {
                "code": "14E",
            },
            format="json",
        )

        self.assertEqual(
            list_response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            detail_response.data["data"]["variants"][0]["id"],
            self.variant_14d.JRV_ID,
        )
        self.assertEqual(
            create_response.status_code,
            status.HTTP_201_CREATED,
        )
        self.assertEqual(
            create_response.data["data"]["code"],
            "04L",
        )
        self.assertEqual(
            update_response.data["data"]["code"],
            "14E",
        )

    def test_route_detail_returns_not_found(self):
        """Return a controlled 404 for an unknown route."""

        response = self.client.get(
            "/api/admin/transit/routes/999999/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_transit_management_requires_authentication(self):
        """Reject unauthenticated access to transit management."""

        self.client.force_authenticate(
            user=None,
        )

        response = self.client.get(
            "/api/admin/transit/routes/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_transit_management_requires_admin_role(self):
        """Reject authenticated users without an administrator role."""

        self.client.force_authenticate(
            self.merchant,
        )

        response = self.client.get(
            "/api/admin/transit/routes/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )
