from apps.merchant_application.models import MerchantApplicationLocation
from apps.merchant_application.tests.test_services import (
    MerchantApplicationServiceMixin,
)
from core.tests.assertions import APIResponseAssertionsMixin
from django.urls import reverse
from rest_framework.test import APITestCase


class ApplicationLocationViewTests(
    MerchantApplicationServiceMixin,
    APIResponseAssertionsMixin,
    APITestCase,
):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.user)
        self.url = reverse("application-location")
        self.valid_payload = {
            "province": "Cebu",
            "city": "Cebu City",
            "barangay": "Lahug",
            "street_address": "Gorordo Avenue",
            "unit": "Unit 4B",
            "latitude": 10.3157,
            "longitude": 123.8854,
            "landmarks": [
                {
                    "name": "Ayala Center Cebu",
                    "address": "Cebu Business Park, Cebu City",
                    "latitude": 10.3150,
                    "longitude": 123.9056,
                    "source": "google",
                    "place_id": "ChIJ123",
                }
            ],
        }

    def test_location_save_returns_not_found_when_step_one_is_missing(self):
        response = self.client.patch(
            self.url,
            self.valid_payload,
            format="json",
        )

        self.assertErrorResponse(
            response,
            message="Complete Step 1 (Business Identity) before adding a location.",
            code="APPLICATION_NOT_FOUND",
            status_code=404,
        )

    def test_location_save_creates_location_and_landmarks(self):
        self._create_identity()

        response = self.client.patch(
            self.url,
            self.valid_payload,
            format="json",
        )

        self.assertSuccessResponse(
            response,
            message="Location and landmarks saved successfully.",
        )

        self.assertEqual(
            response.data["data"]["province"],
            "Cebu",
        )

        self.assertEqual(
            MerchantApplicationLocation.objects.count(),
            1,
        )

    def test_location_save_updates_existing_location_partially(self):
        self._create_identity()

        self.client.patch(
            self.url,
            self.valid_payload,
            format="json",
        )

        response = self.client.patch(
            self.url,
            {
                "city": "Mandaue City",
            },
            format="json",
        )

        self.assertSuccessResponse(
            response,
            message="Location and landmarks saved successfully.",
        )

        self.assertEqual(
            response.data["data"]["province"],
            "Cebu",
        )

        self.assertEqual(
            response.data["data"]["city"],
            "Mandaue City",
        )


    def test_location_save_rejects_missing_coordinates_on_first_save(self):
        self._create_identity()

        payload = {
            "province": "Cebu",
            "city": "Cebu City",
            "barangay": "Lahug",
            "street_address": "Gorordo Avenue",
        }

        response = self.client.patch(
            self.url,
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            400,
        )

        self.assertFalse(
            MerchantApplicationLocation.objects.filter(
                MAPP_ID__USER_ID=self.user,
            ).exists()
        )


    def test_location_save_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.patch(
            self.url,
            self.valid_payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            401,
        )

    def test_arrival_details_save_and_read_back_without_publishing_business(self):
        application, _ = self._create_identity()
        self.valid_payload["landmarks"][0].update(
            is_arrival_point=True,
            access_directions="  Enter the green gate beside the bakery.  ",
        )
        response = self.client.patch(self.url, self.valid_payload, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["data"]["landmarks"][0]["is_arrival_point"])
        self.assertEqual(response.data["data"]["landmarks"][0]["access_directions"], "Enter the green gate beside the bakery.")
        application.refresh_from_db()
        self.assertIsNone(application.BUSN_ID)
        landmark = application.location.landmarks.get()
        self.assertTrue(landmark.MLMK_IS_ARRIVAL_POINT)
        from apps.merchant_application.serializers.application_location_serializers import ApplicationLocationReadSerializer
        self.assertEqual(ApplicationLocationReadSerializer(application.location).data["landmarks"][0]["access_directions"], landmark.MLMK_ACCESS_DIRECTIONS)

    def test_arrival_selection_rejects_blank_directions(self):
        self._create_identity()
        self.valid_payload["landmarks"][0].update(is_arrival_point=True, access_directions="   ")
        response = self.client.patch(self.url, self.valid_payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(MerchantApplicationLocation.objects.exists())

    def test_arrival_selection_rejects_multiple_landmarks(self):
        self._create_identity()
        landmark = self.valid_payload["landmarks"][0]
        landmark.update(is_arrival_point=True, access_directions="Enter the green gate.")
        self.valid_payload["landmarks"].append({**landmark, "name": "Other landmark"})
        response = self.client.patch(self.url, self.valid_payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(MerchantApplicationLocation.objects.exists())

    def test_ordinary_landmark_discards_access_directions(self):
        self._create_identity()
        self.valid_payload["landmarks"][0]["access_directions"] = "Unused notes"
        response = self.client.patch(self.url, self.valid_payload, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["data"]["landmarks"][0]["is_arrival_point"])
        self.assertEqual(response.data["data"]["landmarks"][0]["access_directions"], "")
