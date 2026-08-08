from django.urls import reverse
from rest_framework.test import APITestCase

from apps.merchant_application.models import MerchantApplication
from apps.merchant_application.services.application_service import (
    ApplicationService,
)
from apps.merchant_application.tests.test_services import (
    MerchantApplicationServiceMixin,
)
from core.tests.assertions import APIResponseAssertionsMixin


class ApplicationViewTests(
    MerchantApplicationServiceMixin,
    APIResponseAssertionsMixin,
    APITestCase,
):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.user)
        self.detail_url = reverse("application-detail")
        self.submit_url = reverse("application-submit")
        self.status_url = reverse("application-status")

    def test_application_detail_returns_not_found_when_no_application_exists(self):
        response = self.client.get(self.detail_url)

        self.assertErrorResponse(
            response,
            message="No application found. Start by submitting your business identity.",
            code="APPLICATION_NOT_FOUND",
            status_code=404,
        )

    def test_application_status_returns_empty_message_when_no_application_exists(self):
        response = self.client.get(self.status_url)

        self.assertSuccessResponse(
            response,
            message="No merchant application found.",
        )

        self.assertIsNone(
            response.data["data"],
        )

    def test_application_detail_returns_current_application(self):
        application = MerchantApplication.objects.create(USER_ID=self.user)

        response = self.client.get(self.detail_url)

        self.assertSuccessResponse(
            response,
            message="Application retrieved successfully.",
        )

        self.assertEqual(
            response.data["data"]["id"],
            application.MAPP_ID,
        )

        self.assertEqual(
            response.data["data"]["status"],
            MerchantApplication.ApplicationStatus.DRAFT,
        )

    def test_application_submit_returns_not_found_when_no_application_exists(self):
        response = self.client.post(self.submit_url, {}, format="json")

        self.assertErrorResponse(
            response,
            message="No application found to submit.",
            code="APPLICATION_NOT_FOUND",
            status_code=404,
        )

    def test_application_submit_submits_complete_application(self):
        application = self._build_complete_application()

        response = self.client.post(self.submit_url, {}, format="json")

        self.assertSuccessResponse(
            response,
            message="Application submitted successfully.",
        )

        application.refresh_from_db()

        self.assertEqual(
            application.MAPP_STATUS,
            MerchantApplication.ApplicationStatus.SUBMITTED,
        )

        self.assertEqual(
            response.data["data"]["status"],
            MerchantApplication.ApplicationStatus.SUBMITTED,
        )