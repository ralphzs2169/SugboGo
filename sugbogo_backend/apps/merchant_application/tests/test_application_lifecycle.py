from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationReview,
)
from apps.merchant_application.serializers.identity_serializers import (
    ApplicationIdentitySerializer,
)
from apps.merchant_application.services.application_service import ApplicationService
from apps.users.models import User
from django.db import IntegrityError, transaction
from django.urls import reverse
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase


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

        response = self.client.post(
            reverse(
                "merchant-application-reject",
                args=[application.MAPP_ID],
            ),
            {
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

        review = MerchantApplicationReview.objects.get(
            MAPP_ID=application,
            MAREV_DECISION=MerchantApplicationReview.Decision.REJECTED,
        )

        self.assertEqual(review.feedback.count(), 1)
        

    def test_first_identity_save_requires_a_complete_payload(self):
        self.client.force_authenticate(self.merchant)

        response = self.client.patch(
            reverse("application-identity"),
            {},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])
        self.assertFalse(
            MerchantApplication.objects.filter(USER_ID=self.merchant).exists()
        )

    def test_first_location_save_requires_a_complete_payload(self):
        MerchantApplication.objects.create(USER_ID=self.merchant)
        self.client.force_authenticate(self.merchant)

        response = self.client.patch(
            reverse("application-location"),
            {},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])

    def test_identity_validation_matches_mobile_description_and_phone_rules(self):
        serializer = ApplicationIdentitySerializer(
            data={
                "business_name": "Sample Business",
                "business_description": "",
                "contact_number": "09123456789",
                "representative_name": "Jane Doe",
                "representative_role": "owner",
                "business_cluster_id": 1,
                "business_category_id": 1,
                "specialty_tags": [1, 2, 3],
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("business_description", serializer.errors)

    def test_progress_is_lowered_when_saved_requirements_are_missing(self):
        application = MerchantApplication.objects.create(
            USER_ID=self.merchant,
            MAPP_HIGHEST_COMPLETED_STEP=4,
        )

        ApplicationService.mark_step_completed(application, step=4)
        application.refresh_from_db()

        self.assertEqual(application.MAPP_HIGHEST_COMPLETED_STEP, 0)


    def test_admin_can_approve_submitted_application(self):
        application = MerchantApplication.objects.create(
            USER_ID=self.merchant,
            MAPP_STATUS=MerchantApplication.ApplicationStatus.SUBMITTED,
        )

        self.client.force_authenticate(self.admin)

        response = self.client.post(
            reverse(
                "merchant-application-approve",
                args=[application.MAPP_ID],
            ),
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])

        application.refresh_from_db()

        self.assertEqual(
            application.MAPP_STATUS,
            MerchantApplication.ApplicationStatus.APPROVED,
        )


    def test_admin_cannot_reject_non_submitted_application(self):
        application = MerchantApplication.objects.create(
            USER_ID=self.merchant,
            MAPP_STATUS=MerchantApplication.ApplicationStatus.DRAFT,
        )

        self.client.force_authenticate(self.admin)

        response = self.client.post(
            reverse(
                "merchant-application-reject",
                args=[application.MAPP_ID],
            ),
            {
                "feedback": [
                    {
                        "section": "identity",
                        "message": "Use the legal business name.",
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])


    def test_admin_cannot_approve_non_submitted_application(self):
        application = MerchantApplication.objects.create(
            USER_ID=self.merchant,
            MAPP_STATUS=MerchantApplication.ApplicationStatus.DRAFT,
        )

        self.client.force_authenticate(self.admin)

        response = self.client.post(
            reverse(
                "merchant-application-approve",
                args=[application.MAPP_ID],
            ),
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])