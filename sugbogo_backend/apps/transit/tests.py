from django.contrib.gis.geos import LineString, Point
from django.db import IntegrityError, transaction
from django.test import TestCase

from apps.transit.models import (
    JeepneyRoute,
    JeepneyRouteVariant,
    RouteTransitPoint,
    TransitPoint,
    TransitTransfer,
)


class TransitPersistenceTests(TestCase):
    """Tests the transit network persistence models and constraints."""

    def setUp(self):
        """Creates reusable routes, points, and directional variants."""

        self.kamputhaw = self._create_transit_point(
            name="Kamputhaw",
            longitude=123.8930,
            latitude=10.3150,
        )
        self.capitol = self._create_transit_point(
            name="Cebu Provincial Capitol",
            longitude=123.8908,
            latitude=10.3173,
        )
        self.fuente = self._create_transit_point(
            name="Fuente",
            longitude=123.8958,
            latitude=10.3103,
        )
        self.colon = self._create_transit_point(
            name="Colon",
            longitude=123.9003,
            latitude=10.2940,
        )
        self.carbon = self._create_transit_point(
            name="Carbon",
            longitude=123.8991,
            latitude=10.2910,
        )

        self.route_14d = JeepneyRoute.objects.create(
            JRT_CODE="14D",
        )
        self.route_08g = JeepneyRoute.objects.create(
            JRT_CODE="08G",
        )

        self.variant_14d_outbound = self._create_variant(
            route=self.route_14d,
            origin=self.kamputhaw,
            destination=self.colon,
        )
        self.variant_08g_outbound = self._create_variant(
            route=self.route_08g,
            origin=self.colon,
            destination=self.carbon,
        )

    def _create_transit_point(
        self,
        name,
        longitude,
        latitude,
    ):
        """Creates a transit point using a WGS 84 geometry."""

        return TransitPoint.objects.create(
            TRPT_NAME=name,
            TRPT_POINT=Point(
                longitude,
                latitude,
                srid=4326,
            ),
        )

    def _create_variant(
        self,
        route,
        origin,
        destination,
    ):
        """Creates a directional variant using its endpoint coordinates."""

        return JeepneyRouteVariant.objects.create(
            JRT_ID=route,
            JRV_ORIGIN_ID=origin,
            JRV_DESTINATION_ID=destination,
            JRV_GEOMETRY=LineString(
                origin.TRPT_POINT,
                destination.TRPT_POINT,
                srid=4326,
            ),
        )

    def _create_transfer(
        self,
        status=None,
    ):
        """Creates a route-specific transfer between two variants."""

        transfer_values = {
            "TTFR_FROM_VARIANT_ID": self.variant_14d_outbound,
            "TTFR_TO_VARIANT_ID": self.variant_08g_outbound,
            "TTFR_FROM_TRANSIT_POINT_ID": self.colon,
            "TTFR_TO_TRANSIT_POINT_ID": self.colon,
        }

        if status is not None:
            transfer_values["TTFR_STATUS"] = status

        return TransitTransfer.objects.create(
            **transfer_values,
        )

    def test_creates_jeepney_route(self):
        """Stores a uniquely identifiable jeepney code."""

        route = JeepneyRoute.objects.get(
            JRT_CODE="14D",
        )

        self.assertEqual(
            route.JRT_CODE,
            "14D",
        )

    def test_rejects_duplicate_jeepney_route_code(self):
        """Rejects two route records with the same jeepney code."""

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                JeepneyRoute.objects.create(
                    JRT_CODE="14D",
                )

    def test_creates_multiple_directional_variants_for_one_route(self):
        """Stores distinct inbound and outbound paths for one route."""

        inbound = self._create_variant(
            route=self.route_14d,
            origin=self.colon,
            destination=self.kamputhaw,
        )

        self.assertEqual(
            self.route_14d.variants.count(),
            2,
        )
        self.assertNotEqual(
            self.variant_14d_outbound.JRV_ID,
            inbound.JRV_ID,
        )

    def test_stores_route_variant_linestring_with_srid_4326(self):
        """Persists directional route geometry as a WGS 84 LineString."""

        variant = JeepneyRouteVariant.objects.get(
            JRV_ID=self.variant_14d_outbound.JRV_ID,
        )

        self.assertEqual(
            variant.JRV_GEOMETRY.geom_type,
            "LineString",
        )
        self.assertEqual(
            variant.JRV_GEOMETRY.srid,
            4326,
        )

    def test_creates_transit_point_with_srid_4326(self):
        """Persists managed transit infrastructure as a WGS 84 Point."""

        point = TransitPoint.objects.get(
            TRPT_ID=self.capitol.TRPT_ID,
        )

        self.assertEqual(
            point.TRPT_POINT.geom_type,
            "Point",
        )
        self.assertEqual(
            point.TRPT_POINT.srid,
            4326,
        )

    def test_preserves_ordered_route_transit_point_sequence(self):
        """Returns route transit points in their directional sequence."""

        route_points = [
            self.kamputhaw,
            self.capitol,
            self.fuente,
            self.colon,
        ]

        for sequence, transit_point in enumerate(
            route_points,
            start=1,
        ):
            RouteTransitPoint.objects.create(
                JRV_ID=self.variant_14d_outbound,
                TRPT_ID=transit_point,
                RVTP_SEQUENCE=sequence,
            )

        stored_names = list(
            self.variant_14d_outbound.route_transit_points.values_list(
                "TRPT_ID__TRPT_NAME",
                flat=True,
            )
        )

        self.assertEqual(
            stored_names,
            [
                "Kamputhaw",
                "Cebu Provincial Capitol",
                "Fuente",
                "Colon",
            ],
        )

    def test_rejects_duplicate_sequence_within_route_variant(self):
        """Rejects duplicate ordering positions on one route variant."""

        RouteTransitPoint.objects.create(
            JRV_ID=self.variant_14d_outbound,
            TRPT_ID=self.kamputhaw,
            RVTP_SEQUENCE=1,
        )

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                RouteTransitPoint.objects.create(
                    JRV_ID=self.variant_14d_outbound,
                    TRPT_ID=self.capitol,
                    RVTP_SEQUENCE=1,
                )

    def test_rejects_duplicate_transit_point_within_route_variant(self):
        """Rejects duplicate point memberships on one route variant."""

        RouteTransitPoint.objects.create(
            JRV_ID=self.variant_14d_outbound,
            TRPT_ID=self.kamputhaw,
            RVTP_SEQUENCE=1,
        )

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                RouteTransitPoint.objects.create(
                    JRV_ID=self.variant_14d_outbound,
                    TRPT_ID=self.kamputhaw,
                    RVTP_SEQUENCE=2,
                )

    def test_creates_pending_transfer(self):
        """Stores a newly discovered transfer as pending by default."""

        transfer = self._create_transfer()

        self.assertEqual(
            transfer.TTFR_STATUS,
            TransitTransfer.TransferStatus.PENDING,
        )

    def test_creates_confirmed_transfer(self):
        """Stores an admin-confirmed transfer connection."""

        transfer = self._create_transfer(
            status=TransitTransfer.TransferStatus.CONFIRMED,
        )

        self.assertEqual(
            transfer.TTFR_STATUS,
            TransitTransfer.TransferStatus.CONFIRMED,
        )

    def test_creates_ignored_transfer(self):
        """Stores an ignored transfer candidate for review history."""

        transfer = self._create_transfer(
            status=TransitTransfer.TransferStatus.IGNORED,
        )

        self.assertEqual(
            transfer.TTFR_STATUS,
            TransitTransfer.TransferStatus.IGNORED,
        )

    def test_creates_nearby_transfer_with_distinct_connection_points(self):
        """Stores separate alighting and boarding points for a walking transfer."""

        transfer = TransitTransfer.objects.create(
            TTFR_FROM_VARIANT_ID=self.variant_14d_outbound,
            TTFR_TO_VARIANT_ID=self.variant_08g_outbound,
            TTFR_FROM_TRANSIT_POINT_ID=self.fuente,
            TTFR_TO_TRANSIT_POINT_ID=self.colon,
        )

        self.assertNotEqual(
            transfer.TTFR_FROM_TRANSIT_POINT_ID,
            transfer.TTFR_TO_TRANSIT_POINT_ID,
        )

    def test_allows_reverse_directed_transfer(self):
        """Treats the reverse direction as a separate transfer relationship."""

        forward_transfer = self._create_transfer(
            status=TransitTransfer.TransferStatus.CONFIRMED,
        )
        reverse_transfer = TransitTransfer.objects.create(
            TTFR_FROM_VARIANT_ID=self.variant_08g_outbound,
            TTFR_TO_VARIANT_ID=self.variant_14d_outbound,
            TTFR_FROM_TRANSIT_POINT_ID=self.colon,
            TTFR_TO_TRANSIT_POINT_ID=self.colon,
            TTFR_STATUS=TransitTransfer.TransferStatus.CONFIRMED,
        )

        self.assertNotEqual(
            forward_transfer.TTFR_ID,
            reverse_transfer.TTFR_ID,
        )

    def test_rejects_transfer_to_same_route_variant(self):
        """Rejects a transfer whose two sides use the same variant."""

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                TransitTransfer.objects.create(
                    TTFR_FROM_VARIANT_ID=self.variant_14d_outbound,
                    TTFR_TO_VARIANT_ID=self.variant_14d_outbound,
                    TTFR_FROM_TRANSIT_POINT_ID=self.colon,
                    TTFR_TO_TRANSIT_POINT_ID=self.kamputhaw,
                )

    def test_rejects_duplicate_transfer_connection(self):
        """Rejects the same route-specific transfer connection twice."""

        self._create_transfer(
            status=TransitTransfer.TransferStatus.PENDING,
        )

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                self._create_transfer(
                    status=TransitTransfer.TransferStatus.CONFIRMED,
                )
