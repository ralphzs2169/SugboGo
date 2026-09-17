from django.contrib.gis.geos import MultiPolygon, Polygon
from django.test import TestCase

from apps.business.models import ServiceableBoundary
from apps.business.services.serviceable_boundary_service import (
    ServiceableBoundaryService,
)


class ServiceableBoundaryServiceTests(TestCase):
    """Tests authoritative active service-area spatial queries."""

    def setUp(self):
        self.active_boundary = ServiceableBoundary.objects.create(
            SBND_NAME="Active Boundary",
            SBND_IS_ACTIVE=True,
            SBND_BOUNDARY=self._make_boundary(
                minimum_longitude=123.87,
                minimum_latitude=10.30,
                maximum_longitude=123.92,
                maximum_latitude=10.34,
            ),
        )

    @staticmethod
    def _make_boundary(
        minimum_longitude,
        minimum_latitude,
        maximum_longitude,
        maximum_latitude,
    ):
        """Build a rectangular multipolygon for spatial tests."""

        return MultiPolygon(
            Polygon(
                (
                    (minimum_longitude, minimum_latitude),
                    (maximum_longitude, minimum_latitude),
                    (maximum_longitude, maximum_latitude),
                    (minimum_longitude, maximum_latitude),
                    (minimum_longitude, minimum_latitude),
                ),
                srid=4326,
            ),
        )

    def test_point_inside_active_boundary_is_serviceable(self):
        self.assertTrue(
            ServiceableBoundaryService.is_serviceable(
                latitude=10.32,
                longitude=123.89,
            )
        )

    def test_point_outside_active_boundary_is_not_serviceable(self):
        self.assertFalse(
            ServiceableBoundaryService.is_serviceable(
                latitude=10.50,
                longitude=124.00,
            )
        )

    def test_point_on_active_boundary_edge_is_serviceable(self):
        self.assertTrue(
            ServiceableBoundaryService.is_serviceable(
                latitude=10.32,
                longitude=123.87,
            )
        )

    def test_inactive_boundary_is_ignored(self):
        ServiceableBoundary.objects.create(
            SBND_NAME="Inactive Boundary",
            SBND_IS_ACTIVE=False,
            SBND_BOUNDARY=self._make_boundary(
                minimum_longitude=124.00,
                minimum_latitude=10.40,
                maximum_longitude=124.10,
                maximum_latitude=10.50,
            ),
        )

        self.assertFalse(
            ServiceableBoundaryService.is_serviceable(
                latitude=10.45,
                longitude=124.05,
            )
        )

    def test_active_extent_covers_all_active_boundaries_only(self):
        ServiceableBoundary.objects.create(
            SBND_NAME="Second Active Boundary",
            SBND_IS_ACTIVE=True,
            SBND_BOUNDARY=self._make_boundary(
                minimum_longitude=123.95,
                minimum_latitude=10.35,
                maximum_longitude=124.05,
                maximum_latitude=10.45,
            ),
        )
        ServiceableBoundary.objects.create(
            SBND_NAME="Inactive Outlier",
            SBND_IS_ACTIVE=False,
            SBND_BOUNDARY=self._make_boundary(
                minimum_longitude=125.00,
                minimum_latitude=11.00,
                maximum_longitude=126.00,
                maximum_latitude=12.00,
            ),
        )

        self.assertEqual(
            ServiceableBoundaryService.get_active_extent(),
            (123.87, 10.30, 124.05, 10.45),
        )
