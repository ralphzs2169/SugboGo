from apps.business.models import ServiceableBoundary
from apps.merchant_application.models import (
    MerchantApplicationLandmark,
    MerchantApplicationLocation,
)
from apps.merchant_application.services.location_service import LocationService
from apps.merchant_application.tests.test_services import (
    MerchantApplicationServiceMixin,
)
from django.contrib.gis.geos import MultiPolygon, Point, Polygon
from django.test import TestCase
from rest_framework.exceptions import ValidationError


class LocationServiceTests(MerchantApplicationServiceMixin, TestCase):
   
    def setUp(self):
        super().setUp()

        self.serviceable_boundary = ServiceableBoundary.objects.create(
            SBND_NAME="Cebu City Test Boundary",
            SBND_IS_ACTIVE=True,
            SBND_BOUNDARY=MultiPolygon(
                Polygon(
                    (
                        (123.87, 10.30),
                        (123.92, 10.30),
                        (123.92, 10.34),
                        (123.87, 10.34),
                        (123.87, 10.30),
                    ),
                    srid=4326,
                )
            ),
        )

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

    def test_save_location_updates_only_submitted_fields(self):
        application, _ = self._create_identity()

        original_location = LocationService.save_location(
            application,
            self._location_payload(),
        )

        original_point = original_location.MLOC_POINT

        LocationService.save_location(
            application,
            {
                "MLOC_CITY": "Mandaue City",
            },
        )

        original_location.refresh_from_db()

        self.assertEqual(
            original_location.MLOC_PROVINCE,
            "Cebu",
        )

        self.assertEqual(
            original_location.MLOC_CITY,
            "Mandaue City",
        )

        self.assertEqual(
            original_location.MLOC_BARANGAY,
            "Lahug",
        )

        self.assertEqual(
            original_location.MLOC_POINT,
            original_point,
        )

    def test_save_location_updates_coordinates(self):
        application, _ = self._create_identity()

        location = LocationService.save_location(
            application,
            self._location_payload(),
        )

        LocationService.save_location(
            application,
            {
                "latitude": 10.3200,
                "longitude": 123.8900,
            },
        )

        location.refresh_from_db()

        self.assertEqual(
            location.MLOC_POINT,
            Point(123.8900, 10.3200, srid=4326),
        )

    def test_save_location_replaces_landmarks_when_landmarks_are_provided(self):
        application, _ = self._create_identity()

        location = LocationService.save_location(
            application,
            self._location_payload(),
        )

        self.assertEqual(location.landmarks.count(), 2)

        LocationService.save_location(
            application,
            {
                "landmarks": [
                    {
                        "MLMK_NAME": "New Landmark",
                        "MLMK_ADDRESS": "New Address",
                        "latitude": 10.3200,
                        "longitude": 123.8900,
                        "MLMK_SOURCE": MerchantApplicationLandmark.LandmarkSource.CUSTOM,
                        "MLMK_PLACE_ID": None,
                    },
                ],
            },
        )

        location.refresh_from_db()

        self.assertEqual(
            location.landmarks.count(),
            1,
        )

        landmark = location.landmarks.first()

        self.assertEqual(
            landmark.MLMK_NAME,
            "New Landmark",
        )


    def test_save_location_preserves_landmarks_when_landmarks_are_omitted(self):
        application, _ = self._create_identity()

        location = LocationService.save_location(
            application,
            self._location_payload(),
        )

        original_landmark_ids = set(
            location.landmarks.values_list(
                "MLMK_ID",
                flat=True,
            )
        )

        LocationService.save_location(
            application,
            {
                "MLOC_CITY": "Mandaue City",
            },
        )

        location.refresh_from_db()

        self.assertEqual(
            set(
                location.landmarks.values_list(
                    "MLMK_ID",
                    flat=True,
                )
            ),
            original_landmark_ids,
        )

        self.assertEqual(
            location.landmarks.count(),
            2,
        )

    def test_save_location_rejects_location_outside_service_area(self):
        application, _ = self._create_identity()

        with self.assertRaises(ValidationError) as context:
            LocationService.save_location(
                application,
                {
                    **self._location_payload(),
                    "latitude": 10.5000,
                    "longitude": 124.0000,
                },
            )

        self.assertIn(
            "outside our current service area",
            str(context.exception),
        )

        self.assertFalse(
            MerchantApplicationLocation.objects.filter(
                MAPP_ID=application,
            ).exists(),
        )