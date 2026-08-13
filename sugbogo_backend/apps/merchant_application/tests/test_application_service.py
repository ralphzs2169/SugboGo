from datetime import timedelta

from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationFeedback,
    MerchantApplicationReview,
)
from apps.merchant_application.services.application_service import (
    ApplicationService,
)
from apps.merchant_application.tests.test_services import (
    MerchantApplicationServiceMixin,
)
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError


class ApplicationServiceTests(MerchantApplicationServiceMixin, TestCase):
    def test_validate_application_editable_allows_draft_and_rejected(self):
        application = MerchantApplication.objects.create(
            USER_ID=self.user,
        )

        for status in (
            MerchantApplication.ApplicationStatus.DRAFT,
            MerchantApplication.ApplicationStatus.REJECTED,
        ):
            application.MAPP_STATUS = status

            ApplicationService.validate_application_editable(application)

    def test_validate_application_editable_rejects_submitted_and_approved(self):
        application = MerchantApplication.objects.create(
            USER_ID=self.user,
        )

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
        application = MerchantApplication.objects.create(
            USER_ID=self.user,
        )

        with self.assertRaises(ValidationError) as context:
            ApplicationService.validate_application_for_submission(
                application,
            )

        self.assertIn("identity", context.exception.detail)
        self.assertIn("location", context.exception.detail)
        self.assertIn("operating_hours", context.exception.detail)
        self.assertIn("photos", context.exception.detail)
        self.assertIn("documents", context.exception.detail)

    def test_submit_application_submits_complete_draft_application(self):
        application = self._build_complete_application()

        self.assertEqual(
            application.MAPP_STATUS,
            MerchantApplication.ApplicationStatus.DRAFT,
        )
        self.assertEqual(application.MAPP_SUBMISSION_COUNT, 0)

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

        self.assertEqual(
            submitted_application.MAPP_SUBMISSION_COUNT,
            1,
        )

    def test_submit_application_resubmits_rejected_application(self):
        application = self._build_complete_application()

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.REJECTED
        )
    
        application.save(
            update_fields=[
                "MAPP_STATUS",
                "MAPP_UPDATED_AT",
            ]
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

        self.assertEqual(
            submitted_application.MAPP_SUBMISSION_COUNT,
            1,
        )

    def test_submit_application_increments_submission_count_on_resubmission(self):
        application = self._build_complete_application()

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.REJECTED
        )
        application.MAPP_SUBMISSION_COUNT = 1
        application.save(
            update_fields=[
                "MAPP_STATUS",
                "MAPP_SUBMISSION_COUNT",
                "MAPP_UPDATED_AT",
            ]
        )

        submitted_application = ApplicationService.submit_application(
            application,
        )

        submitted_application.refresh_from_db()

        self.assertEqual(
            submitted_application.MAPP_STATUS,
            MerchantApplication.ApplicationStatus.SUBMITTED,
        )

        self.assertEqual(
            submitted_application.MAPP_SUBMISSION_COUNT,
            2,
        )

    def test_submit_application_rejects_submitted_application(self):
        application = self._build_complete_application()

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.SUBMITTED
        )
        application.save(
            update_fields=[
                "MAPP_STATUS",
                "MAPP_UPDATED_AT",
            ]
        )

        with self.assertRaises(ValidationError):
            ApplicationService.submit_application(application)

        application.refresh_from_db()

        self.assertEqual(
            application.MAPP_STATUS,
            MerchantApplication.ApplicationStatus.SUBMITTED,
        )

        self.assertEqual(
            application.MAPP_SUBMISSION_COUNT,
            0,
        )

    def test_submit_application_rejects_approved_application(self):
        application = self._build_complete_application()

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.APPROVED
        )
        application.save(
            update_fields=[
                "MAPP_STATUS",
                "MAPP_UPDATED_AT",
            ]
        )

        with self.assertRaises(ValidationError):
            ApplicationService.submit_application(application)

        application.refresh_from_db()

        self.assertEqual(
            application.MAPP_STATUS,
            MerchantApplication.ApplicationStatus.APPROVED,
        )

        self.assertEqual(
            application.MAPP_SUBMISSION_COUNT,
            0,
        )

    def test_submit_application_rejects_resubmission_when_feedback_section_is_unchanged(
        self,
    ):
        application = self._build_complete_application()

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.REJECTED
        )
        application.save(
            update_fields=[
                "MAPP_STATUS",
                "MAPP_UPDATED_AT",
            ]
        )
        reviewed_at = timezone.now()

        review = MerchantApplicationReview.objects.create(
            MAPP_ID=application,
            USER_ID=self.user,
            MAREV_DECISION=MerchantApplicationReview.Decision.REJECTED,
            MAREV_REVIEWED_AT=reviewed_at,
        )

        MerchantApplicationFeedback.objects.create(
            MAREV_ID=review,
            MAPF_SECTION=MerchantApplicationFeedback.Section.IDENTITY,
            MAPF_MESSAGE="Update your business identity.",
        )

        with self.assertRaises(ValidationError) as context:
            ApplicationService.submit_application(application)

        self.assertIn(
            "resubmission",
            context.exception.detail,
        )

    def test_submit_application_allows_resubmission_after_feedback_section_is_updated(
        self,
    ):
        application = self._build_complete_application()

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.REJECTED
        )
        application.save(
            update_fields=[
                "MAPP_STATUS",
                "MAPP_UPDATED_AT",
            ]
        )

        reviewed_at = timezone.now()

        review = MerchantApplicationReview.objects.create(
            MAPP_ID=application,
            USER_ID=self.user,
            MAREV_DECISION=MerchantApplicationReview.Decision.REJECTED,
            MAREV_REVIEWED_AT=reviewed_at,
        )

        MerchantApplicationFeedback.objects.create(
            MAREV_ID=review,
            MAPF_SECTION=MerchantApplicationFeedback.Section.IDENTITY,
            MAPF_MESSAGE="Update your business identity.",
        )

        application.MAPP_IDENTITY_UPDATED_AT = (
            reviewed_at + timedelta(seconds=1)
        )

        application.save(
            update_fields=[
                "MAPP_IDENTITY_UPDATED_AT",
                "MAPP_UPDATED_AT",
            ]
        )

        submitted_application = ApplicationService.submit_application(
            application,
        )

        submitted_application.refresh_from_db()

        self.assertEqual(
            submitted_application.MAPP_STATUS,
            MerchantApplication.ApplicationStatus.SUBMITTED,
        )

        self.assertEqual(
            submitted_application.MAPP_SUBMISSION_COUNT,
            1,
        )


    def test_get_highest_completed_step_returns_zero_when_identity_is_incomplete(self):
        application = MerchantApplication.objects.create(
            USER_ID=self.user,
        )

        self.assertEqual(
            ApplicationService.get_highest_completed_step(application),
            0,
        )

    def test_get_highest_completed_step_returns_correct_step_for_incomplete_sections(
        self,
    ):
        application = self._build_complete_application()

        self.assertEqual(
            ApplicationService.get_highest_completed_step(application),
            5,
        )

        # Documents incomplete → Step 4 is the highest completed step.
        application.documents.all().delete()
        application.refresh_from_db()

        self.assertEqual(
            ApplicationService.get_highest_completed_step(application),
            4,
        )

        # Photos incomplete → Step 3 is the highest completed step.
        application.photos.all().delete()
        application.refresh_from_db()

        self.assertEqual(
            ApplicationService.get_highest_completed_step(application),
            3,
        )

        # Operating hours incomplete → Step 2 is the highest completed step.
        application.operating_hours.all().delete()
        application.refresh_from_db()

        self.assertEqual(
            ApplicationService.get_highest_completed_step(application),
            2,
        )

        # Location incomplete → Step 1 is the highest completed step.
        application.location.delete()
        application.refresh_from_db()

        self.assertEqual(
            ApplicationService.get_highest_completed_step(application),
            1,
        )

        # Identity incomplete → Step 0 is the highest completed step.
        application.identity.delete()
        application.refresh_from_db()

        self.assertEqual(
            ApplicationService.get_highest_completed_step(application),
            0,
        )

    def test_mark_step_completed_persists_highest_completed_step(self):
        application = self._build_complete_application()

        application.MAPP_HIGHEST_COMPLETED_STEP = 0
        application.save(
            update_fields=[
                "MAPP_HIGHEST_COMPLETED_STEP",
                "MAPP_UPDATED_AT",
            ]
        )

        ApplicationService.mark_step_completed(
            application,
            step=5,
        )

        application.refresh_from_db()

        self.assertEqual(
            application.MAPP_HIGHEST_COMPLETED_STEP,
            5,
        )

    def test_validate_step_access_allows_next_step(self):
        application = MerchantApplication.objects.create(
            USER_ID=self.user,
        )

        application.MAPP_HIGHEST_COMPLETED_STEP = 0
        application.save(
            update_fields=[
                "MAPP_HIGHEST_COMPLETED_STEP",
                "MAPP_UPDATED_AT",
            ]
        )

        ApplicationService.validate_step_access(
            application,
            step_number=1,
        )

    def test_validate_step_access_rejects_step_when_previous_step_is_incomplete(
        self,
    ):
        application = MerchantApplication.objects.create(
            USER_ID=self.user,
        )

        application.MAPP_HIGHEST_COMPLETED_STEP = 0
        application.save(
            update_fields=[
                "MAPP_HIGHEST_COMPLETED_STEP",
                "MAPP_UPDATED_AT",
            ]
        )

        with self.assertRaisesMessage(
            ValidationError,
            "Complete Step 1 first.",
        ):
            ApplicationService.validate_step_access(
                application,
                step_number=2,
            )

    def test_validate_step_access_allows_completed_previous_steps(self):
        application = MerchantApplication.objects.create(
            USER_ID=self.user,
        )

        application.MAPP_HIGHEST_COMPLETED_STEP = 2
        application.save(
            update_fields=[
                "MAPP_HIGHEST_COMPLETED_STEP",
                "MAPP_UPDATED_AT",
            ]
        )

        ApplicationService.validate_step_access(
            application,
            step_number=3,
        )

    def test_validate_step_access_rejects_access_to_later_step(self):
        application = MerchantApplication.objects.create(
            USER_ID=self.user,
        )

        application.MAPP_HIGHEST_COMPLETED_STEP = 2
        application.save(
            update_fields=[
                "MAPP_HIGHEST_COMPLETED_STEP",
                "MAPP_UPDATED_AT",
            ]
        )

        with self.assertRaisesMessage(
            ValidationError,
            "Complete Step 3 first.",
        ):
            ApplicationService.validate_step_access(
                application,
                step_number=4,
            )

    def test_validate_step_access_rejects_submitted_application(self):
        application = MerchantApplication.objects.create(
            USER_ID=self.user,
        )

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.SUBMITTED
        )
        application.save(
            update_fields=[
                "MAPP_STATUS",
                "MAPP_UPDATED_AT",
            ]
        )

        with self.assertRaises(ValidationError):
            ApplicationService.validate_step_access(
                application,
                step_number=1,
            )