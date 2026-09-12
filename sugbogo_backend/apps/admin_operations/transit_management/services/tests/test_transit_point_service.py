from django.contrib.gis.geos import Point
from django.test import TestCase
from rest_framework.exceptions import NotFound

from apps.admin_operations.transit_management.services.transit_point_service import (
    TransitPointService,
)


class TransitPointServiceTests(TestCase):
    """Test administrator Transit Point operations."""

    def test_transit_point_create_list_detail_and_update(self):
        """Manage Transit Points while preserving longitude/latitude order."""

        point = TransitPointService.create_transit_point(
            {
                "name": "Fuente",
                "longitude": 123.8958,
                "latitude": 10.3103,
            },
        )

        updated_point = TransitPointService.update_transit_point(
            point.TRPT_ID,
            {
                "name": "Fuente Osmena",
                "longitude": 123.8960,
                "latitude": 10.3105,
            },
        )

        self.assertTrue(
            TransitPointService.list_transit_points(
                search="Fuente",
            ).filter(
                TRPT_ID=point.TRPT_ID,
            ).exists(),
        )
        self.assertEqual(
            TransitPointService.get_transit_point(
                point.TRPT_ID,
            ).TRPT_ID,
            point.TRPT_ID,
        )
        self.assertEqual(
            updated_point.TRPT_POINT,
            Point(
                x=123.8960,
                y=10.3105,
                srid=4326,
            ),
        )

    def test_missing_transit_point_raises_not_found(self):
        """Raise a controlled error for an unknown Transit Point."""

        with self.assertRaises(NotFound):
            TransitPointService.get_transit_point(999999)
