from unittest.mock import patch

from django.db import transaction
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.admin_operations.system_configuration.models import AnalyticsPolicyConfiguration
from apps.notifications.models import Notification
from apps.notifications.serializers.notification_serializers import NotificationResponseSerializer
from apps.notifications.services.admin_notification_service import AdminNotificationService
from apps.notifications.services.notification_realtime_service import NotificationRealtimeService
from apps.notifications.services.notification_service import NotificationService
from apps.notifications.tests.fixtures import NotificationFixtures
from apps.review_disputes.models import MerchantReviewDispute
from apps.review_disputes.services.review_dispute_service import ReviewDisputeService
from apps.reviews.models import Review, ReviewReport
from apps.reviews.services.review_moderation_retry_service import ReviewModerationRetryService
from apps.reviews.services.review_report_service import AlreadyReported, ReviewReportService
from apps.reviews.services.tests.test_review_moderation_retry_task import (
    create_held_review,
    moderation_result,
)
from apps.users.models import User


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class AdminNotificationTests(NotificationFixtures, TestCase):
    """Exercise administrator events through the existing transactional workflows."""

    def setUp(self):
        """Create independent administrators and a review with controlled delivery."""
        super().setUp()
        self.admin = self.make_user("admin", User.UserRole.ADMIN)
        self.super_admin = self.make_user("super-admin", User.UserRole.SUPER_ADMIN)
        self.review, self.business = create_held_review()
        self.merchant = self.business.USER_ID
        self.merchant.USER_ROLE = User.UserRole.MERCHANT
        self.merchant.save(update_fields=["USER_ROLE"])
        self.publish = self.enterContext(
            patch.object(NotificationRealtimeService, "publish"),
        )

    def _publish_review(self):
        """Make the persisted review eligible for reports and merchant disputes."""
        self.review.REVW_STATUS = Review.ReviewStatus.PUBLISHED
        self.review.save(update_fields=["REVW_STATUS"])

    def _report(self):
        """File an accepted report using the existing service."""
        return ReviewReportService.create_report(
            user=self.user,
            review_id=self.review.pk,
            report_type=ReviewReport.ReportType.SPAM,
        )

    def _dispute(self):
        """File an owned merchant dispute using the existing service."""
        return ReviewDisputeService.create_dispute(
            user=self.merchant,
            review_id=self.review.pk,
            reason=MerchantReviewDispute.DisputeReason.FAKE_REVIEW,
            description="Please investigate this review's authenticity.",
        )

    def _assert_event(
        self,
        event_type,
        target_type,
        target_id,
        dedup_key,
    ):
        """Check exact recipients, independent rows, and persisted event destinations."""
        notifications = Notification.objects.filter(NOTF_TYPE=event_type)
        self.assertEqual(notifications.count(), 2)
        self.assertSetEqual(
            set(notifications.values_list("USER_ID_id", flat=True)),
            {self.admin.pk, self.super_admin.pk},
        )
        for notification in notifications:
            self.assertEqual(notification.NOTF_TARGET_TYPE, target_type)
            self.assertEqual(notification.NOTF_TARGET_ID, target_id)
            self.assertEqual(notification.NOTF_DEDUP_KEY, dedup_key)
            self.assertIsNone(notification.NOTF_READ_AT)

    def test_only_active_administrative_roles_receive_reports(self):
        """Exclude every inactive admin status and active non-administrative role."""
        for role in (User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN):
            for status in (
                User.UserStatus.PENDING,
                User.UserStatus.SUSPENDED,
                User.UserStatus.DISABLED,
            ):
                recipient = self.make_user(f"{role}-{status}", role)
                recipient.USER_STATUS = status
                recipient.save(update_fields=["USER_STATUS"])
        self._publish_review()
        report = self._report()
        self._assert_event(
            "admin_review_report_received",
            "admin_reported_review",
            self.review.pk,
            f"admin:review-report:{report.pk}:received",
        )
        self.assertEqual(Notification.objects.count(), 2)

    def test_report_reprocessing_preserves_read_state_and_publishes_after_commit(self):
        """Publish each new recipient row once and retain read state on repeats."""
        self._publish_review()
        with self.captureOnCommitCallbacks(execute=True):
            report = self._report()
            AdminNotificationService.review_report_received(report)
            self.publish.assert_not_called()
        self.assertEqual(self.publish.call_count, 2)
        for notification in Notification.objects.all():
            self.publish.assert_any_call(
                notification.USER_ID_id,
                notification_id=notification.pk,
            )
        own = Notification.objects.get(USER_ID=self.admin)
        NotificationService.mark_read(self.admin, own.pk)
        AdminNotificationService.review_report_received(report)
        own.refresh_from_db()
        self.assertIsNotNone(own.NOTF_READ_AT)
        self.assertEqual(NotificationService.unread_count(self.admin), 0)
        self.assertEqual(NotificationService.unread_count(self.super_admin), 1)
        self.assertEqual(Notification.objects.count(), 2)

    def test_rejected_report_attempts_do_not_notify(self):
        """Only an accepted report can create admin notifications."""
        with self.assertRaises(ValidationError):
            self._report()
        self.assertFalse(Notification.objects.exists())
        self._publish_review()
        self._report()
        with self.assertRaises(AlreadyReported):
            self._report()
        with self.assertRaises(ValidationError):
            ReviewReportService.create_report(
                user=self.review.USER_ID,
                review_id=self.review.pk,
                report_type=ReviewReport.ReportType.SPAM,
            )
        self.assertEqual(Notification.objects.count(), 2)

    def test_filed_dispute_is_idempotent_and_targets_the_admin_workspace(self):
        """Keep the merchant's filing and admin destination independent of ownership."""
        self._publish_review()
        dispute = self._dispute()
        AdminNotificationService.review_dispute_filed(dispute)
        with self.assertRaises(ValidationError):
            self._dispute()
        self._assert_event(
            "admin_review_dispute_filed",
            "admin_review_dispute",
            dispute.pk,
            f"admin:review-dispute:{dispute.pk}:filed",
        )
        self.assertTrue(hasattr(dispute, "snapshot"))
        self.assertFalse(Notification.objects.filter(USER_ID=self.merchant).exists())

    def test_report_and_dispute_rollbacks_remove_records_and_publication(self):
        """Keep inbox rows and realtime signals inside the filing transaction."""
        self._publish_review()
        for create_event in (self._report, self._dispute):
            with self.subTest(workflow=create_event.__name__):
                with self.captureOnCommitCallbacks(execute=True):
                    with self.assertRaises(RuntimeError):
                        with transaction.atomic():
                            create_event()
                            raise RuntimeError("Filing rolled back")
                self.assertFalse(Notification.objects.exists())
                self.publish.assert_not_called()
        self.assertFalse(ReviewReport.objects.exists())
        self.assertFalse(MerchantReviewDispute.objects.exists())

    def test_initial_flagged_review_notifies_once_after_actionable_result(self):
        """Avoid initial-work notices and deduplicate the human-review event."""
        self.review.REVW_MODERATION_DATA = ReviewModerationRetryService.initial_metadata()
        self.review.save(update_fields=["REVW_MODERATION_DATA"])
        AdminNotificationService.review_moderation_required(self.review)
        self.assertFalse(Notification.objects.exists())
        with patch(
            "apps.reviews.services.review_moderation_retry_service."
            "ReviewModerationService.moderate",
            return_value=moderation_result("flagged"),
        ):
            self.assertEqual(ReviewModerationRetryService.retry(self.review.pk), "flagged")
            self.assertEqual(ReviewModerationRetryService.retry(self.review.pk), "stale")
        self.review.refresh_from_db()
        AdminNotificationService.review_moderation_required(self.review)
        self._assert_event(
            "admin_review_moderation_required",
            "admin_review_moderation",
            self.review.pk,
            f"admin:review:{self.review.pk}:human-moderation",
        )

    def test_safe_automated_processing_does_not_notify_administrators(self):
        """Preserve the existing merchant notice for successful automatic publication."""
        AnalyticsPolicyConfiguration.objects.get_or_create(pk=1)
        self.review.REVW_MODERATION_DATA = ReviewModerationRetryService.initial_metadata()
        self.review.save(update_fields=["REVW_MODERATION_DATA"])
        with patch(
            "apps.reviews.services.review_moderation_retry_service."
            "ReviewModerationService.moderate",
            return_value=moderation_result("safe"),
        ):
            self.assertEqual(
                ReviewModerationRetryService.retry(self.review.pk),
                "published",
            )
        self.assertFalse(
            Notification.objects.filter(NOTF_TYPE__startswith="admin_").exists(),
        )
        self.assertEqual(
            Notification.objects.filter(
                USER_ID=self.merchant,
                NOTF_TYPE="business_review_received",
            ).count(),
            1,
        )

    def test_provider_failure_only_notifies_after_retry_exhaustion(self):
        """Suppress intermediate failures and notify at the persisted retry limit."""
        with patch(
            "apps.reviews.services.review_moderation_retry_service."
            "ReviewModerationService.moderate",
            return_value=moderation_result("provider_failure"),
        ):
            self.assertEqual(
                ReviewModerationRetryService.retry(self.review.pk),
                "provider_failure",
            )
            self.assertFalse(Notification.objects.exists())
            self.review.refresh_from_db()
            metadata = self.review.REVW_MODERATION_DATA
            metadata["retry_attempt"] = ReviewModerationRetryService.MAX_RETRIES
            metadata.pop("retry_next_attempt_at", None)
            metadata["last_attempted_at"] = "2026-01-01T00:00:00+00:00"
            self.review.save(update_fields=["REVW_MODERATION_DATA"])
            self.assertEqual(ReviewModerationRetryService.retry(self.review.pk), "exhausted")
            self.assertEqual(ReviewModerationRetryService.retry(self.review.pk), "stale")
        self._assert_event(
            "admin_review_moderation_required",
            "admin_review_moderation",
            self.review.pk,
            f"admin:review:{self.review.pk}:human-moderation",
        )

    def test_moderation_rollback_removes_admin_notifications_and_signals(self):
        """Do not publish actionable results that roll back with the owning transaction."""
        with patch(
            "apps.reviews.services.review_moderation_retry_service."
            "ReviewModerationService.moderate",
            return_value=moderation_result("flagged"),
        ):
            with self.captureOnCommitCallbacks(execute=True):
                with self.assertRaises(RuntimeError):
                    with transaction.atomic():
                        ReviewModerationRetryService.retry(self.review.pk)
                        raise RuntimeError("Moderation rolled back")
        self.assertFalse(Notification.objects.exists())
        self.publish.assert_not_called()

    def test_dispute_targets_preserve_admin_eligibility_and_merchant_ownership(self):
        """Keep admin targets available only to active admins and existing disputes."""
        self._publish_review()
        dispute = self._dispute()
        with self.assertNumQueries(1):
            data = NotificationResponseSerializer(
                NotificationService.queryset(self.admin),
                many=True,
            ).data
        self.assertEqual(data[0]["target_type"], "admin_review_dispute")
        self.assertEqual(data[0]["target_id"], dispute.pk)
        for recipient in (self.merchant, self.admin):
            notice = self.create_notification(
                recipient,
                key="merchant-dispute-target",
                target_type="review_dispute",
                target_id=dispute.pk,
            )
            serialized = NotificationResponseSerializer(notice).data
            if recipient == self.merchant:
                self.assertEqual(serialized["target_id"], dispute.pk)
            else:
                self.assertIsNone(serialized["target_id"])
        wrong_recipient = self.create_notification(
            target_type="admin_review_dispute",
            target_id=dispute.pk,
        )
        self.assertIsNone(NotificationResponseSerializer(wrong_recipient).data["target_id"])
        notice = Notification.objects.get(
            USER_ID=self.admin,
            NOTF_TYPE="admin_review_dispute_filed",
        )
        self.admin.USER_ROLE = User.UserRole.EXPLORER
        self.admin.save(update_fields=["USER_ROLE"])
        self.assertIsNone(NotificationResponseSerializer(notice).data["target_id"])
        self.admin.USER_ROLE = User.UserRole.ADMIN
        self.admin.USER_STATUS = User.UserStatus.DISABLED
        self.admin.save(update_fields=["USER_ROLE", "USER_STATUS"])
        self.assertIsNone(NotificationResponseSerializer(notice).data["target_id"])
        dispute.delete()
        other_notice = Notification.objects.get(USER_ID=self.super_admin)
        self.assertIsNone(NotificationResponseSerializer(other_notice).data["target_id"])

    def test_existing_inbox_api_keeps_admin_read_state_recipient_scoped(self):
        """Expose admin targets through existing endpoints without cross-recipient writes."""
        self._publish_review()
        self._dispute()
        client = APIClient()
        client.force_authenticate(self.admin)
        data = client.get(reverse("notification-list")).data["data"]
        self.assertEqual(len(data["items"]), 1)
        own = data["items"][0]
        self.assertEqual(own["target_type"], "admin_review_dispute")
        other = Notification.objects.get(USER_ID=self.super_admin)
        self.assertEqual(
            client.post(reverse("notification-read", args=[other.pk])).status_code,
            404,
        )
        self.assertEqual(
            client.post(reverse("notification-read", args=[own["id"]])).status_code,
            200,
        )
        self.assertEqual(
            client.get(reverse("notification-unread-count")).data["data"],
            {"unread_count": 0},
        )
        self.assertEqual(NotificationService.unread_count(self.super_admin), 1)
