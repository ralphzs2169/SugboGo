from django.contrib.gis.geos import Point
from django.test import TestCase
from rest_framework.exceptions import ValidationError

from apps.merchant_application.models import MerchantApplicationLocation
from apps.merchant_application.services.location_service import LocationService
from apps.merchant_application.tests.test_services import (
    MerchantApplicationServiceMixin,
)


class LocationServiceTests(MerchantApplicationServiceMixin, TestCase):
    def test_save_location_creates_location_and_landmarks(self):
        application, _ = self._create_identity()

        location = LocationService.save_location(
            application,
            self._location_payload(),
        )

        application.refresh_from_db()
        location.refresh_from_db()

        self.assertEqual(
            location.MLOC_PROVINCE,
            "Cebu",
        )

        self.assertEqual(
            location.MLOC_POINT,
            Point(123.8854, 10.3157, srid=4326),
        )

        self.assertEqual(
            location.landmarks.count(),
            2,
        )

        self.assertEqual(
            application.MAPP_HIGHEST_COMPLETED_STEP,
            2,
        )

    def test_save_location_requires_coordinates_on_first_save(self):
        application, _ = self._create_identity()

        with self.assertRaises(ValidationError):
            LocationService.save_location(
                application,
                {
                    "MLOC_PROVINCE": "Cebu",
                    "MLOC_CITY": "Cebu City",
                    "MLOC_BARANGAY": "Lahug",
                    "MLOC_STREET_ADDRESS": "Gorordo Avenue",
                },
            )

        self.assertFalse(
            MerchantApplicationLocation.objects.filter(
                MAPP_ID=application,
            ).exists()
        )