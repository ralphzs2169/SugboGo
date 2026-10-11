from unittest.mock import AsyncMock, patch

from django.test import TestCase
from django.urls import reverse
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.moderation.services.manage_review_dispute_service import ManageReviewDisputeService
from apps.admin_operations.moderation.services.manage_review_report_service import ManageReviewReportService
from apps.admin_operations.moderation.services.tests.test_manage_review_report_service import ReportFixtures
from apps.notifications.models import Notification
from apps.notifications.services.notification_service import NotificationService
from apps.review_disputes.models import MerchantReviewDispute
from apps.reviews.models import ReviewReport
from apps.users.models import ReputationEvent


class ReviewDecisionNotificationTests(ReportFixtures, TestCase):
    def dispute(self):
        """Create a pending merchant dispute for the same reported review."""
        return MerchantReviewDispute.objects.create(
            USER_ID=self.business.USER_ID,
            BUSN_ID=self.business,
            REVW_ID=self.review,
            MRDSP_REASON="fake_review",
            MRDSP_DESCRIPTION="Private evidence for administrator inspection.",
        )

    def approve_report(self, report=None):
        """Resolve a report using the administrator service."""
        return ManageReviewReportService.resolve(
            (report or self.report).pk, actor=self.admin,
            admin_notes="Private administrator notes must not leak.", approve=True,
        )

    def test_approved_report_notifies_reporter_and_author_without_private_content(self):
        self.approve_report()
        self.assertEqual(Notification.objects.count(), 2)
        self.assertEqual(
            set(Notification.objects.values_list("USER_ID_id", "NOTF_TYPE")),
            {(self.user.pk, "review_report_approved"),
             (self.second_user.pk, "review_rejected")},
        )
        for notification in Notification.objects.all():
            self.assertEqual(notification.NOTF_TARGET_TYPE, "")
            self.assertIsNone(notification.NOTF_TARGET_ID)
            for private in (self.review.REVW_TEXT, self.user.USER_EMAIL,
                            "Private administrator notes", "private-device"):
                self.assertNotIn(private, notification.NOTF_BODY)

    def test_rejected_report_notifies_only_reporter_and_does_not_claim_clearance(self):
        self.review.REVW_IS_SPAM_FLAGGED = True
        self.review.save()
        ManageReviewReportService.resolve(
            self.report.pk, actor=self.admin,
            admin_notes="Private notes after inspection.", approve=False,
        )
        notification = Notification.objects.get()
        self.assertEqual(notification.USER_ID_id, self.user.pk)
        self.assertEqual(notification.NOTF_TYPE, "review_report_rejected")
        self.assertNotIn("cleared", notification.NOTF_BODY)
        self.review.refresh_from_db()
        self.assertTrue(self.review.REVW_IS_SPAM_FLAGGED)

    def test_sibling_reports_have_independent_outcomes_and_one_author_notice(self):
        sibling = ReviewReport.objects.create(
            USER_ID=self.admin, REVW_ID=self.review, RREP_TYPE="spam",
        )
        self.approve_report()
        self.approve_report(sibling)
        self.assertEqual(Notification.objects.filter(NOTF_TYPE="review_report_approved").count(), 2)
        self.assertEqual(Notification.objects.filter(NOTF_TYPE="review_rejected").count(), 1)
        with self.assertRaises(ValidationError):
            self.approve_report()
        self.assertEqual(Notification.objects.count(), 3)

    def test_self_report_gets_two_distinct_event_notices_without_reward(self):
        self.report.USER_ID = self.second_user
        self.report.save()
        self.approve_report()
        self.assertEqual(Notification.objects.filter(USER_ID=self.second_user).count(), 2)
        self.assertEqual(ReputationEvent.objects.count(), 1)

    def test_report_and_dispute_share_single_author_rejection_key_in_both_orders(self):
        dispute = self.dispute()
        ManageReviewDisputeService.uphold_dispute(
            dispute.pk, actor=self.admin, admin_notes="Private inspection notes.",
        )
        self.approve_report()
        self.assertEqual(Notification.objects.filter(NOTF_TYPE="review_rejected").count(), 1)
        self.assertEqual(Notification.objects.count(), 3)

    def test_report_then_upheld_dispute_does_not_repeat_author_notice(self):
        dispute = self.dispute()
        self.approve_report()
        ManageReviewDisputeService.uphold_dispute(
            dispute.pk, actor=self.admin, admin_notes="Private inspection notes.",
        )
        self.assertEqual(Notification.objects.filter(NOTF_TYPE="review_rejected").count(), 1)
        self.assertEqual(Notification.objects.count(), 3)

    def test_dismissed_dispute_notifies_only_submitting_merchant(self):
        dispute = self.dispute()
        ManageReviewDisputeService.dismiss_dispute(
            dispute.pk, actor=self.admin, admin_notes="Private inspection notes.",
        )
        notification = Notification.objects.get()
        self.assertEqual(notification.USER_ID_id, dispute.USER_ID_id)
        self.assertEqual(notification.NOTF_TYPE, "review_dispute_dismissed")
        self.assertEqual(notification.NOTF_TARGET_TYPE, "review_dispute")
        self.assertEqual(notification.NOTF_TARGET_ID, dispute.pk)
        self.assertNotIn(dispute.MRDSP_DESCRIPTION, notification.NOTF_BODY)
        self.assertNotIn("cleared", notification.NOTF_BODY)

    def test_upheld_dispute_notifies_merchant_and_author(self):
        dispute = self.dispute()
        ManageReviewDisputeService.uphold_dispute(
            dispute.pk, actor=self.admin, admin_notes="Private inspection notes.",
        )
        self.assertEqual(
            set(Notification.objects.values_list("USER_ID_id", "NOTF_TYPE")),
            {(dispute.USER_ID_id, "review_dispute_upheld"),
             (self.second_user.pk, "review_rejected")},
        )

    def test_second_notification_failure_rolls_back_report_and_first_notice(self):
        original = NotificationService.create
        calls = 0

        def fail_second(**kwargs):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise RuntimeError("Inbox storage unavailable")
            return original(**kwargs)

        with patch("apps.reviews.tasks.refresh_business_review_insights.delay") as enqueue:
            with self.captureOnCommitCallbacks(execute=True):
                with patch("apps.notifications.services.notification_event_service.NotificationService.create",
                           side_effect=fail_second):
                    with self.assertRaises(RuntimeError):
                        self.approve_report()
            enqueue.assert_not_called()
        self.report.refresh_from_db()
        self.review.refresh_from_db()
        self.assertEqual(self.report.RREP_STATUS, "pending")
        self.assertEqual(self.review.REVW_STATUS, "published")
        self.assertFalse(Notification.objects.exists())
        self.assertFalse(AdminActivity.objects.exists())
        self.assertFalse(ReputationEvent.objects.exists())

    def test_notification_failure_rolls_back_each_dispute_outcome(self):
        for method in (ManageReviewDisputeService.uphold_dispute,
                       ManageReviewDisputeService.dismiss_dispute):
            with self.subTest(method=method.__name__):
                dispute = self.dispute()
                with patch("apps.notifications.services.notification_event_service.NotificationService.create",
                           side_effect=RuntimeError("Inbox storage unavailable")):
                    with self.assertRaises(RuntimeError):
                        method(dispute.pk, actor=self.admin, admin_notes="Inspection notes.")
                dispute.refresh_from_db()
                self.review.refresh_from_db()
                self.assertEqual(dispute.MRDSP_STATUS, "pending")
                self.assertEqual(self.review.REVW_STATUS, "published")
                self.assertFalse(Notification.objects.exists())
                self.assertFalse(AdminActivity.objects.exists())
                self.assertFalse(ReputationEvent.objects.exists())
                dispute.delete()

    def test_audit_failure_produces_no_notification(self):
        with patch("apps.admin_operations.moderation.services.manage_review_report_service.AdminActivityService.record_user_action",
                   side_effect=RuntimeError("Audit storage unavailable")):
            with self.assertRaises(RuntimeError):
                self.approve_report()
        self.assertFalse(Notification.objects.exists())

    def test_unauthorized_api_decision_produces_no_notification(self):
        client = APIClient()
        client.force_authenticate(self.user)
        response = client.post(
            reverse("admin-review-report-approve", args=[self.report.pk]),
            {"admin_notes": "Unauthorized moderation attempt."},
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Notification.objects.exists())

    def test_live_delivery_failure_does_not_undo_approved_report(self):
        layer = type("FailingLayer", (), {
            "group_send": AsyncMock(side_effect=RuntimeError("Redis unavailable")),
        })()
        with (
            patch("apps.notifications.services.notification_realtime_service.get_channel_layer",
                  return_value=layer),
            patch("apps.reviews.tasks.refresh_business_review_insights.delay"),
            self.assertLogs("apps.notifications.services.notification_realtime_service",
                            level="WARNING"),
        ):
            with self.captureOnCommitCallbacks(execute=True):
                self.approve_report()
        self.report.refresh_from_db()
        self.review.refresh_from_db()
        self.assertEqual(self.report.RREP_STATUS, "approved")
        self.assertEqual(self.review.REVW_STATUS, "rejected")
        self.assertEqual(Notification.objects.count(), 2)
        self.assertEqual(AdminActivity.objects.count(), 1)
        self.assertEqual(ReputationEvent.objects.count(), 2)
