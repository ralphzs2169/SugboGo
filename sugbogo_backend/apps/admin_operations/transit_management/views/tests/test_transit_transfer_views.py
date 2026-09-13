from rest_framework import status
from rest_framework.test import APITestCase

from apps.admin_operations.transit_management.views.tests import (
    TransitManagementViewTestMixin,
)
from apps.transit.models import TransitTransfer


class TransitTransferViewTests(
    TransitManagementViewTestMixin,
    APITestCase,
):
    """Test protected administrator transit-transfer APIs."""

    def test_transfer_create_supports_distinct_connection_points(self):
        """Create a pending transfer with separate alighting and boarding points."""

        response = self.client.post(
            "/api/admin/transit/transfers/",
            self._transfer_payload(),
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )
        self.assertEqual(
            response.data["data"]["status"],
            TransitTransfer.TransferStatus.PENDING,
        )
        self.assertNotEqual(
            response.data["data"]["alighting_transit_point"]["id"],
            response.data["data"]["boarding_transit_point"]["id"],
        )

    def test_transfer_list_detail_and_connection_update(self):
        """List, retrieve, and update a directed transfer connection."""

        create_response = self.client.post(
            "/api/admin/transit/transfers/",
            self._transfer_payload(),
            format="json",
        )
        transfer_id = create_response.data["data"]["id"]

        list_response = self.client.get(
            "/api/admin/transit/transfers/?status=pending",
        )
        detail_response = self.client.get(
            f"/api/admin/transit/transfers/{transfer_id}/",
        )
        update_response = self.client.patch(
            f"/api/admin/transit/transfers/{transfer_id}/",
            {
                "boarding_transit_point_id": self.colon.TRPT_ID,
            },
            format="json",
        )

        self.assertEqual(
            list_response.data["data"]["pagination"]["total_items"],
            1,
        )
        self.assertEqual(
            detail_response.data["data"]["id"],
            transfer_id,
        )
        self.assertEqual(
            update_response.data["data"]["boarding_transit_point"]["id"],
            self.colon.TRPT_ID,
        )

    def test_transfer_can_be_confirmed(self):
        """Confirm a pending transfer through its explicit action."""

        create_response = self.client.post(
            "/api/admin/transit/transfers/",
            self._transfer_payload(),
            format="json",
        )
        transfer_id = create_response.data["data"]["id"]

        response = self.client.post(
            f"/api/admin/transit/transfers/{transfer_id}/confirm/",
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            response.data["data"]["status"],
            TransitTransfer.TransferStatus.CONFIRMED,
        )

    def test_transfer_can_be_ignored(self):
        """Ignore a pending transfer through its explicit action."""

        create_response = self.client.post(
            "/api/admin/transit/transfers/",
            self._transfer_payload(),
            format="json",
        )
        transfer_id = create_response.data["data"]["id"]

        response = self.client.post(
            f"/api/admin/transit/transfers/{transfer_id}/ignore/",
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            response.data["data"]["status"],
            TransitTransfer.TransferStatus.IGNORED,
        )

    def test_transfer_rejects_self_transfer(self):
        """Reject a transfer whose source and destination variant match."""

        payload = self._transfer_payload()
        payload["destination_variant_id"] = self.variant_14d.JRV_ID
        payload["boarding_transit_point_id"] = self.colon.TRPT_ID

        response = self.client.post(
            "/api/admin/transit/transfers/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_transfer_rejects_duplicate_directed_connection(self):
        """Reject duplicate manual records for one directed connection."""

        payload = self._transfer_payload()

        self.client.post(
            "/api/admin/transit/transfers/",
            payload,
            format="json",
        )
        response = self.client.post(
            "/api/admin/transit/transfers/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_transfer_detail_returns_not_found(self):
        """Return a controlled 404 for an unknown transfer."""

        response = self.client.get(
            "/api/admin/transit/transfers/999999/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

