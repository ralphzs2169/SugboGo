from rest_framework import status
from rest_framework.test import APITestCase
from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.admin_operations.transit_management.views.tests import (
    TransitManagementViewTestMixin,
)
from apps.transit.models import TransitPoint, TransitTransfer
from apps.users.models import User


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

    def test_detail_describes_dependencies_without_adding_them_to_list_queries(self):
        """Expose typed detail metadata while keeping the paginated list lightweight."""

        detail = self.client.get(
            f"/api/admin/transit/transit-points/{self.colon.pk}/",
        )
        deletion = detail.data["data"]["deletion"]
        self.assertFalse(deletion["can_delete"])
        self.assertEqual(deletion["counts"]["directions"], 2)
        self.assertEqual(deletion["counts"]["destination_directions"], 2)
        self.assertEqual(deletion["counts"]["ordered_stops"], 2)

        with CaptureQueriesContext(connection) as queries:
            listing = self.client.get("/api/admin/transit/transit-points/")

        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        for item in listing.data["data"]["items"]:
            self.assertNotIn("deletion", item)
        for query in queries:
            self.assertNotIn('"JEEPNEY_ROUTE_VARIANT"', query["sql"])
            self.assertNotIn('"ROUTE_TRANSIT_POINT"', query["sql"])
            self.assertNotIn('"TRANSIT_TRANSFER"', query["sql"])

    def test_admin_and_super_admin_can_delete_unused_points(self):
        """Use the existing success envelope for both permitted administrator roles."""

        for role in (User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN):
            with self.subTest(role=role):
                self.admin.USER_ROLE = role
                self.admin.save(update_fields=["USER_ROLE"])
                self.client.force_authenticate(self.admin)
                point = self._create_point("Unused", 123.9, 10.3)
                response = self.client.delete(
                    f"/api/admin/transit/transit-points/{point.pk}/",
                )
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(
                    response.data,
                    {
                        "success": True,
                        "message": "Transit Point deleted successfully.",
                        "data": None,
                    },
                )
                self.assertFalse(TransitPoint.objects.filter(pk=point.pk).exists())

    def test_delete_returns_existing_not_found_response(self):
        """Return the established point-not-found message and exception envelope."""

        response = self.client.delete("/api/admin/transit/transit-points/999999/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(
            response.data,
            {
                "success": False,
                "message": "The Transit Point could not be found.",
                "code": "NOT_FOUND",
            },
        )

    def test_delete_rechecks_dependencies_and_returns_useful_validation_details(self):
        """Reject deletion even after detail previously reported that a point was unused."""

        point = self._create_point("Unused", 123.9, 10.3)
        url = f"/api/admin/transit/transit-points/{point.pk}/"
        detail = self.client.get(url)
        self.assertTrue(detail.data["data"]["deletion"]["can_delete"])
        transfer = TransitTransfer.objects.create(
            TTFR_FROM_VARIANT_ID=self.variant_14d,
            TTFR_TO_VARIANT_ID=self.variant_08g,
            TTFR_FROM_TRANSIT_POINT_ID=point,
            TTFR_TO_TRANSIT_POINT_ID=point,
            TTFR_STATUS=TransitTransfer.TransferStatus.IGNORED,
        )

        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["success"])
        self.assertEqual(response.data["code"], "VALIDATION_ERROR")
        self.assertIn("Reassign", response.data["message"])
        deletion = response.data["errors"]["deletion"]
        self.assertIs(deletion["can_delete"], False)
        self.assertEqual(deletion["counts"]["transfers"], 1)
        self.assertEqual(deletion["examples"]["transfers"][0]["id"], transfer.pk)
        self.assertTrue(TransitPoint.objects.filter(pk=point.pk).exists())
        self.assertTrue(TransitTransfer.objects.filter(pk=transfer.pk).exists())

    def test_delete_rejects_anonymous_non_admin_and_inactive_users(self):
        """Retain authentication, role and active-user restrictions on DELETE."""

        point = self._create_point("Unused", 123.9, 10.3)
        url = f"/api/admin/transit/transit-points/{point.pk}/"
        self.client.force_authenticate(user=None)
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        for role in (User.UserRole.MERCHANT, User.UserRole.EXPLORER):
            self.merchant.USER_ROLE = role
            self.merchant.save(update_fields=["USER_ROLE"])
            self.client.force_authenticate(self.merchant)
            response = self.client.delete(url)
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.admin.USER_STATUS = User.UserStatus.DISABLED
        self.admin.save(update_fields=["USER_STATUS"])
        self.client.force_authenticate(self.admin)
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(TransitPoint.objects.filter(pk=point.pk).exists())
