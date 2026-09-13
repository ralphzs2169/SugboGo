from django.contrib.gis.geos import LineString
from django.test import TestCase

from apps.admin_operations.transit_management.constants import (
    TRANSFER_CANDIDATE_DISTANCE_METERS,
)
from apps.admin_operations.transit_management.services.jeepney_route_service import (
    JeepneyRouteService,
)
from apps.admin_operations.transit_management.services.route_variant_service import (
    RouteVariantService,
)
from apps.admin_operations.transit_management.services.transit_point_service import (
    TransitPointService,
)
from apps.admin_operations.transit_management.services.transfer_candidate_detection_service import (
    TransferCandidateDetectionService,
)
from apps.transit.models import JeepneyRouteVariant, TransitTransfer


class TransferCandidateDetectionServiceTests(TestCase):
    """Test PostGIS transfer candidate detection and persistence."""

    def _create_point(
        self,
        name,
        longitude,
        latitude,
    ):
        """Create one managed Transit Point fixture."""

        return TransitPointService.create_transit_point(
            {
                "name": name,
                "longitude": longitude,
                "latitude": latitude,
            },
        )

    def _create_route(
        self,
        code,
    ):
        """Create one jeepney route fixture."""

        return JeepneyRouteService.create_route(
            {
                "code": code,
            },
        )

    def _create_variant(
        self,
        route,
        ordered_points,
        geometry,
    ):
        """Create a coherent route variant with explicit geometry."""

        return RouteVariantService.create_variant(
            {
                "JRT_ID": route,
                "JRV_ORIGIN_ID": ordered_points[0],
                "JRV_DESTINATION_ID": ordered_points[-1],
                "geometry": [
                    {
                        "longitude": longitude,
                        "latitude": latitude,
                    }
                    for longitude, latitude in geometry
                ],
                "ordered_transit_points": ordered_points,
            },
        )

    def _create_intersecting_network(
        self,
        shared_transfer_point=False,
    ):
        """Create two route variants that cross near managed route points."""

        source_start = self._create_point(
            "Source Start",
            123.8900,
            10.3000,
        )
        source_transfer = self._create_point(
            "Source Transfer",
            123.8910,
            10.3000,
        )
        source_end = self._create_point(
            "Source End",
            123.8920,
            10.3000,
        )
        destination_start = self._create_point(
            "Destination Start",
            123.8911,
            10.2990,
        )

        if shared_transfer_point:
            destination_transfer = source_transfer
        else:
            destination_transfer = self._create_point(
                "Destination Transfer",
                123.8911,
                10.3000,
            )

        destination_end = self._create_point(
            "Destination End",
            123.8911,
            10.3010,
        )

        source_variant = self._create_variant(
            self._create_route("14D"),
            [
                source_start,
                source_transfer,
                source_end,
            ],
            [
                (123.8900, 10.3000),
                (123.8920, 10.3000),
            ],
        )
        destination_variant = self._create_variant(
            self._create_route("08G"),
            [
                destination_start,
                destination_transfer,
                destination_end,
            ],
            [
                (123.8911, 10.2990),
                (123.8911, 10.3010),
            ],
        )

        return {
            "source_variant": source_variant,
            "destination_variant": destination_variant,
            "source_transfer": source_transfer,
            "destination_transfer": destination_transfer,
        }

    def test_intersection_creates_directed_candidates_with_nearest_points(self):
        """Create both directions using each route's nearest managed point."""

        network = self._create_intersecting_network()

        summary = TransferCandidateDetectionService.detect_candidates()

        self.assertEqual(
            summary["route_pairs_eligible"],
            2,
        )
        self.assertEqual(
            summary["candidates_created"],
            2,
        )

        forward = TransitTransfer.objects.get(
            TTFR_FROM_VARIANT_ID=network["source_variant"],
            TTFR_TO_VARIANT_ID=network["destination_variant"],
        )
        reverse = TransitTransfer.objects.get(
            TTFR_FROM_VARIANT_ID=network["destination_variant"],
            TTFR_TO_VARIANT_ID=network["source_variant"],
        )

        self.assertEqual(
            forward.TTFR_FROM_TRANSIT_POINT_ID,
            network["source_transfer"],
        )
        self.assertEqual(
            forward.TTFR_TO_TRANSIT_POINT_ID,
            network["destination_transfer"],
        )
        self.assertNotEqual(
            forward.TTFR_FROM_TRANSIT_POINT_ID,
            forward.TTFR_TO_TRANSIT_POINT_ID,
        )
        self.assertEqual(
            reverse.TTFR_FROM_TRANSIT_POINT_ID,
            network["destination_transfer"],
        )
        self.assertEqual(
            reverse.TTFR_TO_TRANSIT_POINT_ID,
            network["source_transfer"],
        )
        self.assertEqual(
            forward.TTFR_STATUS,
            TransitTransfer.TransferStatus.PENDING,
        )

    def test_nearby_non_intersecting_routes_within_ceiling_create_candidates(self):
        """Detect route geometries separated by a meter-based nearby distance."""

        source_start = self._create_point("A Start", 123.8900, 10.3000)
        source_end = self._create_point("A End", 123.8920, 10.3000)
        destination_start = self._create_point("B Start", 123.8900, 10.3008)
        destination_end = self._create_point("B End", 123.8920, 10.3008)

        self._create_variant(
            self._create_route("14D"),
            [source_start, source_end],
            [(123.8900, 10.3000), (123.8920, 10.3000)],
        )
        self._create_variant(
            self._create_route("08G"),
            [destination_start, destination_end],
            [(123.8900, 10.3008), (123.8920, 10.3008)],
        )

        summary = TransferCandidateDetectionService.detect_candidates()

        self.assertEqual(
            summary["candidates_created"],
            2,
        )

    def test_routes_outside_meter_ceiling_do_not_produce_candidates(self):
        """Exclude routes whose WGS 84 separation exceeds 150 meters."""

        source_start = self._create_point("A Start", 123.8900, 10.3000)
        source_end = self._create_point("A End", 123.8920, 10.3000)
        destination_start = self._create_point("B Start", 123.8900, 10.3020)
        destination_end = self._create_point("B End", 123.8920, 10.3020)

        self._create_variant(
            self._create_route("14D"),
            [source_start, source_end],
            [(123.8900, 10.3000), (123.8920, 10.3000)],
        )
        self._create_variant(
            self._create_route("08G"),
            [destination_start, destination_end],
            [(123.8900, 10.3020), (123.8920, 10.3020)],
        )

        summary = TransferCandidateDetectionService.detect_candidates()

        self.assertEqual(
            TRANSFER_CANDIDATE_DISTANCE_METERS,
            150,
        )
        self.assertEqual(
            summary["route_pairs_eligible"],
            0,
        )
        self.assertEqual(
            TransitTransfer.objects.count(),
            0,
        )

    def test_variant_without_ordered_route_points_is_skipped(self):
        """Skip spatial pairs when either route lacks usable managed points."""

        source_start = self._create_point("A Start", 123.8900, 10.3000)
        source_end = self._create_point("A End", 123.8920, 10.3000)
        destination_start = self._create_point("B Start", 123.8910, 10.2990)
        destination_end = self._create_point("B End", 123.8910, 10.3010)

        self._create_variant(
            self._create_route("14D"),
            [source_start, source_end],
            [(123.8900, 10.3000), (123.8920, 10.3000)],
        )
        JeepneyRouteVariant.objects.create(
            JRT_ID=self._create_route("08G"),
            JRV_ORIGIN_ID=destination_start,
            JRV_DESTINATION_ID=destination_end,
            JRV_GEOMETRY=LineString(
                (123.8910, 10.2990),
                (123.8910, 10.3010),
                srid=4326,
            ),
        )

        summary = TransferCandidateDetectionService.detect_candidates()

        self.assertEqual(
            summary["candidates_skipped_no_route_points"],
            2,
        )
        self.assertEqual(
            TransitTransfer.objects.count(),
            0,
        )

    def test_far_managed_connection_points_are_skipped(self):
        """Reject nearby geometries whose selected managed points are too far apart."""

        source_start = self._create_point("A Start", 123.8700, 10.2900)
        source_end = self._create_point("A End", 123.8710, 10.2900)
        destination_start = self._create_point("B Start", 123.9200, 10.3100)
        destination_end = self._create_point("B End", 123.9210, 10.3100)

        self._create_variant(
            self._create_route("14D"),
            [source_start, source_end],
            [(123.8900, 10.3000), (123.8920, 10.3000)],
        )
        self._create_variant(
            self._create_route("08G"),
            [destination_start, destination_end],
            [(123.8910, 10.2990), (123.8910, 10.3010)],
        )

        summary = TransferCandidateDetectionService.detect_candidates()

        self.assertEqual(
            summary["candidates_skipped_connection_distance"],
            2,
        )
        self.assertEqual(
            TransitTransfer.objects.count(),
            0,
        )

    def test_shared_managed_transit_point_is_valid(self):
        """Allow both transfer sides to select the same managed Transit Point."""

        network = self._create_intersecting_network(
            shared_transfer_point=True,
        )

        TransferCandidateDetectionService.detect_candidates()

        transfer = TransitTransfer.objects.get(
            TTFR_FROM_VARIANT_ID=network["source_variant"],
            TTFR_TO_VARIANT_ID=network["destination_variant"],
        )

        self.assertEqual(
            transfer.TTFR_FROM_TRANSIT_POINT_ID,
            transfer.TTFR_TO_TRANSIT_POINT_ID,
        )

    def test_same_route_variants_are_not_suggested(self):
        """Exclude directional variants belonging to the same jeepney code."""

        first = self._create_point("First", 123.8900, 10.3000)
        second = self._create_point("Second", 123.8920, 10.3000)
        route = self._create_route("14D")

        self._create_variant(
            route,
            [first, second],
            [(123.8900, 10.3000), (123.8920, 10.3000)],
        )
        self._create_variant(
            route,
            [second, first],
            [(123.8920, 10.3000), (123.8900, 10.3000)],
        )

        summary = TransferCandidateDetectionService.detect_candidates()

        self.assertEqual(
            summary["route_pairs_eligible"],
            0,
        )
        self.assertEqual(
            TransitTransfer.objects.count(),
            0,
        )

    def test_single_variant_never_creates_a_self_transfer(self):
        """Never pair a directional route variant with itself."""

        start = self._create_point("Start", 123.8900, 10.3000)
        end = self._create_point("End", 123.8920, 10.3000)

        self._create_variant(
            self._create_route("14D"),
            [start, end],
            [(123.8900, 10.3000), (123.8920, 10.3000)],
        )

        summary = TransferCandidateDetectionService.detect_candidates()

        self.assertEqual(
            summary["route_pairs_eligible"],
            0,
        )
        self.assertEqual(
            TransitTransfer.objects.count(),
            0,
        )

    def test_repeated_detection_does_not_duplicate_pending_candidates(self):
        """Return clean skip counts when pending candidates already exist."""

        self._create_intersecting_network()

        first_summary = TransferCandidateDetectionService.detect_candidates()
        second_summary = TransferCandidateDetectionService.detect_candidates()

        self.assertEqual(
            first_summary["candidates_created"],
            2,
        )
        self.assertEqual(
            second_summary["candidates_created"],
            0,
        )
        self.assertEqual(
            second_summary["candidates_skipped_existing"],
            2,
        )
        self.assertEqual(
            TransitTransfer.objects.count(),
            2,
        )

    def test_confirmed_and_ignored_candidates_are_not_recreated(self):
        """Preserve both administrator decisions across repeated detection."""

        self._create_intersecting_network()
        TransferCandidateDetectionService.detect_candidates()
        transfers = list(
            TransitTransfer.objects.order_by(
                "TTFR_ID",
            )
        )
        transfers[0].TTFR_STATUS = TransitTransfer.TransferStatus.CONFIRMED
        transfers[0].save(
            update_fields=[
                "TTFR_STATUS",
                "TTFR_UPDATED_AT",
            ],
        )
        transfers[1].TTFR_STATUS = TransitTransfer.TransferStatus.IGNORED
        transfers[1].save(
            update_fields=[
                "TTFR_STATUS",
                "TTFR_UPDATED_AT",
            ],
        )

        summary = TransferCandidateDetectionService.detect_candidates()

        self.assertEqual(
            summary["candidates_created"],
            0,
        )
        self.assertEqual(
            summary["candidates_skipped_existing"],
            2,
        )
        self.assertEqual(
            set(
                TransitTransfer.objects.values_list(
                    "TTFR_STATUS",
                    flat=True,
                )
            ),
            {
                TransitTransfer.TransferStatus.CONFIRMED,
                TransitTransfer.TransferStatus.IGNORED,
            },
        )
