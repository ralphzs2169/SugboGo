from django.urls import reverse
from rest_framework.test import APITestCase

from apps.merchant_application.models import MerchantApplication
from apps.merchant_application.tests.test_services import (
    MerchantApplicationServiceMixin,
)
from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin


class ReviewViewTests(
    MerchantApplicationServiceMixin,
    APIResponseAssertionsMixin,
    APITestCase,
):
    def setUp(self):
        super().setUp()
        self.admin = User.objects.create_user(
            email="admin@example.com",
            password="StrongPassword123!",
            USER_FNAME="Admin",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.client.force_authenticate(user=self.admin)
        self.url = reverse("application-review", args=[1])

    def test_application_review_rejects_non_admin_users(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            self.url,
            {"action": "approve"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_application_review_approves_submitted_application(self):
        application = self._build_complete_application()
        application.MAPP_STATUS = MerchantApplication.ApplicationStatus.SUBMITTED
        application.save()

        response = self.client.patch(
            reverse("application-review", args=[application.MAPP_ID]),
            {"action": "approve"},
            format="json",
        )

        self.assertSuccessResponse(
            response,
            message="Application reviewed successfully.",
        )

        self.assertEqual(
            response.data["data"]["status"],
            MerchantApplication.ApplicationStatus.APPROVED,
        )

        application.refresh_from_db()

        self.assertEqual(
            application.MAPP_STATUS,
            MerchantApplication.ApplicationStatus.APPROVED,
        )