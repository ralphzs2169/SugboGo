# isort: skip_file
from datetime import datetime, timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from apps.admin_operations.business_management.services.manage_application_service import (
    ApplicationService,
)
from apps.merchant_application.constants import (
    APPLICATION_REVIEW_SLA_APPROACHING_BUSINESS_DAYS,
    APPLICATION_REVIEW_SLA_BUSINESS_DAYS,
    REVIEWABLE_APPLICATION_STATUSES,
)
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationDocument,
    MerchantApplicationFeedback,
    MerchantApplicationReview,
    MerchantApplicationSubmission,
)
from apps.merchant_application.tests.test_services import (
    MerchantApplicationServiceMixin,
)
from apps.users.models import User
from apps.merchant_application.utils.application_queue import (
    get_business_day_cutoff,
)
from apps.merchant_application.services.identity_service import IdentityService


class ApplicationServiceTests(MerchantApplicationServiceMixin, TestCase):
    """Test administrator-facing merchant application service operations."""

    def _create_admin(self, email="admin-application-service@example.com"):
        return User.objects.create_user(
            email=email,
            password="StrongPassword123!",
            USER_FNAME="Admin",
            USER_LNAME="Application Service",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

    def _timestamp(self, date):
        return timezone.make_aware(
            datetime.combine(
                date,
                datetime.min.time(),
            )
        )

    def _create_application(
        self,
        status,
        *,
        submitted_at=None,
        reviewed_at=None,
        submission_count=1,
        email="merchant-application-service@example.com",
    ):
        user = User.objects.create_user(
            email=email,
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Application Service",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        application = MerchantApplication.objects.create(
            USER_ID=user,
            MAPP_STATUS=status,
            MAPP_SUBMITTED_AT=submitted_at,
            MAPP_REVIEWED_AT=reviewed_at,
            MAPP_SUBMISSION_COUNT=submission_count,
        )

        return application

    def _create_submission(
        self,
        application,
        submission_number=1,
        submitted_at=None,
    ):
        return MerchantApplicationSubmission.objects.create(
            MAPP_ID=application,
            MASUB_SUBMISSION_NUMBER=submission_number,
            MASUB_SUBMITTED_AT=(
                submitted_at
                or timezone.now()
            ),
        )

    def _create_review(
        self,
        application,
        submission,
        reviewer,
        decision,
        reviewed_at=None,
        sla_compliant=True,
    ):
        return MerchantApplicationReview.objects.create(
            MAPP_ID=application,
            MASUB_ID=submission,
            USER_ID=reviewer,
            MAREV_DECISION=decision,
            MAREV_REVIEWED_AT=(
                reviewed_at
                or timezone.now()
            ),
            MAREV_SLA_COMPLIANT=sla_compliant,
        )

    # list_applications

    def test_list_applications_returns_only_reviewable_applications(self):
        self._create_application(
            MerchantApplication.ApplicationStatus.SUBMITTED,
            email="submitted-list@example.com",
        )
        self._create_application(
            MerchantApplication.ApplicationStatus.APPROVED,
            email="approved-list@example.com",
        )
        self._create_application(
            MerchantApplication.ApplicationStatus.REJECTED,
            email="rejected-list@example.com",
        )
        self._create_application(
            MerchantApplication.ApplicationStatus.DRAFT,
            email="draft-list@example.com",
        )

        result = ApplicationService.list_applications()

        result_ids = set(
            result.values_list("MAPP_ID", flat=True)
        )

        self.assertEqual(result.count(), 3)

        statuses = set(
            result.values_list("MAPP_STATUS", flat=True)
        )

        self.assertEqual(
            statuses,
            set(REVIEWABLE_APPLICATION_STATUSES),
        )

    def test_list_applications_filters_by_status(self):
        submitted = self._create_application(
            MerchantApplication.ApplicationStatus.SUBMITTED,
            email="submitted-status-filter@example.com",
        )
        self._create_application(
            MerchantApplication.ApplicationStatus.APPROVED,
            email="approved-status-filter@example.com",
        )

        result = ApplicationService.list_applications(
            status=MerchantApplication.ApplicationStatus.SUBMITTED,
        )

        self.assertEqual(
            list(result.values_list("MAPP_ID", flat=True)),
            [submitted.MAPP_ID],
        )

    def test_list_applications_filters_by_business_name(self):
        application, identity = self._create_identity()

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.SUBMITTED
        )
        application.save(
            update_fields=["MAPP_STATUS"],
        )

        result = ApplicationService.list_applications(
            search=identity.MIDN_BUSINESS_NAME,
        )

        self.assertEqual(
            result.count(),
            1,
        )

        self.assertEqual(
            result.first().MAPP_ID,
            application.MAPP_ID,
        )

    def test_list_applications_default_order_prioritizes_submitted_applications(self):
        now = timezone.now()

        approved = self._create_application(
            MerchantApplication.ApplicationStatus.APPROVED,
            submitted_at=now - timedelta(days=2),
            reviewed_at=now - timedelta(days=1),
            email="approved-priority@example.com",
        )

        submitted = self._create_application(
            MerchantApplication.ApplicationStatus.SUBMITTED,
            submitted_at=now - timedelta(days=3),
            email="submitted-priority@example.com",
        )

        result = list(
            ApplicationService
            .list_applications()
            .values_list("MAPP_ID", "MAPP_STATUS")
        )

        self.assertEqual(
            result[0],
            (
                submitted.MAPP_ID,
                MerchantApplication.ApplicationStatus.SUBMITTED,
            ),
        )

        self.assertEqual(
            result[1],
            (
                approved.MAPP_ID,
                MerchantApplication.ApplicationStatus.APPROVED,
            ),
        )

    def test_list_applications_supports_business_name_ordering(self):
        first_application, _ = self._create_identity()

        first_application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.SUBMITTED
        )
        first_application.save(
            update_fields=["MAPP_STATUS"],
        )

        second_user = User.objects.create_user(
            email="second-business-ordering@example.com",
            password="StrongPassword123!",
            USER_FNAME="Second",
            USER_LNAME="Merchant",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        second_application, _ = IdentityService.save_identity(
            second_user,
            {
                **self._identity_payload(),
                "MIDN_BUSINESS_NAME": "Cebu Coffee House",
                "MIDN_BUSINESS_EMAIL": "hello@cebucoffee.example.com",
                "MIDN_REPRESENTATIVE_NAME": "John Owner",
            },
        )

        second_application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.SUBMITTED
        )
        second_application.save(
            update_fields=["MAPP_STATUS"],
        )

        result = ApplicationService.list_applications(
            ordering="business_name",
        )

        names = list(
            result.values_list(
                "identity__MIDN_BUSINESS_NAME",
                flat=True,
            )
        )

        self.assertEqual(
            names,
            [
                "Cebu Coffee House",
                "Sugbo Bistro",
            ],
        )

    def test_list_applications_unknown_ordering_falls_back_to_submitted_at_descending(self):
        now = timezone.now()

        older = self._create_application(
            MerchantApplication.ApplicationStatus.APPROVED,
            submitted_at=now - timedelta(days=3),
            reviewed_at=now - timedelta(days=2),
            email="older-ordering@example.com",
        )

        newer = self._create_application(
            MerchantApplication.ApplicationStatus.APPROVED,
            submitted_at=now - timedelta(days=1),
            reviewed_at=now,
            email="newer-ordering@example.com",
        )

        result = list(
            ApplicationService
            .list_applications(
                ordering="unsupported-ordering",
            )
            .values_list("MAPP_ID", flat=True)
        )

        self.assertEqual(
            result,
            [
                newer.MAPP_ID,
                older.MAPP_ID,
            ],
        )

    # queue filtering

    def test_list_applications_queue_status_resolved_returns_approved_and_rejected(self):
        approved = self._create_application(
            MerchantApplication.ApplicationStatus.APPROVED,
            submitted_at=timezone.now() - timedelta(days=2),
            reviewed_at=timezone.now() - timedelta(days=1),
            email="resolved-approved@example.com",
        )

        rejected = self._create_application(
            MerchantApplication.ApplicationStatus.REJECTED,
            submitted_at=timezone.now() - timedelta(days=3),
            reviewed_at=timezone.now() - timedelta(days=2),
            email="resolved-rejected@example.com",
        )

        submitted = self._create_application(
            MerchantApplication.ApplicationStatus.SUBMITTED,
            submitted_at=timezone.now() - timedelta(days=1),
            email="resolved-submitted@example.com",
        )

        result_ids = set(
            ApplicationService
            .list_applications(queue_status="resolved")
            .values_list("MAPP_ID", flat=True)
        )

        self.assertEqual(
            result_ids,
            {
                approved.MAPP_ID,
                rejected.MAPP_ID,
            },
        )

        self.assertNotIn(
            submitted.MAPP_ID,
            result_ids,
        )

    def test_list_applications_queue_status_overdue_returns_overdue_pending_application(self):
        overdue_date = (
            get_business_day_cutoff(
                APPLICATION_REVIEW_SLA_BUSINESS_DAYS,
            )
        )

        application = self._create_application(
            MerchantApplication.ApplicationStatus.SUBMITTED,
            submitted_at=self._timestamp(overdue_date),
            email="overdue-queue@example.com",
        )

        result_ids = set(
            ApplicationService
            .list_applications(queue_status="overdue")
            .values_list("MAPP_ID", flat=True)
        )

        self.assertIn(
            application.MAPP_ID,
            result_ids,
        )

    def test_list_applications_queue_status_approaching_returns_application_in_approaching_window(self):
        approaching_date = (
            get_business_day_cutoff(
                APPLICATION_REVIEW_SLA_APPROACHING_BUSINESS_DAYS,
            )
        )

        application = self._create_application(
            MerchantApplication.ApplicationStatus.SUBMITTED,
            submitted_at=self._timestamp(approaching_date),
            email="approaching-queue@example.com",
        )

        result_ids = set(
            ApplicationService
            .list_applications(queue_status="approaching")
            .values_list("MAPP_ID", flat=True)
        )

        self.assertIn(
            application.MAPP_ID,
            result_ids,
        )

    def test_list_applications_queue_status_on_time_returns_recent_pending_application(self):
        approaching_date = (
            get_business_day_cutoff(
                APPLICATION_REVIEW_SLA_APPROACHING_BUSINESS_DAYS,
            )
        )

        on_time_date = approaching_date + timedelta(days=1)

        application = self._create_application(
            MerchantApplication.ApplicationStatus.SUBMITTED,
            submitted_at=self._timestamp(on_time_date),
            email="on-time-queue@example.com",
        )

        result_ids = set(
            ApplicationService
            .list_applications(queue_status="on_time")
            .values_list("MAPP_ID", flat=True)
        )

        self.assertIn(
            application.MAPP_ID,
            result_ids,
        )

    def test_list_applications_queue_status_excludes_reviewed_applications(self):
        overdue_date = (
            get_business_day_cutoff(
                APPLICATION_REVIEW_SLA_BUSINESS_DAYS,
            )
        )

        reviewed_at = timezone.now()

        application = self._create_application(
            MerchantApplication.ApplicationStatus.APPROVED,
            submitted_at=self._timestamp(overdue_date),
            reviewed_at=reviewed_at,
            email="reviewed-queue@example.com",
        )

        result_ids = set(
            ApplicationService
            .list_applications(queue_status="overdue")
            .values_list("MAPP_ID", flat=True)
        )

        self.assertNotIn(
            application.MAPP_ID,
            result_ids,
        )

    def test_list_applications_rejects_invalid_queue_status(self):
        with self.assertRaisesMessage(
            ValidationError,
            "Invalid queue status.",
        ):
            ApplicationService.list_applications(
                queue_status="invalid",
            )

    # get_document_for_review

    def test_get_document_for_review_returns_document_belonging_to_application(self):
        application = self._build_complete_application()

        document = MerchantApplicationDocument.objects.create(
            MAPP_ID=application,
            MDOC_DOCUMENT_TYPE=(
                MerchantApplicationDocument.DocumentType.BUSINESS_REGISTRATION
            ),
            MDOC_DOCUMENT_URL="https://example.com/business-registration.pdf",
            MDOC_DOCUMENT_PUBLIC_ID="business-registration",
            MDOC_CLOUDINARY_VERSION=1,
            MDOC_FILE_NAME="business-registration.pdf",
        )

        result = ApplicationService.get_document_for_review(
            application.MAPP_ID,
            document.MDOC_ID,
        )

        self.assertEqual(
            result.MDOC_ID,
            document.MDOC_ID,
        )

    def test_get_document_for_review_raises_not_found_for_document_from_another_application(
        self,
    ):
        application = self._build_complete_application()

        other_user = User.objects.create_user(
            email="other-document-review@example.com",
            password="StrongPassword123!",
            USER_FNAME="Other",
            USER_LNAME="Merchant",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        other_application = MerchantApplication.objects.create(
            USER_ID=other_user,
        )

        document = MerchantApplicationDocument.objects.create(
            MAPP_ID=other_application,
            MDOC_DOCUMENT_TYPE=(
                MerchantApplicationDocument.DocumentType.BUSINESS_REGISTRATION
            ),
            MDOC_DOCUMENT_URL="https://example.com/other-registration.pdf",
            MDOC_DOCUMENT_PUBLIC_ID="other-registration",
            MDOC_CLOUDINARY_VERSION=1,
            MDOC_FILE_NAME="other-registration.pdf",
        )

        with self.assertRaisesMessage(
            NotFound,
            "The requested document could not be found.",
        ):
            ApplicationService.get_document_for_review(
                application.MAPP_ID,
                document.MDOC_ID,
            )

    # get_application_for_review

    def test_get_application_for_review_returns_application(self):
        application = self._build_complete_application()

        result = ApplicationService.get_application_for_review(
            application.MAPP_ID,
        )

        self.assertEqual(
            result.MAPP_ID,
            application.MAPP_ID,
        )

    def test_get_application_for_review_loads_review_history_in_reverse_chronological_order(self):
        application = self._build_complete_application()
        reviewer = self._create_admin(
            email="review-history-admin@example.com",
        )

        first_submission = self._create_submission(
            application,
            submission_number=1,
            submitted_at=timezone.now() - timedelta(days=4),
        )

        second_submission = self._create_submission(
            application,
            submission_number=2,
            submitted_at=timezone.now() - timedelta(days=2),
        )

        older_reviewed_at = timezone.now() - timedelta(days=3)
        newer_reviewed_at = timezone.now() - timedelta(days=1)

        older_review = self._create_review(
            application,
            first_submission,
            reviewer,
            MerchantApplicationReview.Decision.REJECTED,
            reviewed_at=older_reviewed_at,
        )

        newer_review = self._create_review(
            application,
            second_submission,
            reviewer,
            MerchantApplicationReview.Decision.APPROVED,
            reviewed_at=newer_reviewed_at,
        )

        result = ApplicationService.get_application_for_review(
            application.MAPP_ID,
        )

        history = result.admin_review_history

        self.assertEqual(
            [review.MAREV_ID for review in history],
            [
                newer_review.MAREV_ID,
                older_review.MAREV_ID,
            ],
        )

    def test_get_application_for_review_loads_feedback_with_review_history(self):
        application = self._build_complete_application()
        reviewer = self._create_admin(
            email="review-feedback-admin@example.com",
        )

        submission = self._create_submission(
            application,
            submission_number=1,
        )

        review = self._create_review(
            application,
            submission,
            reviewer,
            MerchantApplicationReview.Decision.REJECTED,
        )

        feedback = MerchantApplicationFeedback.objects.create(
            MAREV_ID=review,
            MAPF_SECTION=(
                MerchantApplicationFeedback.Section.IDENTITY
            ),
            MAPF_MESSAGE="Business name needs clarification.",
        )

        result = ApplicationService.get_application_for_review(
            application.MAPP_ID,
        )

        history_review = result.admin_review_history[0]

        self.assertEqual(
            history_review.MAREV_ID,
            review.MAREV_ID,
        )

        self.assertEqual(
            history_review.feedback.first().MAPF_ID,
            feedback.MAPF_ID,
        )

    def test_get_application_for_review_raises_not_found_for_missing_application(
        self,
    ):
        with self.assertRaisesMessage(
            NotFound,
            "The application could not be found.",
        ):
            ApplicationService.get_application_for_review(999999)

    # reject_application

    def test_reject_application_creates_review_feedback_and_updates_application(self):
        application = self._build_complete_application()
        reviewer = self._create_admin(
            email="reject-admin@example.com",
        )

        submitted_at = timezone.now() - timedelta(days=1)

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.SUBMITTED
        )
        application.MAPP_SUBMITTED_AT = submitted_at
        application.MAPP_REVIEWED_AT = None
        application.MAPP_SUBMISSION_COUNT = 1
        application.save(
            update_fields=[
                "MAPP_STATUS",
                "MAPP_SUBMITTED_AT",
                "MAPP_REVIEWED_AT",
                "MAPP_SUBMISSION_COUNT",
            ],
        )

        submission = self._create_submission(
            application,
            submission_number=1,
            submitted_at=submitted_at,
        )

        feedback = [
            {
                "section": MerchantApplicationFeedback.Section.IDENTITY,
                "message": "Please clarify the registered business name.",
            },
            {
                "section": MerchantApplicationFeedback.Section.DOCUMENTS,
                "message": "Upload a clearer registration document.",
            },
        ]

        reviewed_at_before = timezone.now()

        result = ApplicationService.reject_application(
            application_id=application.MAPP_ID,
            feedback=feedback,
            reviewer=reviewer,
        )

        reviewed_at_after = timezone.now()

        result.refresh_from_db()

        self.assertEqual(
            result.MAPP_STATUS,
            MerchantApplication.ApplicationStatus.REJECTED,
        )

        self.assertIsNotNone(
            result.MAPP_REVIEWED_AT,
        )

        self.assertGreaterEqual(
            result.MAPP_REVIEWED_AT,
            reviewed_at_before,
        )

        self.assertLessEqual(
            result.MAPP_REVIEWED_AT,
            reviewed_at_after,
        )

        review = MerchantApplicationReview.objects.get(
            MAPP_ID=application,
        )

        self.assertEqual(
            review.MASUB_ID_id,
            submission.MASUB_ID,
        )

        self.assertEqual(
            review.USER_ID_id,
            reviewer.USER_ID,
        )

        self.assertEqual(
            review.MAREV_DECISION,
            MerchantApplicationReview.Decision.REJECTED,
        )

        self.assertIsNotNone(
            review.MAREV_SLA_COMPLIANT,
        )

        feedback_records = list(
            MerchantApplicationFeedback.objects
            .filter(MAREV_ID=review)
            .order_by("MAPF_ID")
        )

        self.assertEqual(
            len(feedback_records),
            2,
        )

        self.assertEqual(
            feedback_records[0].MAPF_SECTION,
            feedback[0]["section"],
        )

        self.assertEqual(
            feedback_records[0].MAPF_MESSAGE,
            feedback[0]["message"],
        )

        self.assertEqual(
            feedback_records[1].MAPF_SECTION,
            feedback[1]["section"],
        )

        self.assertEqual(
            feedback_records[1].MAPF_MESSAGE,
            feedback[1]["message"],
        )

    def test_reject_application_uses_latest_submission_for_review(self):
        application = self._build_complete_application()
        reviewer = self._create_admin(
            email="reject-latest-submission-admin@example.com",
        )

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.SUBMITTED
        )
        application.MAPP_SUBMISSION_COUNT = 2
        application.save(
            update_fields=[
                "MAPP_STATUS",
                "MAPP_SUBMISSION_COUNT",
            ],
        )

        first_submission = self._create_submission(
            application,
            submission_number=1,
            submitted_at=timezone.now() - timedelta(days=4),
        )

        second_submission = self._create_submission(
            application,
            submission_number=2,
            submitted_at=timezone.now() - timedelta(days=1),
        )

        ApplicationService.reject_application(
            application_id=application.MAPP_ID,
            feedback=[],
            reviewer=reviewer,
        )

        review = MerchantApplicationReview.objects.get(
            MAPP_ID=application,
        )

        self.assertEqual(
            review.MASUB_ID_id,
            second_submission.MASUB_ID,
        )

        self.assertNotEqual(
            review.MASUB_ID_id,
            first_submission.MASUB_ID,
        )

    def test_reject_application_raises_not_found_for_missing_application(self):
        reviewer = self._create_admin(
            email="reject-not-found-admin@example.com",
        )

        with self.assertRaisesMessage(
            NotFound,
            "The application could not be found.",
        ):
            ApplicationService.reject_application(
                application_id=999999,
                feedback=[],
                reviewer=reviewer,
            )

    def test_reject_application_rejects_non_submitted_application(self):
        application = self._build_complete_application()
        reviewer = self._create_admin(
            email="reject-invalid-status-admin@example.com",
        )

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.APPROVED
        )
        application.save(
            update_fields=["MAPP_STATUS"],
        )

        with self.assertRaisesMessage(
            ValidationError,
            "Only submitted applications can be rejected.",
        ):
            ApplicationService.reject_application(
                application_id=application.MAPP_ID,
                feedback=[],
                reviewer=reviewer,
            )

        self.assertEqual(
            MerchantApplicationReview.objects.filter(
                MAPP_ID=application,
            ).count(),
            0,
        )

    def test_reject_application_requires_submission_history(self):
        application = self._build_complete_application()
        reviewer = self._create_admin(
            email="reject-no-submission-admin@example.com",
        )

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.SUBMITTED
        )
        application.MAPP_SUBMISSION_COUNT = 1
        application.save(
            update_fields=[
                "MAPP_STATUS",
                "MAPP_SUBMISSION_COUNT",
            ],
        )

        with self.assertRaisesMessage(
            ValidationError,
            "The application's submission history could not be found.",
        ):
            ApplicationService.reject_application(
                application_id=application.MAPP_ID,
                feedback=[],
                reviewer=reviewer,
            )

    # approve_application

    def test_approve_application_creates_review_and_updates_application(self):
        application = self._build_complete_application()
        reviewer = self._create_admin(
            email="approve-admin@example.com",
        )

        submitted_at = timezone.now() - timedelta(days=1)

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.SUBMITTED
        )
        application.MAPP_SUBMITTED_AT = submitted_at
        application.MAPP_REVIEWED_AT = None
        application.MAPP_SUBMISSION_COUNT = 1
        application.save(
            update_fields=[
                "MAPP_STATUS",
                "MAPP_SUBMITTED_AT",
                "MAPP_REVIEWED_AT",
                "MAPP_SUBMISSION_COUNT",
            ],
        )

        submission = self._create_submission(
            application,
            submission_number=1,
            submitted_at=submitted_at,
        )

        reviewed_at_before = timezone.now()

        result = ApplicationService.approve_application(
            application_id=application.MAPP_ID,
            reviewer=reviewer,
        )

        reviewed_at_after = timezone.now()

        result.refresh_from_db()

        self.assertEqual(
            result.MAPP_STATUS,
            MerchantApplication.ApplicationStatus.APPROVED,
        )

        self.assertIsNotNone(
            result.MAPP_REVIEWED_AT,
        )

        self.assertGreaterEqual(
            result.MAPP_REVIEWED_AT,
            reviewed_at_before,
        )

        self.assertLessEqual(
            result.MAPP_REVIEWED_AT,
            reviewed_at_after,
        )

        review = MerchantApplicationReview.objects.get(
            MAPP_ID=application,
        )

        self.assertEqual(
            review.MASUB_ID_id,
            submission.MASUB_ID,
        )

        self.assertEqual(
            review.USER_ID_id,
            reviewer.USER_ID,
        )

        self.assertEqual(
            review.MAREV_DECISION,
            MerchantApplicationReview.Decision.APPROVED,
        )

        self.assertIsNotNone(
            review.MAREV_SLA_COMPLIANT,
        )

    def test_approve_application_uses_latest_submission_for_review(self):
        application = self._build_complete_application()
        reviewer = self._create_admin(
            email="approve-latest-submission-admin@example.com",
        )

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.SUBMITTED
        )
        application.MAPP_SUBMISSION_COUNT = 2
        application.save(
            update_fields=[
                "MAPP_STATUS",
                "MAPP_SUBMISSION_COUNT",
            ],
        )

        first_submission = self._create_submission(
            application,
            submission_number=1,
            submitted_at=timezone.now() - timedelta(days=4),
        )

        second_submission = self._create_submission(
            application,
            submission_number=2,
            submitted_at=timezone.now() - timedelta(days=1),
        )

        ApplicationService.approve_application(
            application_id=application.MAPP_ID,
            reviewer=reviewer,
        )

        review = MerchantApplicationReview.objects.get(
            MAPP_ID=application,
        )

        self.assertEqual(
            review.MASUB_ID_id,
            second_submission.MASUB_ID,
        )

        self.assertNotEqual(
            review.MASUB_ID_id,
            first_submission.MASUB_ID,
        )

    def test_approve_application_raises_not_found_for_missing_application(self):
        reviewer = self._create_admin(
            email="approve-not-found-admin@example.com",
        )

        with self.assertRaisesMessage(
            NotFound,
            "The application could not be found.",
        ):
            ApplicationService.approve_application(
                application_id=999999,
                reviewer=reviewer,
            )

    def test_approve_application_rejects_non_submitted_application(self):
        application = self._build_complete_application()
        reviewer = self._create_admin(
            email="approve-invalid-status-admin@example.com",
        )

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.REJECTED
        )
        application.save(
            update_fields=["MAPP_STATUS"],
        )

        with self.assertRaisesMessage(
            ValidationError,
            "Only submitted applications can be approved.",
        ):
            ApplicationService.approve_application(
                application_id=application.MAPP_ID,
                reviewer=reviewer,
            )

        self.assertEqual(
            MerchantApplicationReview.objects.filter(
                MAPP_ID=application,
            ).count(),
            0,
        )

    def test_approve_application_requires_submission_history(self):
        application = self._build_complete_application()
        reviewer = self._create_admin(
            email="approve-no-submission-admin@example.com",
        )

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.SUBMITTED
        )
        application.MAPP_SUBMISSION_COUNT = 1
        application.save(
            update_fields=[
                "MAPP_STATUS",
                "MAPP_SUBMISSION_COUNT",
            ],
        )

        with self.assertRaisesMessage(
            ValidationError,
            "The application's submission history could not be found.",
        ):
            ApplicationService.approve_application(
                application_id=application.MAPP_ID,
                reviewer=reviewer,
            )


    def test_approve_application_changes_applicant_role_to_merchant(self):
        application = self._build_complete_application()
        reviewer = self._create_admin(
            email="approve-role-admin@example.com",
        )

        applicant = application.USER_ID
        applicant.USER_ROLE = User.UserRole.EXPLORER
        applicant.save(
            update_fields=["USER_ROLE"],
        )

        submitted_at = timezone.now() - timedelta(days=1)

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.SUBMITTED
        )
        application.MAPP_SUBMITTED_AT = submitted_at
        application.MAPP_REVIEWED_AT = None
        application.MAPP_SUBMISSION_COUNT = 1
        application.save(
            update_fields=[
                "MAPP_STATUS",
                "MAPP_SUBMITTED_AT",
                "MAPP_REVIEWED_AT",
                "MAPP_SUBMISSION_COUNT",
            ],
        )

        self._create_submission(
            application,
            submission_number=1,
            submitted_at=submitted_at,
        )

        self.assertEqual(
            applicant.USER_ROLE,
            User.UserRole.EXPLORER,
        )

        ApplicationService.approve_application(
            application_id=application.MAPP_ID,
            reviewer=reviewer,
        )

        applicant.refresh_from_db()

        self.assertEqual(
            applicant.USER_ROLE,
            User.UserRole.MERCHANT,
        )