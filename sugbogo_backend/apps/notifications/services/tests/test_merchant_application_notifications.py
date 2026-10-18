from datetime import timedelta
from unittest.mock import patch

from django.db import transaction
from django.test import TestCase
from rest_framework.exceptions import ValidationError

from apps.admin_operations.business_management.services.manage_application_service import (
    ApplicationService as AdminApplicationService,
)
from apps.business.models import Business
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationFeedback,
    MerchantApplicationReview,
    MerchantApplicationSubmission,
)
from apps.merchant_application.services.application_service import (
    ApplicationService as MerchantApplicationService,
)
from apps.merchant_application.tests.test_services import (
    MerchantApplicationServiceMixin,
)
from apps.notifications.models import Notification
from apps.notifications.services.notification_realtime_service import (
    NotificationRealtimeService,
)
from apps.users.models import User


class MerchantApplicationNotificationTests(
    MerchantApplicationServiceMixin,
    TestCase,
):
    """Verify applicant notices without changing the decision workflow."""

    def setUp(self):
        super().setUp()
        self.admin = User.objects.create_user(
            email="application-notification-admin@example.com",
            password="StrongPassword123!",
            USER_FNAME="Application",
            USER_LNAME="Reviewer",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

    def _submit_complete_application(self):
        application = self._build_complete_application()
        return MerchantApplicationService.submit_application(application)

    def _feedback(self):
        return [
            {
                "section": MerchantApplicationFeedback.Section.IDENTITY,
                "message": "Please clarify the registered business name.",
            },
        ]

    def _latest_submission(self, application):
        return MerchantApplicationSubmission.objects.filter(
            MAPP_ID=application,
        ).latest("MASUB_SUBMISSION_NUMBER")

    def test_approval_notifies_applicant_and_preserves_approval_workflow(self):
        application = self._build_complete_application()
        self.user.USER_ROLE = User.UserRole.EXPLORER
        self.user.save(update_fields=["USER_ROLE", "USER_UPDATED_AT"])
        application = MerchantApplicationService.submit_application(application)
        submission = self._latest_submission(application)

        result = AdminApplicationService.approve_application(
            application.MAPP_ID,
            self.admin,
        )

        result.refresh_from_db()
        self.user.refresh_from_db()
        review = MerchantApplicationReview.objects.get(MAPP_ID=application)
        notification = Notification.objects.get(USER_ID=self.user)

        self.assertEqual(
            result.MAPP_STATUS,
            MerchantApplication.ApplicationStatus.APPROVED,
        )
        self.assertIsNotNone(result.BUSN_ID_id)
        self.assertTrue(Business.objects.filter(pk=result.BUSN_ID_id).exists())
        self.assertEqual(self.user.USER_ROLE, User.UserRole.MERCHANT)
        self.assertEqual(review.MASUB_ID_id, submission.pk)
        self.assertEqual(Notification.objects.count(), 1)
        self.assertEqual(notification.USER_ID_id, self.user.pk)
        self.assertEqual(
            notification.NOTF_TYPE,
            "merchant_application_approved",
        )
        self.assertEqual(notification.NOTF_TITLE, "Application Approved")
        self.assertEqual(
            notification.NOTF_BODY,
            (
                "Your merchant application has been approved. "
                "You can now access Merchant mode."
            ),
        )
        self.assertEqual(
            notification.NOTF_DEDUP_KEY,
            f"merchant-application-submission:{submission.pk}:resolved",
        )
        self.assertEqual(notification.NOTF_TARGET_TYPE, "")
        self.assertIsNone(notification.NOTF_TARGET_ID)

    def test_rejection_notifies_applicant_preserves_feedback_and_publishes(self):
        application = self._submit_complete_application()
        submission = self._latest_submission(application)

        with patch.object(NotificationRealtimeService, "publish") as publish:
            with self.captureOnCommitCallbacks(execute=True):
                result = AdminApplicationService.reject_application(
                    application.MAPP_ID,
                    self._feedback(),
                    self.admin,
                )
                publish.assert_not_called()
            publish.assert_called_once_with(self.user.pk)

        result.refresh_from_db()
        review = MerchantApplicationReview.objects.get(MAPP_ID=application)
        notification = Notification.objects.get(USER_ID=self.user)

        self.assertEqual(
            result.MAPP_STATUS,
            MerchantApplication.ApplicationStatus.REJECTED,
        )
        self.assertEqual(review.MASUB_ID_id, submission.pk)
        self.assertEqual(review.feedback.count(), 1)
        self.assertEqual(Notification.objects.count(), 1)
        self.assertEqual(notification.USER_ID_id, self.user.pk)
        self.assertEqual(
            review.feedback.get().MAPF_MESSAGE,
            "Please clarify the registered business name.",
        )
        self.assertEqual(
            notification.NOTF_TYPE,
            "merchant_application_rejected",
        )
        self.assertEqual(notification.NOTF_TITLE, "Application Update")
        self.assertEqual(
            notification.NOTF_BODY,
            (
                "Your merchant application was not approved. "
                "Review the feedback for more details."
            ),
        )
        self.assertEqual(
            notification.NOTF_DEDUP_KEY,
            f"merchant-application-submission:{submission.pk}:resolved",
        )
        self.assertEqual(notification.NOTF_TARGET_TYPE, "")
        self.assertIsNone(notification.NOTF_TARGET_ID)

    def test_repeated_decision_attempt_does_not_duplicate_notification(self):
        application = self._submit_complete_application()

        AdminApplicationService.reject_application(
            application.MAPP_ID,
            self._feedback(),
            self.admin,
        )

        with self.assertRaisesMessage(
            ValidationError,
            "Only submitted applications can be rejected.",
        ):
            AdminApplicationService.reject_application(
                application.MAPP_ID,
                self._feedback(),
                self.admin,
            )

        self.assertEqual(Notification.objects.filter(USER_ID=self.user).count(), 1)
        self.assertEqual(
            MerchantApplicationReview.objects.filter(MAPP_ID=application).count(),
            1,
        )

    def test_separate_submission_decisions_create_distinct_notifications(self):
        application = self._submit_complete_application()
        first_submission = self._latest_submission(application)
        AdminApplicationService.reject_application(
            application.MAPP_ID,
            self._feedback(),
            self.admin,
        )

        first_review = MerchantApplicationReview.objects.get(
            MASUB_ID=first_submission,
        )
        application.refresh_from_db()
        application.MAPP_IDENTITY_UPDATED_AT = (
            first_review.MAREV_REVIEWED_AT + timedelta(seconds=1)
        )
        application.save(
            update_fields=["MAPP_IDENTITY_UPDATED_AT", "MAPP_UPDATED_AT"],
        )

        application = MerchantApplicationService.submit_application(application)
        second_submission = self._latest_submission(application)
        AdminApplicationService.reject_application(
            application.MAPP_ID,
            self._feedback(),
            self.admin,
        )

        self.assertNotEqual(first_submission.pk, second_submission.pk)
        self.assertEqual(Notification.objects.filter(USER_ID=self.user).count(), 2)
        self.assertSetEqual(
            set(
                Notification.objects.filter(USER_ID=self.user).values_list(
                    "NOTF_DEDUP_KEY",
                    flat=True,
                )
            ),
            {
                f"merchant-application-submission:{first_submission.pk}:resolved",
                f"merchant-application-submission:{second_submission.pk}:resolved",
            },
        )

    def test_outer_rollback_removes_decision_notification_and_publication(self):
        application = self._submit_complete_application()

        with patch.object(NotificationRealtimeService, "publish") as publish:
            with self.captureOnCommitCallbacks(execute=True):
                with self.assertRaisesMessage(RuntimeError, "Later operation failed"):
                    with transaction.atomic():
                        AdminApplicationService.reject_application(
                            application.MAPP_ID,
                            self._feedback(),
                            self.admin,
                        )
                        raise RuntimeError("Later operation failed")
            publish.assert_not_called()

        application.refresh_from_db()
        self.assertEqual(
            application.MAPP_STATUS,
            MerchantApplication.ApplicationStatus.SUBMITTED,
        )
        self.assertFalse(
            MerchantApplicationReview.objects.filter(MAPP_ID=application).exists(),
        )
        self.assertFalse(Notification.objects.filter(USER_ID=self.user).exists())

    def test_notification_failure_rolls_back_approval_workflow(self):
        application = self._build_complete_application()
        self.user.USER_ROLE = User.UserRole.EXPLORER
        self.user.save(update_fields=["USER_ROLE", "USER_UPDATED_AT"])
        application = MerchantApplicationService.submit_application(application)

        with patch(
            "apps.notifications.services.notification_event_service."
            "NotificationService.create",
            side_effect=RuntimeError("Notification write failed"),
        ):
            with self.assertRaisesMessage(
                RuntimeError,
                "Notification write failed",
            ):
                AdminApplicationService.approve_application(
                    application.MAPP_ID,
                    self.admin,
                )

        application.refresh_from_db()
        self.user.refresh_from_db()
        self.assertEqual(
            application.MAPP_STATUS,
            MerchantApplication.ApplicationStatus.SUBMITTED,
        )
        self.assertIsNone(application.BUSN_ID_id)
        self.assertEqual(self.user.USER_ROLE, User.UserRole.EXPLORER)
        self.assertFalse(Business.objects.filter(USER_ID=self.user).exists())
        self.assertFalse(
            MerchantApplicationReview.objects.filter(MAPP_ID=application).exists(),
        )
        self.assertFalse(Notification.objects.filter(USER_ID=self.user).exists())
