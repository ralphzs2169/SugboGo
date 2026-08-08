from rest_framework.exceptions import ValidationError
from django.test import TestCase

from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationFeedback,
)
from apps.merchant_application.services.application_service import ApplicationService
from apps.merchant_application.tests.test_services import (
    MerchantApplicationServiceMixin,
)


class ApplicationServiceTests(MerchantApplicationServiceMixin, TestCase):
    def test_validate_application_editable_allows_draft_and_rejected(self):
        application = MerchantApplication.objects.create(USER_ID=self.user)

        for status in (
            MerchantApplication.ApplicationStatus.DRAFT,
            MerchantApplication.ApplicationStatus.REJECTED,
        ):
            application.MAPP_STATUS = status

            ApplicationService.validate_application_editable(application)

    def test_validate_application_editable_rejects_submitted_and_approved(self):
        application = MerchantApplication.objects.create(USER_ID=self.user)

        for status in (
            MerchantApplication.ApplicationStatus.SUBMITTED,
            MerchantApplication.ApplicationStatus.APPROVED,
        ):
            application.MAPP_STATUS = status

            with self.subTest(status=status), self.assertRaises(ValidationError):
                ApplicationService.validate_application_editable(
                    application,
                )

    def test_validate_application_for_submission_reports_missing_sections(self):
        application = MerchantApplication.objects.create(USER_ID=self.user)

        with self.assertRaises(ValidationError) as context:
            ApplicationService.validate_application_for_submission(
                application,
            )

        self.assertIn("identity", context.exception.detail)
        self.assertIn("location", context.exception.detail)
        self.assertIn("operating_hours", context.exception.detail)
        self.assertIn("photos", context.exception.detail)
        self.assertIn("documents", context.exception.detail)

    def test_submit_application_resubmits_rejected_application_and_clears_feedback(self):
        application = self._build_complete_application()

        application.MAPP_STATUS = MerchantApplication.ApplicationStatus.REJECTED
        application.MAPP_REJECTION_REASON = "Please fix the business name."
        application.save()

        MerchantApplicationFeedback.objects.create(
            MAPP_ID=application,
            MAPF_SECTION=MerchantApplicationFeedback.Section.IDENTITY,
            MAPF_MESSAGE="Use the registered business name.",
        )

        submitted_application = ApplicationService.submit_application(
            application,
        )

        submitted_application.refresh_from_db()

        self.assertEqual(
            submitted_application.MAPP_STATUS,
            MerchantApplication.ApplicationStatus.SUBMITTED,
        )

        self.assertIsNotNone(
            submitted_application.MAPP_SUBMITTED_AT,
        )

        self.assertIsNone(
            submitted_application.MAPP_REVIEWED_AT,
        )

        self.assertIsNone(
            submitted_application.MAPP_REJECTION_REASON,
        )

        self.assertEqual(
            submitted_application.feedback.count(),
            0,
        )

    def test_review_application_approves_submitted_application(self):
        application = self._build_complete_application()
        application.MAPP_STATUS = MerchantApplication.ApplicationStatus.SUBMITTED
        application.save()

        MerchantApplicationFeedback.objects.create(
            MAPP_ID=application,
            MAPF_SECTION=MerchantApplicationFeedback.Section.PHOTOS,
            MAPF_MESSAGE="This feedback should be removed on approval.",
        )

        reviewed_application = ApplicationService.review_application(
            application,
            action="approve",
        )

        reviewed_application.refresh_from_db()

        self.assertEqual(
            reviewed_application.MAPP_STATUS,
            MerchantApplication.ApplicationStatus.APPROVED,
        )

        self.assertIsNotNone(
            reviewed_application.MAPP_REVIEWED_AT,
        )

        self.assertIsNone(
            reviewed_application.MAPP_REJECTION_REASON,
        )

        self.assertEqual(
            reviewed_application.feedback.count(),
            0,
        )

    def test_review_application_rejects_submitted_application_with_feedback(self):
        application = self._build_complete_application()
        application.MAPP_STATUS = MerchantApplication.ApplicationStatus.SUBMITTED
        application.save()

        reviewed_application = ApplicationService.review_application(
            application,
            action="reject",
            rejection_reason="Please add a clearer storefront photo.",
            feedback=[
                {
                    "section": MerchantApplicationFeedback.Section.PHOTOS,
                    "message": "Upload one clear storefront photo.",
                },
                {
                    "section": MerchantApplicationFeedback.Section.DOCUMENTS,
                    "message": "Attach the business registration document.",
                },
            ],
        )

        reviewed_application.refresh_from_db()

        self.assertEqual(
            reviewed_application.MAPP_STATUS,
            MerchantApplication.ApplicationStatus.REJECTED,
        )

        self.assertIsNotNone(
            reviewed_application.MAPP_REVIEWED_AT,
        )

        self.assertEqual(
            reviewed_application.MAPP_REJECTION_REASON,
            "Please add a clearer storefront photo.",
        )

        self.assertEqual(
            reviewed_application.feedback.count(),
            2,
        )