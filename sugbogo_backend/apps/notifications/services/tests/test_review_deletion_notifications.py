from concurrent.futures import ThreadPoolExecutor
from unittest import skipUnless
from unittest.mock import patch

from django.db import DatabaseError, close_old_connections, connection, transaction
from django.test import TestCase, TransactionTestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.moderation.services.manage_review_dispute_service import (
    ManageReviewDisputeService,
)
from apps.admin_operations.moderation.services.tests import (
    test_manage_review_dispute_service as dispute_tests,
)
from apps.notifications.models import Notification
from apps.notifications.serializers.notification_serializers import NotificationResponseSerializer
from apps.notifications.services.notification_event_service import NotificationEventService
from apps.notifications.services.notification_realtime_service import NotificationRealtimeService
from apps.notifications.services.notification_service import NotificationService
from apps.reviews.models import Review, ReviewMediaCleanup, ReviewPhoto, ReviewReport
from apps.reviews.services.review_service import ReviewService
from apps.users.models import ReputationEvent


REPORT_CLOSURE = "review_report_closed_by_author"
DISPUTE_CLOSURE = "review_dispute_closed_by_author"


class ReviewDeletionNotificationTests(TestCase):
    """Exercise closure notices through deletion and existing inbox APIs."""

    create_dispute = dispute_tests.ManageReviewDisputeServiceTests.create_dispute

    def setUp(self):
        dispute_tests.ManageReviewDisputeServiceTests.setUp(self)
        self.client = APIClient()
        self.business.BUSN_REVIEW_COUNT = 1
        self.business.save(update_fields=["BUSN_REVIEW_COUNT"])
        self.publish = self.enterContext(patch.object(NotificationRealtimeService, "publish"))
        self.cleanup = self.enterContext(
            patch("apps.reviews.tasks.cleanup_review_media_asset.apply_async"),
        )
        self.enterContext(patch("apps.reviews.tasks.refresh_business_review_insights.delay"))
        ReviewPhoto.objects.create(
            REVW_ID=self.review,
            RPHO_PHOTO_URL="https://example.com/review.jpg",
            RPHO_PHOTO_PUBLIC_ID="closure-review-photo",
        )

    def _report(
        self,
        user=None,
        status=ReviewReport.ReportStatus.PENDING,
    ):
        return ReviewReport.objects.create(
            REVW_ID=self.review,
            USER_ID=user or self.second_explorer,
            RREP_STATUS=status,
            RREP_TYPE=ReviewReport.ReportType.ABUSE,
            RREP_EXPLANATION="Private report explanation.",
        )

    def _delete(self):
        self.client.force_authenticate(user=self.explorer)
        response = self.client.delete(reverse("review-detail", args=[self.review.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertFalse(Review.objects.filter(pk=self.review.pk).exists())
        self.assertEqual(AdminActivity.objects.count(), 1)
        self.assertEqual(ReviewMediaCleanup.objects.count(), 1)
        self.assertFalse(ReputationEvent.objects.exists())
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, 0)

    def _assert_notice(
        self,
        recipient,
        event_type,
        title,
    ):
        notice = Notification.objects.get(USER_ID=recipient, NOTF_TYPE=event_type)
        self.assertEqual(notice.NOTF_TITLE, title)
        self.assertIn(self.business.BUSN_NAME, notice.NOTF_BODY)
        self.assertIn("removed by its author", notice.NOTF_BODY)
        self.assertIn("closed without an Admin decision", notice.NOTF_BODY)
        self.assertEqual(notice.NOTF_TARGET_TYPE, "")
        self.assertIsNone(notice.NOTF_TARGET_ID)
        self.assertNotIn(self.review.REVW_TEXT, notice.NOTF_BODY)
        self.assertNotIn("Private report explanation", notice.NOTF_BODY)
        self.assertFalse(Notification.objects.filter(USER_ID=self.explorer).exists())
        return notice

    def test_one_pending_report_notifies_only_reporter(self):
        self._report()
        self._delete()
        self.assertEqual(Notification.objects.count(), 1)
        self._assert_notice(self.second_explorer, REPORT_CLOSURE, "Report closed")

    def test_multiple_pending_reports_notify_each_submitter(self):
        recipients = (self.second_explorer, self.admin, self.second_merchant)
        for recipient in recipients:
            self._report(user=recipient)
        self._delete()
        self.assertEqual(Notification.objects.count(), 3)
        for recipient in recipients:
            self._assert_notice(recipient, REPORT_CLOSURE, "Report closed")

    def test_pending_dispute_notifies_submitting_merchant(self):
        self.create_dispute()
        self._delete()
        self.assertEqual(Notification.objects.count(), 1)
        self._assert_notice(self.merchant, DISPUTE_CLOSURE, "Review dispute closed")

    def test_dispute_closure_uses_submitter_not_current_business_owner(self):
        self.create_dispute(merchant=self.second_merchant)
        self._delete()
        self._assert_notice(self.second_merchant, DISPUTE_CLOSURE, "Review dispute closed")
        self.assertFalse(Notification.objects.filter(USER_ID=self.merchant).exists())

    def test_both_case_types_produce_independent_untargeted_notices(self):
        self._report()
        self.create_dispute()
        self._delete()
        self.assertEqual(Notification.objects.count(), 2)
        self._assert_notice(self.second_explorer, REPORT_CLOSURE, "Report closed")
        self._assert_notice(self.merchant, DISPUTE_CLOSURE, "Review dispute closed")
        self.client.force_authenticate(user=self.second_explorer)
        response = self.client.get(reverse("notification-list"))
        item = response.data["data"]["items"][0]
        self.assertEqual(item["target_type"], "")
        self.assertIsNone(item["target_id"])

    def test_resolved_cases_produce_no_new_closure_notice(self):
        for recipient, status in (
            (self.second_explorer, "approved"),
            (self.admin, "rejected"),
            (self.second_merchant, "withdrawn"),
        ):
            self._report(user=recipient, status=status)
        for status in ("upheld", "dismissed", "withdrawn"):
            self.create_dispute(status=status)
        self._delete()
        self.assertFalse(Notification.objects.exists())

    def test_ai_hold_without_cases_does_not_notify_author(self):
        self.review.REVW_STATUS = Review.ReviewStatus.UNDER_REVIEW
        self.review.REVW_MODERATION_DATA = {"outcome": "provider_failure"}
        self.review.save(update_fields=["REVW_STATUS", "REVW_MODERATION_DATA"])
        self.business.BUSN_REVIEW_COUNT = 0
        self.business.save(update_fields=["BUSN_REVIEW_COUNT"])
        self._delete()
        self.assertFalse(Notification.objects.exists())

    def test_no_cases_produce_no_closure_notice(self):
        self._delete()
        self.assertFalse(Notification.objects.exists())

    def test_legacy_self_cases_do_not_notify_deleting_author(self):
        self._report(user=self.explorer)
        self.create_dispute(merchant=self.explorer)
        self._delete()
        self.assertFalse(Notification.objects.exists())

    def test_repeated_delete_and_event_delivery_do_not_duplicate_notices(self):
        report = self._report()
        dispute = self.create_dispute()
        self._delete()
        response = self.client.delete(reverse("review-detail", args=[self.review.pk]))
        self.assertEqual(response.status_code, 404)
        NotificationEventService.review_cases_closed_by_author(
            author_id=self.explorer.pk,
            pending_reports=[{"RREP_ID": report.pk, "USER_ID_id": report.USER_ID_id}],
            pending_disputes=[{"MRDSP_ID": dispute.pk, "USER_ID_id": dispute.USER_ID_id}],
        )
        self.assertEqual(Notification.objects.count(), 2)

    def test_notification_failure_rolls_back_prior_notice_audit_and_deletion(self):
        report = self._report()
        dispute = self.create_dispute()
        original = NotificationService.create
        calls = 0

        def fail_second(**kwargs):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise RuntimeError("Inbox persistence failed")
            return original(**kwargs)

        with patch.object(NotificationService, "create", side_effect=fail_second):
            with self.captureOnCommitCallbacks(execute=True):
                with self.assertRaisesMessage(RuntimeError, "Inbox persistence failed"):
                    ReviewService.delete_review(self.explorer, self.review.pk)
        self.assertFalse(Notification.objects.exists())
        self.assertFalse(AdminActivity.objects.exists())
        self.assertFalse(ReviewMediaCleanup.objects.exists())
        self.assertTrue(Review.objects.filter(pk=self.review.pk).exists())
        report.refresh_from_db()
        dispute.refresh_from_db()
        self.assertEqual(report.RREP_STATUS, "pending")
        self.assertEqual(dispute.MRDSP_STATUS, "pending")
        self.publish.assert_not_called()
        self.cleanup.assert_not_called()

    def test_later_database_failure_discards_notices_and_external_callbacks(self):
        self._report()
        with patch(
            "apps.reviews.services.review_service.BusinessReviewSummaryService.recompute_sentiment",
            side_effect=DatabaseError("Deletion failed"),
        ):
            with self.captureOnCommitCallbacks(execute=True):
                with self.assertRaises(DatabaseError):
                    ReviewService.delete_review(self.explorer, self.review.pk)
        self.assertFalse(Notification.objects.exists())
        self.assertFalse(AdminActivity.objects.exists())
        self.assertFalse(ReviewMediaCleanup.objects.exists())
        self.assertTrue(Review.objects.filter(pk=self.review.pk).exists())
        self.publish.assert_not_called()
        self.cleanup.assert_not_called()

    def test_historical_dispute_notice_loses_unavailable_target_only_in_response(self):
        dispute = self.create_dispute()
        ManageReviewDisputeService.dismiss_dispute(dispute.pk, actor=self.admin)
        notice = Notification.objects.get()
        self.client.force_authenticate(user=self.merchant)
        before = self.client.get(reverse("notification-list"))
        self.assertEqual(before.data["data"]["items"][0]["target_id"], dispute.pk)
        ReviewService.delete_review(self.explorer, self.review.pk)
        response = self.client.get(reverse("notification-list"))
        item = response.data["data"]["items"][0]
        self.assertEqual(item["id"], notice.pk)
        self.assertEqual(item["target_type"], "")
        self.assertIsNone(item["target_id"])
        opened = self.client.post(reverse("notification-read", args=[notice.pk]))
        self.assertEqual(opened.status_code, 200)
        self.assertIsNone(opened.data["data"]["target_id"])
        cached_target = self.client.get(reverse("review-dispute-detail", args=[dispute.pk]))
        self.assertEqual(cached_target.status_code, 404)
        self.assertEqual(cached_target.data["code"], "NOT_FOUND")
        notice.refresh_from_db()
        self.assertEqual(notice.NOTF_TARGET_ID, dispute.pk)
        self.assertEqual(Notification.objects.count(), 1)

    def test_historical_missing_targets_do_not_add_per_item_queries(self):
        for target_id in range(100, 110):
            NotificationService.create(
                recipient=self.merchant,
                event_type="review_dispute_dismissed",
                title="Historical decision",
                body="Your dispute was dismissed after inspection.",
                dedup_key=f"historical:{target_id}",
                target_type="review_dispute",
                target_id=target_id,
            )
        with self.assertNumQueries(1):
            data = NotificationResponseSerializer(
                NotificationService.queryset(self.merchant),
                many=True,
            ).data
        self.assertEqual(len(data), 10)
        self.assertTrue(all(item["target_id"] is None for item in data))

    def test_historical_dispute_target_must_belong_to_recipient(self):
        dispute = self.create_dispute()
        notice = NotificationService.create(
            recipient=self.second_merchant,
            event_type="review_dispute_dismissed",
            title="Historical decision",
            body="Your dispute was dismissed after inspection.",
            dedup_key="historical-wrong-owner",
            target_type="review_dispute",
            target_id=dispute.pk,
        )
        data = NotificationResponseSerializer(notice).data
        self.assertEqual(data["target_type"], "")
        self.assertIsNone(data["target_id"])

    def test_unrelated_notification_targets_keep_their_existing_contract(self):
        NotificationService.create(
            recipient=self.merchant,
            event_type="business_name_change_approved",
            title="Request decision",
            body="Your business name change was approved after inspection.",
            dedup_key="other-request",
            target_type="business_name_change",
            target_id=999,
        )
        self.client.force_authenticate(user=self.merchant)
        response = self.client.get(reverse("notification-list"))
        item = response.data["data"]["items"][0]
        self.assertEqual(item["target_type"], "business_name_change")
        self.assertEqual(item["target_id"], 999)


@skipUnless(connection.vendor == "postgresql", "Requires PostgreSQL transactions.")
class ReviewClosureCommitTests(TransactionTestCase):
    """Verify inbox visibility and external publication across real commits."""

    def setUp(self):
        dispute_tests.ManageReviewDisputeServiceTests.setUp(self)
        self.report = ReviewReport.objects.create(
            REVW_ID=self.review,
            USER_ID=self.second_explorer,
            RREP_TYPE="abuse",
        )
        ReviewPhoto.objects.create(
            REVW_ID=self.review,
            RPHO_PHOTO_URL="https://example.com/review.jpg",
            RPHO_PHOTO_PUBLIC_ID="closure-commit-photo",
        )
        self.enterContext(patch("apps.reviews.tasks.refresh_business_review_insights.delay"))

    def test_notice_and_cleanup_publish_only_after_actual_commit(self):
        observations = []

        def observe(recipient_id):
            in_atomic = connection.in_atomic_block

            def read_committed():
                close_old_connections()
                try:
                    return (
                        Review.objects.filter(pk=self.review.pk).exists(),
                        Notification.objects.filter(USER_ID_id=recipient_id).count(),
                        AdminActivity.objects.count(),
                        ReviewMediaCleanup.objects.count(),
                    )
                finally:
                    connection.close()

            with ThreadPoolExecutor(max_workers=1) as executor:
                observations.append(
                    (in_atomic, executor.submit(read_committed).result(timeout=5)),
                )

        with (
            patch.object(NotificationRealtimeService, "publish", side_effect=observe) as publish,
            patch("apps.reviews.tasks.cleanup_review_media_asset.apply_async") as cleanup,
        ):
            with transaction.atomic():
                ReviewService.delete_review(self.explorer, self.review.pk)
                publish.assert_not_called()
                cleanup.assert_not_called()
            publish.assert_called_once_with(self.second_explorer.pk)
            cleanup.assert_called_once()
        self.assertEqual(observations, [(False, (False, 1, 1, 1))])

    def test_actual_rollback_discards_closure_and_delivery(self):
        with (
            patch.object(NotificationRealtimeService, "publish") as publish,
            patch("apps.reviews.tasks.cleanup_review_media_asset.apply_async") as cleanup,
        ):
            with self.assertRaises(RuntimeError):
                with transaction.atomic():
                    ReviewService.delete_review(self.explorer, self.review.pk)
                    self.assertEqual(Notification.objects.count(), 1)
                    raise RuntimeError("Rollback deletion")
        publish.assert_not_called()
        cleanup.assert_not_called()
        self.assertFalse(Notification.objects.exists())
        self.assertFalse(AdminActivity.objects.exists())
        self.assertFalse(ReviewMediaCleanup.objects.exists())
        self.assertTrue(Review.objects.filter(pk=self.review.pk).exists())
