from concurrent.futures import ThreadPoolExecutor, TimeoutError
from threading import Event
from unittest import skipUnless

from django.db import connection, connections, transaction
from django.test import TransactionTestCase
from rest_framework.exceptions import ValidationError

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.moderation.services.manage_review_dispute_service import (
    ManageReviewDisputeService,
)
from apps.notifications.models import Notification
from apps.review_disputes.services.review_snapshot_service import DisputeContentConflict
from apps.review_disputes.services.tests.test_review_snapshots import SnapshotFixtures
from apps.reviews.models import Review, ReviewMediaCleanup, ReviewPhoto
from apps.reviews.services.review_media_cleanup_service import ReviewMediaCleanupService
from apps.reviews.services.review_service import ReviewService
from apps.users.models import ReputationEvent


@skipUnless(connection.vendor == "postgresql", "Requires PostgreSQL transaction locks.")
class ReviewSnapshotConcurrencyTests(SnapshotFixtures, TransactionTestCase):
    def test_admin_detail_waits_for_edit_and_returns_one_coherent_current_version(self):
        dispute = self.file_dispute()
        started = Event()
        with ThreadPoolExecutor(max_workers=1) as executor:
            with transaction.atomic():
                self.edit(text="The complete current version returned to the Admin.")
                future = executor.submit(
                    self.worker,
                    started,
                    lambda: self.detail(dispute),
                )
                self.assert_blocked(future, started)
            data = future.result(timeout=10)
        self.assertEqual(data["current_content_fingerprint"], self.token())
        self.assertNotEqual(data["current_review"]["text"], data["review_at_filing"]["text"])
        self.assertTrue(data["material_content_changed"])

    def worker(
        self,
        started,
        operation,
    ):
        connections.close_all()
        try:
            started.set()
            return operation()
        finally:
            connections.close_all()

    def assert_blocked(
        self,
        future,
        started,
    ):
        self.assertTrue(started.wait(5))
        with self.assertRaises(TimeoutError):
            future.result(timeout=0.2)

    def test_snapshot_waits_for_atomic_text_and_photo_edit(self):
        started = Event()
        with ThreadPoolExecutor(max_workers=1) as executor:
            with transaction.atomic():
                review = Review.objects.select_for_update().get(pk=self.review.pk)
                review.REVW_TEXT = "Committed together with the replacement photo."
                review.save()
                future = executor.submit(self.worker, started, self.file_dispute)
                self.assert_blocked(future, started)
                self.photo.delete()
                replacement = ReviewPhoto.objects.create(
                    REVW_ID=review,
                    RPHO_PHOTO_URL="https://example.com/replaced.jpg",
                    RPHO_PHOTO_PUBLIC_ID="review/replaced",
                )
            dispute = future.result(timeout=10)
        self.assertEqual(dispute.snapshot.MRDS_TEXT, review.REVW_TEXT)
        self.assertEqual(dispute.snapshot.MRDS_PHOTOS[0]["id"], replacement.pk)

    def test_actual_safe_edit_waits_for_filing_and_keeps_original_snapshot(self):
        started = Event()
        original = self.review.REVW_TEXT
        with ThreadPoolExecutor(max_workers=1) as executor:
            with transaction.atomic():
                dispute = self.file_dispute()
                future = executor.submit(
                    self.worker,
                    started,
                    lambda: self.edit(text="The explorer's later safe edit."),
                )
                self.assert_blocked(future, started)
            future.result(timeout=10)
        self.review.refresh_from_db()
        self.assertNotEqual(self.review.REVW_TEXT, original)
        self.assertEqual(dispute.snapshot.MRDS_TEXT, original)
        self.assertEqual(self.review.REVW_STATUS, "published")

    def test_cleanup_skips_uncommitted_snapshot_asset_lock_then_retains(self):
        record = self.cleanup_record()
        started = Event()
        with ThreadPoolExecutor(max_workers=1) as executor:
            with transaction.atomic():
                self.file_dispute()
                future = executor.submit(
                    self.worker,
                    started,
                    lambda: ReviewMediaCleanupService.process(record.pk),
                )
                self.assertEqual(future.result(timeout=5)["status"], "skipped")
                self.destroy.assert_not_called()
        ReviewService.delete_photo(self.explorer, self.photo.pk)
        self.assertEqual(ReviewMediaCleanupService.process(record.pk)["status"], "retained")
        record.refresh_from_db()
        self.assertEqual(record.RMCU_ATTEMPTS, 0)
        self.destroy.assert_not_called()

    def test_filing_waits_for_cleanup_lock_and_live_reference_prevents_loss(self):
        record = self.cleanup_record()
        started = Event()
        with ThreadPoolExecutor(max_workers=1) as executor:
            with transaction.atomic():
                self.assertEqual(
                    ReviewMediaCleanupService.process(record.pk)["status"],
                    "retained",
                )
                future = executor.submit(self.worker, started, self.file_dispute)
                self.assert_blocked(future, started)
                self.destroy.assert_not_called()
            dispute = future.result(timeout=10)
        self.assertEqual(dispute.snapshot.MRDS_PHOTOS[0]["id"], self.photo.pk)
        self.destroy.assert_not_called()

    def test_stale_decision_waits_for_edit_then_conflicts_without_effects(self):
        dispute = self.file_dispute()
        token = self.token()
        started = Event()
        with ThreadPoolExecutor(max_workers=1) as executor:
            with transaction.atomic():
                self.edit(text="The edit committed while the administrator was deciding.")
                future = executor.submit(
                    self.worker,
                    started,
                    lambda: self.decision(dispute, expected_fingerprint=token),
                )
                self.assert_blocked(future, started)
            with self.assertRaises(DisputeContentConflict):
                future.result(timeout=10)
        dispute.refresh_from_db()
        self.assertEqual(dispute.MRDSP_STATUS, "pending")
        self.assertFalse(AdminActivity.objects.exists())
        self.assertFalse(ReputationEvent.objects.exists())
        self.assertFalse(Notification.objects.exists())

    def test_two_admin_decisions_apply_only_once(self):
        dispute = self.file_dispute()
        token = self.token()
        started = Event()
        with ThreadPoolExecutor(max_workers=1) as executor:
            with transaction.atomic():
                self.decision(dispute)
                future = executor.submit(
                    self.worker,
                    started,
                    lambda: self.decision(dispute, uphold=False, expected_fingerprint=token),
                )
                self.assert_blocked(future, started)
            with self.assertRaises(ValidationError):
                future.result(timeout=10)
        self.assertEqual(AdminActivity.objects.count(), 1)
        self.assertEqual(ReputationEvent.objects.count(), 1)
        self.assertEqual(Notification.objects.count(), 2)

    def test_deletion_wins_over_waiting_decision_and_preserves_snapshot(self):
        dispute = self.file_dispute()
        token = self.token()
        started = Event()
        with ThreadPoolExecutor(max_workers=1) as executor:
            with transaction.atomic():
                ReviewService.delete_review(self.explorer, self.review.pk)
                future = executor.submit(
                    self.worker,
                    started,
                    lambda: ManageReviewDisputeService.uphold_dispute(
                        dispute.pk,
                        actor=self.admin,
                        expected_fingerprint=token,
                    ),
                )
                self.assert_blocked(future, started)
            with self.assertRaises(ValidationError):
                future.result(timeout=10)
        dispute.refresh_from_db()
        self.assertEqual(dispute.MRDSP_STATUS, "author_deleted")
        self.assertIsNone(dispute.REVW_ID_id)
        self.assertTrue(dispute.snapshot.MRDS_PHOTOS)
        self.assertFalse(ReputationEvent.objects.exists())
        self.assertEqual(AdminActivity.objects.count(), 1)

    def test_concurrent_submissions_keep_one_complete_snapshot(self):
        started = Event()
        with ThreadPoolExecutor(max_workers=1) as executor:
            with transaction.atomic():
                dispute = self.file_dispute()
                future = executor.submit(self.worker, started, self.file_dispute)
                self.assert_blocked(future, started)
            with self.assertRaises(ValidationError):
                future.result(timeout=10)
        self.assertEqual(dispute.snapshot.MRDS_FINGERPRINT, self.token())
        self.assertEqual(self.review.merchant_disputes.count(), 1)

    def test_snapshot_release_and_cleanup_cannot_delete_another_attempts_asset(self):
        first = self.file_dispute()
        self.decision(first, uphold=False)
        self.file_dispute()
        ReviewService.delete_photo(self.explorer, self.photo.pk)
        record = ReviewMediaCleanup.objects.get()
        started = Event()
        with ThreadPoolExecutor(max_workers=1) as executor:
            with transaction.atomic():
                first.delete()
                future = executor.submit(
                    self.worker,
                    started,
                    lambda: ReviewMediaCleanupService.process(record.pk),
                )
                self.assertEqual(future.result(timeout=5)["status"], "skipped")
            self.assertEqual(ReviewMediaCleanupService.process(record.pk)["status"], "retained")
        self.destroy.assert_not_called()
