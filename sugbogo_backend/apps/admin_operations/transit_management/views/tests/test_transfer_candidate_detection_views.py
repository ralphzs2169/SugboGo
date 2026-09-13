from rest_framework import status
from rest_framework.test import APITestCase

from apps.admin_operations.transit_management.views.tests import (
    TransitManagementViewTestMixin,
)


class TransferCandidateDetectionViewTests(
    TransitManagementViewTestMixin,
    APITestCase,
):
    """Test the protected transfer candidate detection action."""

    endpoint = "/api/admin/transit/transfers/detect-candidates/"

    def test_admin_can_trigger_candidate_detection(self):
        """Return the standard envelope with a successful detection summary."""

        response = self.client.post(
            self.endpoint,
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertTrue(
            response.data["success"],
        )
        self.assertEqual(
            response.data["message"],
            "Transit transfer candidates detected successfully.",
        )
        self.assertEqual(
            response.data["data"]["route_pairs_eligible"],
            2,
        )
        self.assertEqual(
            response.data["data"]["candidates_created"],
            2,
        )

    def test_unauthenticated_user_cannot_trigger_detection(self):
        """Require authentication for transfer candidate detection."""

        self.client.force_authenticate(
            user=None,
        )

        response = self.client.post(
            self.endpoint,
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_non_admin_user_cannot_trigger_detection(self):
        """Require the existing administrator role permission."""

        self.client.force_authenticate(
            self.merchant,
        )

        response = self.client.post(
            self.endpoint,
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_transfer_responses_expose_derived_meter_distances(self):
        """Expose connection and route separation without stored metadata."""

        create_response = self.client.post(
            "/api/admin/transit/transfers/",
            self._transfer_payload(),
            format="json",
        )
        transfer_id = create_response.data["data"]["id"]

        detail_response = self.client.get(
            f"/api/admin/transit/transfers/{transfer_id}/",
        )
        list_response = self.client.get(
            "/api/admin/transit/transfers/",
        )

        detail = detail_response.data["data"]
        listed = list_response.data["data"]["items"][0]

        self.assertGreater(
            detail["connection_distance_meters"],
            150,
        )
        self.assertAlmostEqual(
            detail["route_separation_meters"],
            0,
            places=2,
        )
        self.assertEqual(
            listed["connection_distance_meters"],
            detail["connection_distance_meters"],
        )
        self.assertEqual(
            listed["route_separation_meters"],
            detail["route_separation_meters"],
        )
