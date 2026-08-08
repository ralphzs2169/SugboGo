from django.urls import reverse
from rest_framework.test import APITestCase

from apps.merchant_application.models import MerchantApplicationOperatingHours
from apps.merchant_application.tests.test_services import (
    MerchantApplicationServiceMixin,
)
from core.tests.assertions import APIResponseAssertionsMixin


class OperatingHoursViewTests(
    MerchantApplicationServiceMixin,
    APIResponseAssertionsMixin,
    APITestCase,
):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.user)
        self.url = reverse("application-operating-hours")
        self.valid_payload = {
            "hours": self._hours_payload(),
        }

    def test_operating_hours_save_returns_not_found_when_step_one_is_missing(self):
        response = self.client.put(
            self.url,
            self.valid_payload,
            format="json",
        )

        self.assertErrorResponse(
            response,
            message="Complete Step 1 (Business Identity) before setting hours.",
            code="APPLICATION_NOT_FOUND",
            status_code=404,
        )

    def test_operating_hours_save_creates_full_week_of_hours(self):
        application, _ = self._create_identity()
        self._create_location(application)

        response = self.client.put(
            self.url,
            self.valid_payload,
            format="json",
        )

        self.assertSuccessResponse(
            response,
            message="Operating hours saved successfully.",
        )

        self.assertEqual(
            len(response.data["data"]),
            7,
        )

        self.assertEqual(
            MerchantApplicationOperatingHours.objects.count(),
            7,
        )