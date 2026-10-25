
"""Shared synthetic boundary fixtures for transit authoring tests."""

from django.contrib.gis.geos import MultiPolygon, Polygon

from apps.business.models import ServiceableBoundary


class TransitBoundaryTestMixin:
    """Supply a test-only polygon, never operational Cebu City geometry."""

    @classmethod
    def setUpTestData(cls):
        """Create the required boundary before each test class builds its network."""
        super().setUpTestData()
        ServiceableBoundary.objects.create(
            SBND_NAME="Cebu City",
            SBND_PSGC_CODE="072217000",
            SBND_BOUNDARY=MultiPolygon(
                Polygon.from_bbox((123.0, 10.0, 124.0, 11.0)), srid=4326,
            ),
        )
