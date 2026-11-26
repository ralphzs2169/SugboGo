"""Exercise route and direction deletion through the administrator API."""

from types import SimpleNamespace
from unittest.mock import patch

from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.admin_operations.transit_management.services import route_variant_service
from apps.admin_operations.transit_management.views.tests import TransitManagementViewTestMixin
from apps.transit.models import JeepneyRoute, JeepneyRouteVariant, RouteTransitPoint, TransitPoint
from apps.users.models import User


@override_settings(EXPERIMENTAL_ITINERARY_DEVELOPMENT_GRAPH_ENABLED=False)
class TransitDeletionViewTests(TransitManagementViewTestMixin, APITestCase):
    """Verify deletion effects, eligibility rechecks, and authorization."""

    def setUp(self):
        super().setUp()
        self.route_url = f"/api/admin/transit/routes/{self.route_14d.pk}/"
        self.variant_url = f"/api/admin/transit/route-variants/{self.variant_14d.pk}/"

    def test_route_deletion_requires_directions_to_be_removed_first(self):
        detail = self.client.get(self.route_url).data["data"]["deletion"]
        self.assertFalse(detail["can_delete"])
        self.assertEqual(detail["variant_count"], 1)

        blocked = self.client.delete(self.route_url)
        self.assertEqual(blocked.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(blocked.data["errors"]["deletion"], detail)
        self.assertIn("Delete all directions", blocked.data["message"])
        self.assertTrue(JeepneyRouteVariant.objects.filter(pk=self.variant_14d.pk).exists())

        direction = self.client.delete(self.variant_url)
        self.assertEqual(direction.status_code, status.HTTP_200_OK)
        self.assertTrue(self.client.get(self.route_url).data["data"]["deletion"]["can_delete"])
        deleted = self.client.delete(self.route_url)
        self.assertEqual(deleted.status_code, status.HTTP_200_OK)
        self.assertTrue(deleted.data["success"])
        self.assertFalse(JeepneyRoute.objects.filter(pk=self.route_14d.pk).exists())

    def test_direction_deletion_removes_memberships_and_preserves_stops(self):
        point_ids = set(TransitPoint.objects.values_list("pk", flat=True))
        detail = self.client.get(self.variant_url).data["data"]["deletion"]
        self.assertTrue(detail["can_delete"])
        self.assertEqual(detail["membership_count"], 3)

        response = self.client.delete(self.variant_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(JeepneyRouteVariant.objects.filter(pk=self.variant_14d.pk).exists())
        self.assertFalse(RouteTransitPoint.objects.filter(JRV_ID=self.variant_14d.pk).exists())
        self.assertTrue(JeepneyRoute.objects.filter(pk=self.route_14d.pk).exists())
        self.assertEqual(set(TransitPoint.objects.values_list("pk", flat=True)), point_ids)
        self.assertEqual(RouteTransitPoint.objects.filter(JRV_ID=self.variant_08g.pk).count(), 2)

    @override_settings(EXPERIMENTAL_ITINERARY_DEVELOPMENT_GRAPH_ENABLED=True)
    def test_direction_deletion_rechecks_the_graph_and_preserves_exact_matches(self):
        detail = self.client.get(self.variant_url).data["data"]["deletion"]
        self.assertFalse(detail["can_delete"])
        self.assertIn("could not be verified", detail["reason"])
        geometry = self.variant_14d.JRV_GEOMETRY.hexewkb.decode()
        graph = SimpleNamespace(
            variant_identities=lambda: {900: ("14D", geometry)},
        )
        other_url = f"/api/admin/transit/route-variants/{self.variant_08g.pk}/"

        with patch.object(
            route_variant_service,
            "configured_development_connection_graph",
            return_value=graph,
        ):
            blocked = self.client.delete(self.variant_url)
            allowed = self.client.delete(other_url)

        self.assertEqual(blocked.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(blocked.data["errors"]["deletion"]["can_delete"])
        self.assertIn("required by the enabled transfer graph", blocked.data["message"])
        self.assertEqual(allowed.status_code, status.HTTP_200_OK)
        self.assertTrue(JeepneyRouteVariant.objects.filter(pk=self.variant_14d.pk).exists())

    def test_direction_deletion_blocks_when_enabled_graph_cannot_be_verified(self):
        with patch.object(
            route_variant_service,
            "configured_development_connection_graph",
            side_effect=OSError("Missing index"),
        ):
            response = self.client.delete(self.variant_url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("could not be verified", response.data["message"])
        self.assertTrue(JeepneyRouteVariant.objects.filter(pk=self.variant_14d.pk).exists())

    def test_route_and_direction_deletion_require_an_active_administrator(self):
        self.admin.USER_STATUS = User.UserStatus.DISABLED
        self.admin.save(update_fields=["USER_STATUS"])
        for user, expected_status in (
            (None, status.HTTP_401_UNAUTHORIZED),
            (self.merchant, status.HTTP_403_FORBIDDEN),
            (self.admin, status.HTTP_403_FORBIDDEN),
        ):
            self.client.force_authenticate(user)
            for url in (self.route_url, self.variant_url):
                with self.subTest(user=user, url=url):
                    response = self.client.delete(url)
                    self.assertEqual(response.status_code, expected_status)

        self.assertTrue(JeepneyRoute.objects.filter(pk=self.route_14d.pk).exists())
        self.assertTrue(JeepneyRouteVariant.objects.filter(pk=self.variant_14d.pk).exists())

    def test_super_admin_can_delete_direction_then_route_and_repeat_gets_not_found(self):
        self.admin.USER_ROLE = User.UserRole.SUPER_ADMIN
        self.admin.save(update_fields=["USER_ROLE"])
        self.client.force_authenticate(self.admin)

        for url in (self.variant_url, self.route_url):
            with self.subTest(url=url):
                self.assertEqual(self.client.delete(url).status_code, status.HTTP_200_OK)
                missing = self.client.delete(url)
                self.assertEqual(missing.status_code, status.HTTP_404_NOT_FOUND)
                self.assertEqual(missing.data["code"], "NOT_FOUND")
