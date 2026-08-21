from datetime import timedelta

from apps.admin_operations.business_management.services.manage_application_service import (
    ApplicationService as AdminApplicationService,
)
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationFeedback,
    MerchantApplicationReview,
    MerchantApplicationSubmission,
)
from apps.merchant_application.services.application_service import (
    ApplicationService,
)
from apps.merchant_application.tests.test_services import (
    MerchantApplicationServiceMixin,
)
from apps.users.models import User
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

        submission = MerchantApplicationSubmission.objects.get(
            MAPP_ID=submitted_application,
        )

        self.assertEqual(
            submission.MASUB_SUBMISSION_NUMBER,
            1,
        )

        self.assertEqual(
            submission.MASUB_SUBMITTED_AT,
            submitted_application.MAPP_SUBMITTED_AT,
        )

        submission = MerchantApplicationSubmission.objects.get(
            MAPP_ID=submitted_application,
            MASUB_SUBMISSION_NUMBER=1,
        )

        self.assertEqual(
            submission.MASUB_SUBMITTED_AT,
            submitted_application.MAPP_SUBMITTED_AT,
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

        submission = MerchantApplicationSubmission.objects.get(
            MAPP_ID=submitted_application,
        )

        self.assertEqual(
            submission.MASUB_SUBMISSION_NUMBER,
            1,
        )

        self.assertEqual(
            submission.MASUB_SUBMITTED_AT,
            submitted_application.MAPP_SUBMITTED_AT,
        )

    def test_submit_application_increments_submission_count_on_resubmission(self):
        application = self._build_complete_application()

        first_submission_at = timezone.now()

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

        MerchantApplicationSubmission.objects.create(
            MAPP_ID=application,
            MASUB_SUBMISSION_NUMBER=1,
            MASUB_SUBMITTED_AT=first_submission_at,
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

        submissions = list(
            MerchantApplicationSubmission.objects
            .filter(MAPP_ID=submitted_application)
            .order_by("MASUB_SUBMISSION_NUMBER")
        )

        self.assertEqual(len(submissions), 2)

        self.assertEqual(
            submissions[0].MASUB_SUBMISSION_NUMBER,
            1,
        )

        self.assertEqual(
            submissions[1].MASUB_SUBMISSION_NUMBER,
            2,
        )

        self.assertIsNotNone(
            submissions[0].MASUB_SUBMITTED_AT,
        )

        self.assertIsNotNone(
            submissions[1].MASUB_SUBMITTED_AT,
        )

        self.assertEqual(
            submissions[1].MASUB_SUBMITTED_AT,
            submitted_application.MAPP_SUBMITTED_AT,
        )

        submissions = MerchantApplicationSubmission.objects.filter(
            MAPP_ID=submitted_application,
        ).order_by("MASUB_SUBMISSION_NUMBER")

        self.assertEqual(submissions.count(), 2)

        self.assertEqual(
            submissions[0].MASUB_SUBMISSION_NUMBER,
            1,
        )

        self.assertEqual(
            submissions[1].MASUB_SUBMISSION_NUMBER,
            2,
        )

        self.assertEqual(
            submissions[0].MASUB_SUBMITTED_AT,
            first_submission_at,
        )

        self.assertEqual(
            submissions[1].MASUB_SUBMITTED_AT,
            submitted_application.MAPP_SUBMITTED_AT,
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

    def test_application_submission_and_review_history_is_preserved_across_resubmission(
        self,
    ):
        application = self._build_complete_application()

        # First submission
        submitted_application = ApplicationService.submit_application(
            application,
        )

        first_submission = MerchantApplicationSubmission.objects.get(
            MAPP_ID=submitted_application,
            MASUB_SUBMISSION_NUMBER=1,
        )

        # First rejection
        first_reviewed_at = timezone.now()

        first_review = MerchantApplicationReview.objects.create(
            MAPP_ID=submitted_application,
            MASUB_ID=first_submission,
            USER_ID=self.user,
            MAREV_DECISION=MerchantApplicationReview.Decision.REJECTED,
            MAREV_REVIEWED_AT=first_reviewed_at,
        )

        MerchantApplicationFeedback.objects.create(
            MAREV_ID=first_review,
            MAPF_SECTION=MerchantApplicationFeedback.Section.IDENTITY,
            MAPF_MESSAGE="Update your business identity.",
        )

        submitted_application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.REJECTED
        )
        submitted_application.MAPP_REVIEWED_AT = first_reviewed_at
        submitted_application.save(
            update_fields=[
                "MAPP_STATUS",
                "MAPP_REVIEWED_AT",
                "MAPP_UPDATED_AT",
            ]
        )

        # Merchant updates the section requested by the reviewer
        submitted_application.MAPP_IDENTITY_UPDATED_AT = (
            first_reviewed_at + timedelta(seconds=1)
        )
        submitted_application.save(
            update_fields=[
                "MAPP_IDENTITY_UPDATED_AT",
                "MAPP_UPDATED_AT",
            ]
        )

        # Resubmit
        resubmitted_application = ApplicationService.submit_application(
            submitted_application,
        )

        resubmitted_application.refresh_from_db()

        # Verify Submission #2 was created
        submissions = list(
            MerchantApplicationSubmission.objects
            .filter(MAPP_ID=resubmitted_application)
            .order_by("MASUB_SUBMISSION_NUMBER")
        )

        self.assertEqual(len(submissions), 2)

        first_submission = submissions[0]
        second_submission = submissions[1]

        self.assertEqual(
            first_submission.MASUB_SUBMISSION_NUMBER,
            1,
        )

        self.assertEqual(
            second_submission.MASUB_SUBMISSION_NUMBER,
            2,
        )

        # First review must still point to Submission #1
        first_review.refresh_from_db()

        self.assertEqual(
            first_review.MASUB_ID,
            first_submission,
        )

        self.assertEqual(
            first_review.MAREV_DECISION,
            MerchantApplicationReview.Decision.REJECTED,
        )

        # Second submission is approved
        second_reviewed_at = timezone.now()

        second_review = MerchantApplicationReview.objects.create(
            MAPP_ID=resubmitted_application,
            MASUB_ID=second_submission,
            USER_ID=self.user,
            MAREV_DECISION=MerchantApplicationReview.Decision.APPROVED,
            MAREV_REVIEWED_AT=second_reviewed_at,
        )

        resubmitted_application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.APPROVED
        )
        resubmitted_application.MAPP_REVIEWED_AT = second_reviewed_at
        resubmitted_application.save(
            update_fields=[
                "MAPP_STATUS",
                "MAPP_REVIEWED_AT",
                "MAPP_UPDATED_AT",
            ]
        )

        # Second review must point to Submission #2
        second_review.refresh_from_db()

        self.assertEqual(
            second_review.MASUB_ID,
            second_submission,
        )

        self.assertEqual(
            second_review.MAREV_DECISION,
            MerchantApplicationReview.Decision.APPROVED,
        )

        # Final application state
        resubmitted_application.refresh_from_db()

        self.assertEqual(
            resubmitted_application.MAPP_STATUS,
            MerchantApplication.ApplicationStatus.APPROVED,
        )

        self.assertEqual(
            resubmitted_application.MAPP_SUBMISSION_COUNT,
            2,
        )

    def test_application_submission_review_lifecycle_links_each_review_to_correct_submission(
        self,
    ):
        application = self._build_complete_application()

        # First submission
        submitted_application = ApplicationService.submit_application(
            application,
        )

        first_submission = MerchantApplicationSubmission.objects.get(
            MAPP_ID=submitted_application,
            MASUB_SUBMISSION_NUMBER=1,
        )

        # First rejection through the actual service
        rejected_application = AdminApplicationService.reject_application(
            application_id=submitted_application.MAPP_ID,
            feedback=[
                {
                    "section": MerchantApplicationFeedback.Section.IDENTITY,
                    "message": "Update your business identity.",
                }
            ],
            reviewer=self.user,
        )

        rejected_application.refresh_from_db()

        first_review = MerchantApplicationReview.objects.get(
            MAPP_ID=rejected_application,
            MAREV_DECISION=MerchantApplicationReview.Decision.REJECTED,
        )

        self.assertEqual(
            first_review.MASUB_ID,
            first_submission,
        )

        self.assertEqual(
            first_review.feedback.count(),
            1,
        )

        # Merchant updates the section requested by the reviewer
        reviewed_at = first_review.MAREV_REVIEWED_AT

        rejected_application.MAPP_IDENTITY_UPDATED_AT = (
            reviewed_at + timedelta(seconds=1)
        )

        rejected_application.save(
            update_fields=[
                "MAPP_IDENTITY_UPDATED_AT",
                "MAPP_UPDATED_AT",
            ]
        )

        # Resubmit through the actual service
        resubmitted_application = ApplicationService.submit_application(
            rejected_application,
        )

        resubmitted_application.refresh_from_db()

        second_submission = MerchantApplicationSubmission.objects.get(
            MAPP_ID=resubmitted_application,
            MASUB_SUBMISSION_NUMBER=2,
        )

        # The original submission must still exist
        self.assertTrue(
            MerchantApplicationSubmission.objects.filter(
                MASUB_ID=first_submission.MASUB_ID,
            ).exists()
        )

        self.assertEqual(
            resubmitted_application.MAPP_SUBMISSION_COUNT,
            2,
        )

        # Approve the second submission through the actual service
        approved_application = AdminApplicationService.approve_application(
            application_id=resubmitted_application.MAPP_ID,
            reviewer=self.user,
        )

        approved_application.refresh_from_db()

        second_review = MerchantApplicationReview.objects.get(
            MAPP_ID=approved_application,
            MAREV_DECISION=MerchantApplicationReview.Decision.APPROVED,
        )

        # Each review must remain linked to the submission it actually reviewed
        self.assertEqual(
            first_review.MASUB_ID,
            first_submission,
        )

        self.assertEqual(
            second_review.MASUB_ID,
            second_submission,
        )

        # Final application state
        self.assertEqual(
            approved_application.MAPP_STATUS,
            MerchantApplication.ApplicationStatus.APPROVED,
        )

        self.assertEqual(
            approved_application.MAPP_SUBMISSION_COUNT,
            2,
        )

        # Complete history should remain intact
        self.assertEqual(
            MerchantApplicationSubmission.objects.filter(
                MAPP_ID=approved_application,
            ).count(),
            2,
        )

        self.assertEqual(
            MerchantApplicationReview.objects.filter(
                MAPP_ID=approved_application,
            ).count(),
            2,
        )


    def test_get_section_updated_at_returns_identity_timestamp(self):
        application = self._build_complete_application()

        timestamp = timezone.now()

        application.MAPP_IDENTITY_UPDATED_AT = timestamp
        application.save(
            update_fields=["MAPP_IDENTITY_UPDATED_AT"],
        )

        result = ApplicationService.get_section_updated_at(
            application,
            MerchantApplicationFeedback.Section.IDENTITY,
        )

        self.assertEqual(
            result,
            timestamp,
        )


    def test_get_section_updated_at_returns_location_timestamp(self):
        application = self._build_complete_application()

        timestamp = timezone.now()

        application.MAPP_LOCATION_UPDATED_AT = timestamp
        application.save(
            update_fields=["MAPP_LOCATION_UPDATED_AT"],
        )

        result = ApplicationService.get_section_updated_at(
            application,
            MerchantApplicationFeedback.Section.LOCATION,
        )

        self.assertEqual(
            result,
            timestamp,
        )


    def test_get_section_updated_at_returns_operating_hours_timestamp(self):
        application = self._build_complete_application()

        timestamp = timezone.now()

        application.MAPP_OPERATING_HOURS_UPDATED_AT = timestamp
        application.save(
            update_fields=["MAPP_OPERATING_HOURS_UPDATED_AT"],
        )

        result = ApplicationService.get_section_updated_at(
            application,
            MerchantApplicationFeedback.Section.OPERATING_HOURS,
        )

        self.assertEqual(
            result,
            timestamp,
        )


    def test_get_section_updated_at_returns_photos_timestamp(self):
        application = self._build_complete_application()

        timestamp = timezone.now()

        application.MAPP_PHOTOS_UPDATED_AT = timestamp
        application.save(
            update_fields=["MAPP_PHOTOS_UPDATED_AT"],
        )

        result = ApplicationService.get_section_updated_at(
            application,
            MerchantApplicationFeedback.Section.PHOTOS,
        )

        self.assertEqual(
            result,
            timestamp,
        )


    def test_get_section_updated_at_returns_documents_timestamp(self):
        application = self._build_complete_application()

        timestamp = timezone.now()

        application.MAPP_DOCUMENTS_UPDATED_AT = timestamp
        application.save(
            update_fields=["MAPP_DOCUMENTS_UPDATED_AT"],
        )

        result = ApplicationService.get_section_updated_at(
            application,
            MerchantApplicationFeedback.Section.DOCUMENTS,
        )

        self.assertEqual(
            result,
            timestamp,
        )


    def test_get_section_updated_at_returns_none_for_unknown_section(self):
        application = self._build_complete_application()

        result = ApplicationService.get_section_updated_at(
            application,
            "unknown_section",
        )

        self.assertIsNone(
            result,
        )


    def test_acknowledge_merchant_mode_marks_approved_merchant_application(self):
        application = self._build_complete_application()

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.APPROVED
        )
        application.MAPP_MERCHANT_MODE_ACKNOWLEDGED = False
        application.save(
            update_fields=[
                "MAPP_STATUS",
                "MAPP_MERCHANT_MODE_ACKNOWLEDGED",
            ],
        )

        user = application.USER_ID

        result = ApplicationService.acknowledge_merchant_mode(
            application,
            user,
        )

        application.refresh_from_db()

        self.assertEqual(
            result,
            application,
        )
        self.assertTrue(
            application.MAPP_MERCHANT_MODE_ACKNOWLEDGED,
        )


    def test_acknowledge_merchant_mode_is_idempotent(self):
        application = self._build_complete_application()

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.APPROVED
        )
        application.MAPP_MERCHANT_MODE_ACKNOWLEDGED = True
        application.save(
            update_fields=[
                "MAPP_STATUS",
                "MAPP_MERCHANT_MODE_ACKNOWLEDGED",
            ],
        )

        user = application.USER_ID

        result = ApplicationService.acknowledge_merchant_mode(
            application,
            user,
        )

        application.refresh_from_db()

        self.assertEqual(
            result,
            application,
        )
        self.assertTrue(
            application.MAPP_MERCHANT_MODE_ACKNOWLEDGED,
        )


    def test_acknowledge_merchant_mode_rejects_non_approved_application(self):
        application = self._build_complete_application()

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.SUBMITTED
        )
        application.save(
            update_fields=["MAPP_STATUS"],
        )

        user = application.USER_ID

        with self.assertRaisesMessage(
            ValidationError,
            "Only approved applications can be acknowledged.",
        ):
            ApplicationService.acknowledge_merchant_mode(
                application,
                user,
            )


    def test_acknowledge_merchant_mode_rejects_non_merchant_user(self):
        application = self._build_complete_application()

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.APPROVED
        )
        application.save(
            update_fields=["MAPP_STATUS"],
        )

        user = application.USER_ID
        user.USER_ROLE = User.UserRole.EXPLORER
        user.save(
            update_fields=["USER_ROLE"],
        )

        with self.assertRaisesMessage(
            ValidationError,
            "Merchant mode is only available to merchant accounts.",
        ):
            ApplicationService.acknowledge_merchant_mode(
                application,
                user,
            )