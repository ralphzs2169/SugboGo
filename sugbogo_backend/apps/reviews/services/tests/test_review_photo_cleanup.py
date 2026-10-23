from datetime import timedelta
from unittest.mock import patch

from django.db import connection, transaction
from django.test import TransactionTestCase, override_settings
from django.utils import timezone

from apps.reviews.models import (
    BusinessReviewSummary,
    Review,
    ReviewInsightRegeneration,
    ReviewMediaCleanup,
    ReviewPhoto,
)
from apps.reviews.services.review_media_cleanup_service import ReviewMediaCleanupService
from apps.reviews.services.review_service import ReviewService
from apps.reviews.services.tests import test_review_service as review_tests
from apps.reviews.tasks import cleanup_review_media_asset, recover_review_media_cleanup


@override_settings(
    PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"],
)
class ReviewPhotoCleanupTests(TransactionTestCase):
    """Cover committed author photo removal and recovery without external services."""

    def setUp(self):
        review_tests.ReviewServiceTests.setUpTestData.__func__(type(self))
        self.review = Review.objects.create(
            USER_ID=self.user,
            BUSN_ID=self.business,
            REVW_TEXT="Friendly staff.",
            REVW_STATUS=Review.ReviewStatus.PUBLISHED,
            REVW_SENTIMENT_SCORE=0.7,
            REVW_SENTIMENT_LABEL="positive",
            REVW_IS_REPORT_FLAGGED=True,
        )
        self.retained = self._photo("retained")
        self.summary = BusinessReviewSummary.objects.create(
            BUSN_ID=self.business,
            BRSU_POSITIVE_COUNT=1,
            BRSU_REVIEW_COUNT=1,
            BRSU_CLASSIFIED_REVIEW_COUNT=1,
            BRSU_NARRATIVE="Visitors mention friendly staff.",
            BRSU_GENERATION_STATE=BusinessReviewSummary.GenerationState.READY,
        )
        self.enqueue = self._patch(
            "apps.reviews.tasks.cleanup_review_media_asset.apply_async",
        )
        self.destroy = self._patch(
            "apps.shared.services.cloudinary_service.cloudinary.uploader.destroy",
            return_value={"result": "ok"},
        )
        self.moderate = self._patch(
            "apps.reviews.services.review_service.ReviewModerationService.moderate",
        )
        self.sentiment = self._patch(
            "apps.reviews.tasks.process_review_sentiment.delay",
        )
        self.narrative = self._patch(
            "apps.reviews.tasks.refresh_business_review_insights.delay",
        )
        self.schedule = self._patch(
            "apps.reviews.services.review_service."
            "ReviewInsightSchedulingService.review_changed",
        )
        self.recompute = self._patch(
            "apps.reviews.services.review_service."
            "BusinessReviewSummaryService.recompute_sentiment",
        )

    def _patch(
        self,
        target,
        **kwargs,
    ):
        patcher = patch(target, **kwargs)
        mocked = patcher.start()
        self.addCleanup(patcher.stop)
        return mocked

    def _photo(
        self,
        suffix,
    ):
        return ReviewPhoto.objects.create(
            REVW_ID=self.review,
            RPHO_PHOTO_URL=f"https://example.com/{suffix}.jpg",
            RPHO_PHOTO_PUBLIC_ID=f"review/{suffix}",
        )

    def _remove(
        self,
        operation,
        photo,
    ):
        if operation == "update":
            ReviewService.update_review(
                user=self.user,
                review_id=self.review.pk,
                keep_photo_ids=[self.retained.pk],
            )
        else:
            ReviewService.delete_photo(
                user=self.user,
                photo_id=photo.pk,
            )

    def _assert_lifecycle_preserved(self):
        self.review.refresh_from_db()
        self.summary.refresh_from_db()
        self.retained.refresh_from_db()
        self.assertEqual(self.review.REVW_STATUS, Review.ReviewStatus.PUBLISHED)
        self.assertEqual(self.review.REVW_TEXT, "Friendly staff.")
        self.assertEqual(self.review.REVW_SENTIMENT_SCORE, 0.7)
        self.assertEqual(self.review.REVW_SENTIMENT_LABEL, "positive")
        self.assertTrue(self.review.REVW_IS_REPORT_FLAGGED)
        self.assertEqual(self.retained.RPHO_PHOTO_PUBLIC_ID, "review/retained")
        self.assertEqual(
            self.summary.BRSU_NARRATIVE,
            "Visitors mention friendly staff.",
        )
        self.assertEqual(self.summary.BRSU_GENERATION_STATE, "ready")
        self.assertEqual(self.summary.BRSU_CLASSIFIED_REVIEW_COUNT, 1)
        self.assertFalse(ReviewInsightRegeneration.objects.exists())
        self.moderate.assert_not_called()
        self.sentiment.assert_not_called()
        self.narrative.assert_not_called()
        self.schedule.assert_not_called()
        self.recompute.assert_not_called()

    def test_both_removal_paths_publish_only_after_actual_commit(self):
        observations = []

        def observe_dispatch(
            *args,
            **kwargs,
        ):
            observations.append(connection.in_atomic_block)

        self.enqueue.side_effect = observe_dispatch
        for operation in ("update", "individual"):
            with self.subTest(operation=operation):
                photo = self._photo(operation)
                self.enqueue.reset_mock()
                with transaction.atomic():
                    self._remove(operation, photo)
                    self.assertFalse(
                        ReviewPhoto.objects.filter(pk=photo.pk).exists(),
                    )
                    cleanup = ReviewMediaCleanup.objects.get(
                        RMCU_PUBLIC_ID=photo.RPHO_PHOTO_PUBLIC_ID,
                    )
                    self.enqueue.assert_not_called()
                    self.destroy.assert_not_called()

                self.assertEqual(cleanup.RMCU_REVIEW_ID, self.review.pk)
                self.assertEqual(cleanup.RMCU_RESOURCE_TYPE, "image")
                self.enqueue.assert_called_once_with(
                    args=[cleanup.pk],
                    retry=False,
                )
                self.assertEqual(
                    cleanup_review_media_asset.run(cleanup.pk),
                    "succeeded",
                )
                self.destroy.assert_called_once_with(
                    photo.RPHO_PHOTO_PUBLIC_ID,
                    resource_type="image",
                    type="upload",
                    timeout=15,
                )
                self.destroy.reset_mock()
                self._assert_lifecycle_preserved()

        self.assertEqual(observations, [False, False])
        self.assertEqual(self.review.photos.count(), 1)

    def test_rollback_restores_photo_and_discards_cleanup_for_both_paths(self):
        photo = self._photo("rollback")
        for operation in ("update", "individual"):
            with self.subTest(operation=operation):
                with self.assertRaisesMessage(RuntimeError, "Rollback"):
                    with transaction.atomic():
                        self._remove(operation, photo)
                        self.assertEqual(ReviewMediaCleanup.objects.count(), 1)
                        raise RuntimeError("Rollback")

                photo.refresh_from_db()
                self.assertEqual(photo.RPHO_PHOTO_PUBLIC_ID, "review/rollback")
                self.assertFalse(ReviewMediaCleanup.objects.exists())
                self.assertEqual(self.review.photos.count(), 2)
                self.assertIsNone(self.review.REVW_EDITED_AT)
                self.enqueue.assert_not_called()
                self.destroy.assert_not_called()
                self._assert_lifecycle_preserved()

    def test_cloudinary_failure_after_commit_is_retryable_for_both_paths(self):
        for operation in ("update", "individual"):
            with self.subTest(operation=operation):
                photo = self._photo(operation)
                self._remove(operation, photo)
                cleanup = ReviewMediaCleanup.objects.get(
                    RMCU_PUBLIC_ID=photo.RPHO_PHOTO_PUBLIC_ID,
                )
                self.destroy.side_effect = TimeoutError("Unavailable")
                outcome = ReviewMediaCleanupService.process(cleanup.pk)
                self.assertEqual(outcome, {"status": "pending", "retry_after": 60})
                cleanup.refresh_from_db()
                self.assertEqual(cleanup.RMCU_ATTEMPTS, 1)
                self.assertEqual(cleanup.RMCU_LAST_ERROR, "TimeoutError")
                self.assertEqual(
                    cleanup.RMCU_PUBLIC_ID,
                    photo.RPHO_PHOTO_PUBLIC_ID,
                )
                self.assertFalse(
                    ReviewPhoto.objects.filter(pk=photo.pk).exists(),
                )
                ReviewMediaCleanup.objects.filter(pk=cleanup.pk).update(
                    RMCU_NEXT_ATTEMPT_AT=timezone.now() - timedelta(seconds=1),
                )
                self.enqueue.reset_mock()
                self.assertEqual(recover_review_media_cleanup.run(), 1)
                self.enqueue.assert_called_once_with(
                    args=[cleanup.pk],
                    retry=False,
                )
                self.destroy.side_effect = None
                self.assertEqual(
                    cleanup_review_media_asset.run(cleanup.pk),
                    "succeeded",
                )
                cleanup.refresh_from_db()
                self.assertEqual(cleanup.RMCU_ATTEMPTS, 2)
                self._assert_lifecycle_preserved()

    def test_failed_dispatch_remains_recoverable_for_both_paths(self):
        for operation in ("update", "individual"):
            with self.subTest(operation=operation):
                photo = self._photo(operation)
                self.enqueue.side_effect = RuntimeError("Broker unavailable")
                self._remove(operation, photo)
                cleanup = ReviewMediaCleanup.objects.get(
                    RMCU_PUBLIC_ID=photo.RPHO_PHOTO_PUBLIC_ID,
                )
                self.assertEqual(cleanup.RMCU_STATUS, "pending")
                self.assertFalse(
                    ReviewPhoto.objects.filter(pk=photo.pk).exists(),
                )
                self.destroy.assert_not_called()
                self.enqueue.side_effect = None
                self.enqueue.reset_mock()
                self.assertEqual(recover_review_media_cleanup.run(), 1)
                self.enqueue.assert_called_once_with(
                    args=[cleanup.pk],
                    retry=False,
                )
                self.assertEqual(
                    cleanup_review_media_asset.run(cleanup.pk),
                    "succeeded",
                )
                self.destroy.reset_mock()
                self._assert_lifecycle_preserved()

    def test_duplicate_registration_and_execution_leave_review_intact(self):
        for operation in ("update", "individual"):
            with self.subTest(operation=operation):
                photo = self._photo(operation)
                assets = {(photo.RPHO_PHOTO_PUBLIC_ID, "image")}
                self.enqueue.reset_mock()
                with transaction.atomic():
                    ReviewMediaCleanupService.register_assets(
                        review_id=self.review.pk,
                        assets=assets,
                    )
                    self._remove(operation, photo)

                cleanup = ReviewMediaCleanup.objects.get(
                    RMCU_PUBLIC_ID=photo.RPHO_PHOTO_PUBLIC_ID,
                )
                self.enqueue.assert_called_once_with(
                    args=[cleanup.pk],
                    retry=False,
                )
                self.assertEqual(
                    cleanup_review_media_asset.run(cleanup.pk),
                    "succeeded",
                )
                self.assertEqual(
                    cleanup_review_media_asset.run(cleanup.pk),
                    "skipped",
                )
                ReviewMediaCleanupService.register_assets(
                    review_id=self.review.pk,
                    assets=assets,
                )
                self.enqueue.assert_called_once()
                self.destroy.assert_called_once()
                self.destroy.reset_mock()
                cleanup.refresh_from_db()
                self.assertEqual(cleanup.RMCU_ATTEMPTS, 1)
                self._assert_lifecycle_preserved()
