from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from io import StringIO
from unittest import skipUnless
from unittest.mock import patch

from celery.exceptions import Retry
from cloudinary.exceptions import AuthorizationRequired
from django.core.management import call_command
from django.db import DatabaseError, close_old_connections, connection, transaction
from django.test import TestCase, TransactionTestCase
from django.utils import timezone

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.moderation.services.tests import (
    test_manage_review_dispute_service as dispute_tests,
)
from apps.review_disputes.models import MerchantReviewDisputeEvidence
from apps.reviews.models import (
    ReplyPhoto,
    Review,
    ReviewMediaCleanup,
    ReviewPhoto,
    ReviewReply,
)
from apps.reviews.services.review_media_cleanup_service import ReviewMediaCleanupService
from apps.reviews.services.review_service import ReviewService
from apps.reviews.tasks import cleanup_review_media_asset, recover_review_media_cleanup


class ReviewMediaCleanupTests(TestCase):
    """Cover durable manifests, bounded processing, and recovery without providers."""

    create_dispute = dispute_tests.ManageReviewDisputeServiceTests.create_dispute

    def setUp(self):
        dispute_tests.ManageReviewDisputeServiceTests.setUp(self)
        patcher = patch("apps.reviews.tasks.refresh_business_review_insights.delay")
        patcher.start()
        self.addCleanup(patcher.stop)

    def _photo(self):
        return ReviewPhoto.objects.create(
            REVW_ID=self.review,
            RPHO_PHOTO_URL="https://example.com/review.jpg",
            RPHO_PHOTO_PUBLIC_ID="review-photo",
        )

    def _record(self):
        return ReviewMediaCleanup.objects.create(
            RMCU_REVIEW_ID=self.review.pk,
            RMCU_PUBLIC_ID="private-asset-identifier",
            RMCU_RESOURCE_TYPE="image",
        )

    def test_all_related_media_survive_cascade_as_cleanup_identifiers(self):
        self._photo()
        reply = ReviewReply.objects.create(REVW_ID=self.review, RPLY_TEXT="Reply")
        ReplyPhoto.objects.create(
            RPLY_ID=reply,
            RPHO_PHOTO_URL="https://example.com/reply.jpg",
            RPHO_PHOTO_PUBLIC_ID="reply-photo",
        )
        dispute = self.create_dispute()
        for evidence_type in ("image", "document"):
            MerchantReviewDisputeEvidence.objects.create(
                MRDSP_ID=dispute,
                MRDSE_TYPE=evidence_type,
                MRDSE_URL=f"https://example.com/{evidence_type}",
                MRDSE_PUBLIC_ID=f"evidence-{evidence_type}",
            )
        with patch("apps.shared.services.cloudinary_service.cloudinary.uploader.destroy") as destroy:
            ReviewService.delete_review(self.explorer, self.review.pk)
        destroy.assert_not_called()
        self.assertEqual(
            set(ReviewMediaCleanup.objects.values_list("RMCU_PUBLIC_ID", "RMCU_RESOURCE_TYPE")),
            {
                ("review-photo", "image"),
                ("reply-photo", "image"),
                ("evidence-image", "image"),
                ("evidence-document", "raw"),
            },
        )
        self.assertFalse(Review.objects.filter(pk=self.review.pk).exists())
        self.assertFalse(ReplyPhoto.objects.filter(RPLY_ID_id=reply.pk).exists())
        self.assertFalse(MerchantReviewDisputeEvidence.objects.filter(MRDSP_ID_id=dispute.pk).exists())
        with patch(
            "apps.shared.services.cloudinary_service.cloudinary.uploader.destroy",
            return_value={"result": "ok"},
        ) as destroy:
            for record in ReviewMediaCleanup.objects.all():
                self.assertEqual(
                    ReviewMediaCleanupService.process(record.pk)["status"],
                    "succeeded",
                )
                destroy.assert_any_call(
                    record.RMCU_PUBLIC_ID,
                    resource_type=record.RMCU_RESOURCE_TYPE,
                    type="upload",
                    timeout=15,
                )
        self.assertEqual(destroy.call_count, 4)

    def test_media_free_deletion_creates_no_cleanup_work(self):
        with patch("apps.reviews.tasks.cleanup_review_media_asset.apply_async") as enqueue:
            with self.captureOnCommitCallbacks(execute=True):
                ReviewService.delete_review(self.explorer, self.review.pk)
        enqueue.assert_not_called()
        self.assertFalse(ReviewMediaCleanup.objects.exists())

    def test_duplicate_asset_references_create_one_cleanup_record(self):
        photo = self._photo()
        ReviewPhoto.objects.create(
            REVW_ID=self.review,
            RPHO_PHOTO_URL=photo.RPHO_PHOTO_URL,
            RPHO_PHOTO_PUBLIC_ID=photo.RPHO_PHOTO_PUBLIC_ID,
        )
        ReviewService.delete_review(self.explorer, self.review.pk)
        self.assertEqual(ReviewMediaCleanup.objects.count(), 1)

    def test_audit_and_database_failures_roll_back_cleanup_registration(self):
        self._photo()
        for target in (
            "apps.reviews.services.review_service.AdminActivityService.record_user_action",
            "apps.reviews.services.review_service.Review.delete",
            "apps.reviews.services.review_service.BusinessReviewSummaryService.recompute_sentiment",
        ):
            with self.subTest(target=target):
                with (
                    patch(target, side_effect=DatabaseError("Rollback")),
                    patch("apps.reviews.tasks.cleanup_review_media_asset.apply_async") as enqueue,
                    patch("apps.shared.services.cloudinary_service.cloudinary.uploader.destroy") as destroy,
                ):
                    with self.captureOnCommitCallbacks(execute=True):
                        with self.assertRaises(DatabaseError):
                            ReviewService.delete_review(self.explorer, self.review.pk)
                enqueue.assert_not_called()
                destroy.assert_not_called()
                self.assertFalse(ReviewMediaCleanup.objects.exists())
                self.assertFalse(AdminActivity.objects.exists())
                self.assertTrue(Review.objects.filter(pk=self.review.pk).exists())

    def test_dispatch_failure_preserves_work_for_recovery(self):
        self._photo()
        with (
            patch(
                "apps.reviews.tasks.cleanup_review_media_asset.apply_async",
                side_effect=RuntimeError("secret provider information"),
            ),
            self.assertLogs(
                "apps.reviews.services.review_media_cleanup_service",
                level="ERROR",
            ) as logs,
        ):
            with self.captureOnCommitCallbacks(execute=True):
                ReviewService.delete_review(self.explorer, self.review.pk)
        self.assertNotIn("secret provider information", str(logs.output))
        record = ReviewMediaCleanup.objects.get()
        self.assertEqual(record.RMCU_STATUS, "pending")
        self.assertEqual(record.RMCU_ATTEMPTS, 0)
        with patch("apps.reviews.tasks.cleanup_review_media_asset.apply_async") as enqueue:
            self.assertEqual(recover_review_media_cleanup.run(), 1)
        enqueue.assert_called_once_with(args=[record.pk], retry=False)

    def test_success_and_duplicate_execution_are_idempotent(self):
        record = self._record()
        with patch(
            "apps.shared.services.cloudinary_service.cloudinary.uploader.destroy",
            return_value={"result": "ok"},
        ) as destroy:
            self.assertEqual(cleanup_review_media_asset.run(record.pk), "succeeded")
            self.assertEqual(cleanup_review_media_asset.run(record.pk), "skipped")
        destroy.assert_called_once()
        record.refresh_from_db()
        self.assertEqual(record.RMCU_ATTEMPTS, 1)
        self.assertIsNotNone(record.RMCU_COMPLETED_AT)

    def test_missing_asset_is_recorded_as_success(self):
        record = self._record()
        with patch(
            "apps.shared.services.cloudinary_service.cloudinary.uploader.destroy",
            return_value={"result": "not found"},
        ):
            self.assertEqual(ReviewMediaCleanupService.process(record.pk)["status"], "succeeded")

    def test_transient_failure_sets_backoff_without_exposing_provider_details(self):
        record = self._record()
        with (
            patch(
                "apps.shared.services.cloudinary_service.cloudinary.uploader.destroy",
                side_effect=TimeoutError("private credentials and asset URLs"),
            ),
            self.assertLogs("apps.reviews.services.review_media_cleanup_service") as logs,
        ):
            outcome = ReviewMediaCleanupService.process(record.pk)
        self.assertEqual(outcome, {"status": "pending", "retry_after": 60})
        record.refresh_from_db()
        self.assertEqual(record.RMCU_ATTEMPTS, 1)
        self.assertEqual(record.RMCU_LAST_ERROR, "TimeoutError")
        self.assertGreater(record.RMCU_NEXT_ATTEMPT_AT, timezone.now())
        self.assertNotIn(record.RMCU_PUBLIC_ID, str(logs.output))
        self.assertNotIn("private credentials", str(logs.output))
        self.assertEqual(ReviewMediaCleanupService.process(record.pk)["status"], "skipped")
        with patch("apps.reviews.tasks.cleanup_review_media_asset.apply_async") as enqueue:
            self.assertEqual(ReviewMediaCleanupService.recover_pending(), 0)
        enqueue.assert_not_called()

    def test_retry_exhaustion_requires_explicit_operator_recovery(self):
        record = self._record()
        with patch(
            "apps.shared.services.cloudinary_service.cloudinary.uploader.destroy",
            side_effect=TimeoutError("Provider unavailable"),
        ):
            for attempt in range(1, 5):
                ReviewMediaCleanup.objects.filter(pk=record.pk).update(
                    RMCU_NEXT_ATTEMPT_AT=timezone.now() - timedelta(seconds=1),
                )
                outcome = ReviewMediaCleanupService.process(record.pk)
                record.refresh_from_db()
                self.assertEqual(record.RMCU_ATTEMPTS, attempt)
        self.assertEqual(outcome["status"], "failed")
        self.assertEqual(ReviewMediaCleanupService.recover_pending(), 0)
        with patch("apps.reviews.tasks.cleanup_review_media_asset.apply_async"):
            with self.captureOnCommitCallbacks(execute=True):
                call_command("retry_review_media_cleanup", record.pk, stdout=StringIO())
        record.refresh_from_db()
        self.assertEqual(record.RMCU_STATUS, "pending")
        self.assertEqual(record.RMCU_ATTEMPTS, 0)
        with patch(
            "apps.shared.services.cloudinary_service.cloudinary.uploader.destroy",
            return_value={"result": "ok"},
        ):
            self.assertEqual(ReviewMediaCleanupService.process(record.pk)["status"], "succeeded")

    def test_authorization_failure_requires_intervention_without_retries(self):
        record = self._record()
        with patch(
            "apps.shared.services.cloudinary_service.cloudinary.uploader.destroy",
            side_effect=AuthorizationRequired("Sensitive authorization detail"),
        ):
            self.assertEqual(ReviewMediaCleanupService.process(record.pk)["status"], "failed")
        record.refresh_from_db()
        self.assertEqual(record.RMCU_ATTEMPTS, 1)

    def test_uncommitted_success_keeps_identifier_for_replay_after_rollback(self):
        record = self._record()
        with (
            patch(
                "apps.shared.services.cloudinary_service.cloudinary.uploader.destroy",
                return_value={"result": "ok"},
            ),
            patch.object(ReviewMediaCleanup, "save", side_effect=DatabaseError("Worker failed")),
        ):
            with self.assertRaises(DatabaseError):
                ReviewMediaCleanupService.process(record.pk)
        record.refresh_from_db()
        self.assertEqual(record.RMCU_STATUS, "pending")
        self.assertEqual(record.RMCU_PUBLIC_ID, "private-asset-identifier")
        with patch(
            "apps.shared.services.cloudinary_service.cloudinary.uploader.destroy",
            return_value={"result": "not found"},
        ):
            self.assertEqual(ReviewMediaCleanupService.process(record.pk)["status"], "succeeded")

    def test_task_uses_bounded_celery_retry_with_persisted_backoff(self):
        with (
            patch.object(
                ReviewMediaCleanupService,
                "process",
                return_value={"status": "pending", "retry_after": 60},
            ),
            patch.object(cleanup_review_media_asset, "retry", side_effect=Retry()) as retry,
        ):
            with self.assertRaises(Retry):
                cleanup_review_media_asset.run(123)
        self.assertEqual(retry.call_args.kwargs["countdown"], 60)

    def test_retry_delivery_failure_keeps_persisted_work(self):
        record = self._record()
        with (
            patch(
                "apps.shared.services.cloudinary_service.cloudinary.uploader.destroy",
                side_effect=TimeoutError("Unavailable"),
            ),
            patch.object(
                cleanup_review_media_asset,
                "retry",
                side_effect=RuntimeError("Broker unavailable"),
            ),
        ):
            with self.assertRaisesMessage(RuntimeError, "Broker unavailable"):
                cleanup_review_media_asset.run(record.pk)
        record.refresh_from_db()
        self.assertEqual(record.RMCU_STATUS, "pending")
        self.assertEqual(record.RMCU_ATTEMPTS, 1)
        ReviewMediaCleanup.objects.filter(pk=record.pk).update(
            RMCU_NEXT_ATTEMPT_AT=timezone.now() - timedelta(seconds=1),
        )
        with patch("apps.reviews.tasks.cleanup_review_media_asset.apply_async") as enqueue:
            self.assertEqual(ReviewMediaCleanupService.recover_pending(), 1)
        enqueue.assert_called_once_with(args=[record.pk], retry=False)

    def test_recovery_dispatches_only_a_bounded_due_batch(self):
        first = self._record()
        ReviewMediaCleanup.objects.create(
            RMCU_REVIEW_ID=self.review.pk,
            RMCU_PUBLIC_ID="another-asset",
            RMCU_RESOURCE_TYPE="image",
        )
        with (
            patch.object(ReviewMediaCleanupService, "RECOVERY_BATCH_SIZE", 1),
            patch("apps.reviews.tasks.cleanup_review_media_asset.apply_async") as enqueue,
        ):
            self.assertEqual(ReviewMediaCleanupService.recover_pending(), 1)
        enqueue.assert_called_once_with(args=[first.pk], retry=False)
        self.assertEqual(ReviewMediaCleanup.objects.filter(RMCU_STATUS="pending").count(), 2)


@skipUnless(connection.vendor == "postgresql", "Requires PostgreSQL transactions.")
class ReviewMediaCleanupTransactionTests(TransactionTestCase):
    """Use real commits and independent connections to test delivery boundaries."""

    def setUp(self):
        dispute_tests.ManageReviewDisputeServiceTests.setUp(self)
        ReviewPhoto.objects.create(
            REVW_ID=self.review,
            RPHO_PHOTO_URL="https://example.com/review.jpg",
            RPHO_PHOTO_PUBLIC_ID="committed-photo",
        )
        patcher = patch("apps.reviews.tasks.refresh_business_review_insights.delay")
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_delivery_occurs_only_after_actual_commit(self):
        observations = []

        def observe_committed_rows(
            *args,
            **kwargs,
        ):
            in_atomic_block = connection.in_atomic_block
            def observe():
                close_old_connections()
                try:
                    return (
                        Review.objects.filter(pk=self.review.pk).exists(),
                        ReviewMediaCleanup.objects.count(),
                    )
                finally:
                    connection.close()
            with ThreadPoolExecutor(max_workers=1) as executor:
                observations.append(
                    (in_atomic_block, executor.submit(observe).result(timeout=5)),
                )

        with (
            patch(
                "apps.reviews.tasks.cleanup_review_media_asset.apply_async",
                side_effect=observe_committed_rows,
            ) as enqueue,
            patch("apps.shared.services.cloudinary_service.cloudinary.uploader.destroy") as destroy,
        ):
            with transaction.atomic():
                ReviewService.delete_review(self.explorer, self.review.pk)
                enqueue.assert_not_called()
                destroy.assert_not_called()
            enqueue.assert_called_once()
        destroy.assert_not_called()
        self.assertEqual(observations, [(False, (False, 1))])

    def test_actual_rollback_preserves_assets_and_discards_work(self):
        with (
            patch("apps.reviews.tasks.cleanup_review_media_asset.apply_async") as enqueue,
            patch("apps.shared.services.cloudinary_service.cloudinary.uploader.destroy") as destroy,
        ):
            with self.assertRaises(RuntimeError):
                with transaction.atomic():
                    ReviewService.delete_review(self.explorer, self.review.pk)
                    self.assertEqual(ReviewMediaCleanup.objects.count(), 1)
                    raise RuntimeError("Rollback")
        enqueue.assert_not_called()
        destroy.assert_not_called()
        self.assertFalse(ReviewMediaCleanup.objects.exists())
        self.assertFalse(AdminActivity.objects.exists())
        self.assertTrue(Review.objects.filter(pk=self.review.pk).exists())
        self.assertTrue(ReviewPhoto.objects.filter(REVW_ID=self.review.pk).exists())

    def test_duplicate_worker_skips_locked_asset(self):
        record = ReviewMediaCleanup.objects.create(
            RMCU_REVIEW_ID=self.review.pk,
            RMCU_PUBLIC_ID="worker-photo",
            RMCU_RESOURCE_TYPE="image",
        )
        def duplicate():
            close_old_connections()
            try:
                return ReviewMediaCleanupService.process(record.pk)
            finally:
                connection.close()
        with patch(
            "apps.shared.services.cloudinary_service.cloudinary.uploader.destroy",
            return_value={"result": "ok"},
        ) as destroy:
            with ThreadPoolExecutor(max_workers=1) as executor:
                with transaction.atomic():
                    ReviewMediaCleanupService.process(record.pk)
                    outcome = executor.submit(duplicate).result(timeout=5)
                self.assertEqual(outcome["status"], "skipped")
        destroy.assert_called_once()
