from django.db import IntegrityError, transaction
from django.urls import reverse
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from apps.merchant_application.models import MerchantApplication
from apps.merchant_application.services.application_service import ApplicationService
from apps.users.models import User


class MerchantApplicationLifecycleTests(APITestCase):
    def setUp(self):
        self.merchant = User.objects.create_user(
            email="merchant-lifecycle@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Lifecycle",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.admin = User.objects.create_user(
            email="admin-lifecycle@example.com",
            password="StrongPassword123!",
            USER_FNAME="Admin",
            USER_LNAME="Lifecycle",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

    def test_user_can_have_only_one_application(self):
        MerchantApplication.objects.create(USER_ID=self.merchant)

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                MerchantApplication.objects.create(USER_ID=self.merchant)

    def test_submitted_and_approved_applications_are_not_editable(self):
        for status in (
            MerchantApplication.ApplicationStatus.SUBMITTED,
            MerchantApplication.ApplicationStatus.APPROVED,
        ):
            application = MerchantApplication.objects.create(
                USER_ID=self.merchant,
                MAPP_STATUS=status,
            )

            with self.assertRaises(ValidationError):
                ApplicationService.validate_application_editable(application)

            application.delete()

    def test_admin_can_reject_submitted_application_with_feedback(self):
        application = MerchantApplication.objects.create(
            USER_ID=self.merchant,
            MAPP_STATUS=MerchantApplication.ApplicationStatus.SUBMITTED,
        )
        self.client.force_authenticate(self.admin)

        response = self.client.patch(
            reverse("application-review", args=[application.MAPP_ID]),
            {
                "action": "reject",
                "rejection_reason": "Please correct the business identity.",
                "feedback": [
                    {
                        "section": "identity",
                        "message": "Use the legal business name.",
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        application.refresh_from_db()
        self.assertEqual(
            application.MAPP_STATUS,
            MerchantApplication.ApplicationStatus.REJECTED,
        )
        self.assertEqual(application.feedback.count(), 1)

    def test_review_requires_submitted_application(self):
        application = MerchantApplication.objects.create(USER_ID=self.merchant)
        self.client.force_authenticate(self.admin)

        response = self.client.patch(
            reverse("application-review", args=[application.MAPP_ID]),
            {"action": "approve"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])
