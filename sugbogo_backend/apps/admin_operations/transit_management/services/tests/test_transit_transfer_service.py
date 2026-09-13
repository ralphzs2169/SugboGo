from django.test import TestCase
from rest_framework.exceptions import NotFound, ValidationError

from apps.admin_operations.transit_management.services.jeepney_route_service import (
    JeepneyRouteService,
)
from apps.admin_operations.transit_management.services.route_variant_service import (
    RouteVariantService,
)
from apps.admin_operations.transit_management.services.transit_point_service import (
    TransitPointService,
)
from apps.admin_operations.transit_management.services.transit_transfer_service import (
    TransitTransferService,
)
from apps.transit.models import TransitTransfer


class TransitTransferServiceTests(TestCase):
    """Test directed transit-transfer management operations."""

    def setUp(self):
        """Create two directional variants with distinct connection points."""

        self.kamputhaw = self._create_point(
            "Kamputhaw",
            123.8930,
            10.3150,
        )
        self.colon = self._create_point(
            "Colon",
            123.9003,
            10.2940,
        )
        self.carbon = self._create_point(
            "Carbon",
            123.8991,
            10.2910,
        )

        route_14d = JeepneyRouteService.create_route(
            {
                "code": "14D",
            },
        )
        route_08g = JeepneyRouteService.create_route(
            {
                "code": "08G",
            },
        )

        self.variant_14d = self._create_variant(
            route_14d,
            self.kamputhaw,
            self.colon,
        )
        self.variant_08g = self._create_variant(
            route_08g,
            self.carbon,
            self.colon,
        )

    def _create_point(
        self,
        name,
        longitude,
        latitude,
    ):
        """Create a managed point through its service boundary."""

        return TransitPointService.create_transit_point(
            {
                "name": name,
                "longitude": longitude,
                "latitude": latitude,
            },
        )

    def _create_variant(
        self,
        route,
        origin,
        destination,
    ):
        """Create a two-point directional variant."""

        return RouteVariantService.create_variant(
            {
                "JRT_ID": route,
                "JRV_ORIGIN_ID": origin,
                "JRV_DESTINATION_ID": destination,
                "geometry": [
                    {
                        "longitude": origin.TRPT_POINT.x,
                        "latitude": origin.TRPT_POINT.y,
                    },
                    {
                        "longitude": destination.TRPT_POINT.x,
                        "latitude": destination.TRPT_POINT.y,
                    },
                ],
                "ordered_transit_points": [
                    origin,
                    destination,
                ],
            },
        )

    def _transfer_data(self):
        """Build a valid directed transfer payload."""

        return {
            "TTFR_FROM_VARIANT_ID": self.variant_14d,
            "TTFR_TO_VARIANT_ID": self.variant_08g,
            "TTFR_FROM_TRANSIT_POINT_ID": self.colon,
            "TTFR_TO_TRANSIT_POINT_ID": self.carbon,
        }

    def test_transfer_create_supports_distinct_connection_points(self):
        """Create a pending walking transfer with distinct route points."""

        transfer = TransitTransferService.create_transfer(
            self._transfer_data(),
        )

        self.assertEqual(
            transfer.TTFR_STATUS,
            TransitTransfer.TransferStatus.PENDING,
        )
        self.assertNotEqual(
            transfer.TTFR_FROM_TRANSIT_POINT_ID_id,
            transfer.TTFR_TO_TRANSIT_POINT_ID_id,
        )

    def test_transfer_can_be_confirmed(self):
        """Confirm a pending directed transfer through the review action."""

        transfer = TransitTransferService.create_transfer(
            self._transfer_data(),
        )

        transfer = TransitTransferService.set_transfer_status(
            transfer.TTFR_ID,
            TransitTransfer.TransferStatus.CONFIRMED,
        )

        self.assertEqual(
            transfer.TTFR_STATUS,
            TransitTransfer.TransferStatus.CONFIRMED,
        )

    def test_transfer_can_be_ignored(self):
        """Ignore a pending directed transfer through the review action."""

        transfer = TransitTransferService.create_transfer(
            self._transfer_data(),
        )

        transfer = TransitTransferService.set_transfer_status(
            transfer.TTFR_ID,
            TransitTransfer.TransferStatus.IGNORED,
        )

        self.assertEqual(
            transfer.TTFR_STATUS,
            TransitTransfer.TransferStatus.IGNORED,
        )

    def test_transfer_service_rejects_self_transfer(self):
        """Reject a transfer between the same directional variant."""

        transfer_data = self._transfer_data()
        transfer_data["TTFR_TO_VARIANT_ID"] = self.variant_14d
        transfer_data["TTFR_TO_TRANSIT_POINT_ID"] = self.colon

        with self.assertRaises(ValidationError):
            TransitTransferService.create_transfer(
                transfer_data,
            )

    def test_transfer_service_rejects_duplicate_directed_connection(self):
        """Reject an already persisted directed transfer connection."""

        transfer_data = self._transfer_data()

        TransitTransferService.create_transfer(
            transfer_data,
        )

        with self.assertRaises(ValidationError):
            TransitTransferService.create_transfer(
                transfer_data,
            )

    def test_missing_transfer_raises_not_found(self):
        """Raise a controlled error for an unknown transfer."""

        with self.assertRaises(NotFound):
            TransitTransferService.get_transfer(999999)

