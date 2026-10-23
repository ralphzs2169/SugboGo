"""Durable recovery and publication fencing for failed moderation delivery."""

from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import timedelta
from threading import Barrier, Event
from unittest.mock import patch

from django.conf import settings
from django.db import DatabaseError, connection, connections
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.admin_operations.moderation.services.manage_under_review_service import (
    ManageUnderReviewService,
)
from apps.admin_operations.system_configuration.models import AnalyticsPolicyConfiguration
from apps.notifications.models import Notification
from apps.reviews.models import Review, ReviewInsightRegeneration, ReviewPhoto
from apps.reviews.services.review_moderation_retry_service import ReviewModerationRetryService
from apps.reviews.services.review_service import ReviewService
from apps.reviews.services.tests.test_review_moderation_retry_task import (
    create_held_review,
    moderation_result,
)
from apps.reviews.tasks import recover_review_moderation_retries, retry_failed_review_moderation
from apps.users.models import ReputationEvent, User


class ModerationRecoveryFixture:
    """Keep clocks, provider requests, and task publishing controlled per test."""

    def setUp(self):
        super().setUp()
        self.review, self.business = create_held_review()
        self.clock = self.enterContext(
            patch("django.utils.timezone.now", return_value=timezone.now()),
        )
        self.provider = self.enterContext(
            patch(
                "apps.reviews.services.review_moderation_retry_service."
                "ReviewModerationService.moderate",
                side_effect=lambda **kwargs: moderation_result("flagged"),
            ),
        )
        self.enqueue = self.enterContext(
            patch("apps.reviews.tasks.retry_failed_review_moderation.apply_async"),
        )
        self.sentiment = self.enterContext(
            patch("apps.reviews.tasks.process_review_sentiment.delay"),
        )

    def advance(
        self,
        seconds,
    ):
        self.clock.return_value += timedelta(seconds=seconds)

    def metadata(self):
        self.review.refresh_from_db()
        return self.review.REVW_MODERATION_DATA

    def set_metadata(
        self,
        **updates,
    ):
        metadata = self.metadata().copy()
        metadata.update(updates)
        self.review.REVW_MODERATION_DATA = metadata
        self.review.save(update_fields=["REVW_MODERATION_DATA"])


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class ModerationRecoveryTests(ModerationRecoveryFixture, TestCase):
    """Recover broker failures without relying on Celery retry counters."""

    def test_initial_dispatch_failure_is_recovered_from_saved_submission(self):
        user = self.review.USER_ID
        self.review.delete()
        with (
            patch(
                "apps.reviews.services.review_service.ReviewModerationService.moderate",
                return_value=moderation_result("provider_failure"),
            ),
            patch(
                "apps.reviews.tasks.retry_failed_review_moderation.delay",
                side_effect=ConnectionError("PRIVATE broker credentials"),
            ),
            self.assertLogs("apps.reviews.services.review_service", level="ERROR"),
        ):
            with self.captureOnCommitCallbacks(execute=True):
                self.review = ReviewService.create_review(
                    user=user,
                    business_id=self.business.pk,
                    text="Saved despite unavailable moderation and broker.",
                )

        metadata = self.metadata()
        self.assertEqual(metadata["retry_attempt"], 0)
        self.assertEqual(
            parse_datetime(metadata["retry_next_attempt_at"]),
            self.clock.return_value,
        )
        self.assertEqual(recover_review_moderation_retries.run(), 1)
        self.enqueue.assert_called_once_with(
            args=[self.review.pk, 0],
            countdown=0,
            retry=False,
        )
        self.assertEqual(retry_failed_review_moderation.run(self.review.pk, 0), "flagged")
        self.provider.assert_called_once()

    def test_subsequent_publish_failure_recovers_nonzero_attempt_after_backoff(self):
        self.provider.side_effect = lambda **kwargs: moderation_result("provider_failure")
        self.enqueue.side_effect = ConnectionError("PRIVATE broker credentials")
        with self.assertLogs(
            "apps.reviews.services.review_moderation_retry_service",
            level="ERROR",
        ) as logs:
            self.assertEqual(retry_failed_review_moderation.run(self.review.pk), "provider_failure")

        metadata = self.metadata()
        self.assertEqual(metadata["retry_attempt"], 1)
        self.assertEqual(
            parse_datetime(metadata["retry_next_attempt_at"]),
            self.clock.return_value + timedelta(seconds=60),
        )
        self.assertEqual(logs.records[0].retry_attempt, 1)
        self.assertNotIn("PRIVATE", " ".join(logs.output))
        self.enqueue.assert_called_once_with(
            args=[self.review.pk, 1],
            countdown=60,
            retry=False,
        )
        self.enqueue.side_effect = None
        self.enqueue.reset_mock()
        self.assertEqual(recover_review_moderation_retries.run(), 0)
        self.assertEqual(retry_failed_review_moderation.run(self.review.pk, 1), "stale")
        self.provider.assert_called_once()
        self.advance(60)
        self.assertEqual(recover_review_moderation_retries.run(), 1)
        self.enqueue.assert_called_once_with(
            args=[self.review.pk, 1],
            countdown=0,
            retry=False,
        )
        self.provider.side_effect = lambda **kwargs: moderation_result("safe")
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(retry_failed_review_moderation.run(self.review.pk, 1), "published")
            self.assertEqual(retry_failed_review_moderation.run(self.review.pk, 1), "stale")

        self.assertEqual(self.provider.call_count, 2)
        self.assertEqual(self.metadata()["retry_attempt"], 2)
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, 1)
        self.sentiment.assert_called_once_with(self.review.pk, self.business.pk)
        self.assertEqual(
            Notification.objects.filter(NOTF_TYPE="business_review_received").count(),
            1,
        )
        self.assertEqual(
            ReputationEvent.objects.filter(
                REVT_SOURCE_TYPE=ReputationEvent.SourceType.BUSINESS_REVIEW,
            ).count(),
            1,
        )
        regeneration = ReviewInsightRegeneration.objects.get(BUSN_ID=self.business)
        self.assertEqual(regeneration.RIRG_REQUESTED_REVISION, 1)
        self.assertGreater(
            regeneration.RIRG_REQUESTED_REVISION,
            regeneration.RIRG_COMPLETED_REVISION,
        )
        self.assertEqual(recover_review_moderation_retries.run(), 0)

    def test_nonzero_legacy_attempt_is_preserved_and_dispatched(self):
        self.set_metadata(retry_attempt=2)
        self.assertEqual(recover_review_moderation_retries.run(), 1)
        self.enqueue.assert_called_once_with(
            args=[self.review.pk, 2],
            countdown=0,
            retry=False,
        )
        self.assertEqual(retry_failed_review_moderation.run(self.review.pk, 0), "stale")
        self.provider.assert_not_called()
        self.assertEqual(retry_failed_review_moderation.run(self.review.pk), "flagged")
        self.assertEqual(self.metadata()["retry_attempt"], 3)

    def test_minimal_legacy_provider_failure_metadata_is_recoverable(self):
        Review.objects.filter(pk=self.review.pk).update(
            REVW_MODERATION_DATA={"outcome": "provider_failure"},
        )
        self.assertEqual(recover_review_moderation_retries.run(), 1)
        self.assertEqual(retry_failed_review_moderation.run(self.review.pk), "flagged")
        self.assertEqual(self.metadata()["retry_attempt"], 1)

    def test_completed_failed_attempts_keep_established_backoff_and_exhaustion(self):
        self.provider.side_effect = lambda **kwargs: moderation_result("provider_failure")
        for attempt, delay in enumerate((60, 120, 240)):
            with self.subTest(attempt=attempt):
                self.enqueue.reset_mock()
                self.assertEqual(retry_failed_review_moderation.run(self.review.pk), "provider_failure")
                self.enqueue.assert_called_once_with(
                    args=[self.review.pk, attempt + 1],
                    countdown=delay,
                    retry=False,
                )
                self.assertEqual(self.metadata()["retry_attempt"], attempt + 1)
                self.advance(delay)

        self.enqueue.reset_mock()
        self.assertEqual(retry_failed_review_moderation.run(self.review.pk), "exhausted")
        self.assertTrue(self.metadata()["retry_exhausted"])
        self.assertIsNone(self.metadata()["retry_next_attempt_at"])
        self.assertNotIn("retry_claim_token", self.metadata())
        self.assertEqual(recover_review_moderation_retries.run(), 0)
        self.assertEqual(retry_failed_review_moderation.run(self.review.pk), "stale")
        self.provider.assert_called()
        self.assertEqual(self.provider.call_count, 4)
        self.enqueue.assert_not_called()

    def test_worker_interruption_is_rediscovered_after_claim_expires(self):
        self.provider.side_effect = RuntimeError("Interrupted before result persistence")
        with self.assertRaises(RuntimeError):
            retry_failed_review_moderation.run(self.review.pk, 0)

        token = self.metadata()["retry_claim_token"]
        self.assertEqual(self.metadata()["retry_attempt"], 0)
        self.assertEqual(recover_review_moderation_retries.run(), 0)
        self.assertEqual(retry_failed_review_moderation.run(self.review.pk, 0), "stale")
        self.assertEqual(self.metadata()["retry_claim_token"], token)
        self.provider.assert_called_once()
        self.advance(ReviewModerationRetryService.CLAIM_SECONDS)
        self.assertEqual(recover_review_moderation_retries.run(), 1)
        self.provider.side_effect = lambda **kwargs: moderation_result("flagged")
        self.assertEqual(retry_failed_review_moderation.run(self.review.pk, 0), "flagged")
        self.assertEqual(self.metadata()["retry_attempt"], 1)
        self.assertNotIn("retry_claim_token", self.metadata())

    def test_expired_worker_cannot_overwrite_reclaimed_attempt(self):
        def reclaim_during_provider(**kwargs):
            self.advance(ReviewModerationRetryService.CLAIM_SECONDS)
            self.provider.side_effect = lambda **kwargs: moderation_result("flagged")
            self.assertEqual(retry_failed_review_moderation.run(self.review.pk, 0), "flagged")
            return moderation_result("safe")

        self.provider.side_effect = reclaim_during_provider
        self.assertEqual(retry_failed_review_moderation.run(self.review.pk, 0), "stale")
        self.assertEqual(self.metadata()["outcome"], "flagged")
        self.assertEqual(self.provider.call_count, 2)
        self.sentiment.assert_not_called()

    def assert_admin_decision_wins(
        self,
        approve,
    ):
        actor = User.objects.create_user(
            email="retry-admin@example.com",
            password=None,
            USER_ROLE=User.UserRole.ADMIN,
        )

        def decide_during_provider(**kwargs):
            ManageUnderReviewService.resolve(
                self.review.pk,
                actor=actor,
                approve=approve,
                moderation_notes="Content rejected after administrator inspection.",
            )
            return moderation_result("safe")

        self.provider.side_effect = decide_during_provider
        self.assertEqual(retry_failed_review_moderation.run(self.review.pk), "stale")
        self.review.refresh_from_db()
        self.business.refresh_from_db()
        expected_status = Review.ReviewStatus.REJECTED
        expected_count = 0
        if approve:
            expected_status = Review.ReviewStatus.PUBLISHED
            expected_count = 1
        self.assertEqual(self.review.REVW_STATUS, expected_status)
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, expected_count)
        self.assertEqual(self.metadata()["outcome"], "provider_failure")
        self.assertEqual(recover_review_moderation_retries.run(), 0)

    def test_admin_approval_during_provider_call_wins(self):
        self.assert_admin_decision_wins(approve=True)

    def test_admin_rejection_during_provider_call_wins(self):
        self.assert_admin_decision_wins(approve=False)

    def test_text_and_photo_changes_discard_safe_result_and_release_claim(self):
        photo = ReviewPhoto.objects.create(
            REVW_ID=self.review,
            RPHO_PHOTO_URL="https://example.com/original.jpg",
            RPHO_PHOTO_PUBLIC_ID="original",
        )
        for change in ("text", "photo_url", "photo_id"):
            with self.subTest(change=change):
                def change_source(**kwargs):
                    if change == "text":
                        Review.objects.filter(pk=self.review.pk).update(REVW_TEXT="Changed text.")
                    elif change == "photo_url":
                        ReviewPhoto.objects.filter(pk=photo.pk).update(
                            RPHO_PHOTO_URL="https://example.com/new.jpg",
                        )
                    else:
                        ReviewPhoto.objects.filter(pk=photo.pk).update(RPHO_PHOTO_PUBLIC_ID="new")
                    return moderation_result("safe")

                self.provider.side_effect = change_source
                self.assertEqual(retry_failed_review_moderation.run(self.review.pk), "stale")
                metadata = self.metadata()
                self.assertEqual(metadata["retry_attempt"], 0)
                self.assertNotIn("retry_claim_token", metadata)
                self.assertEqual(recover_review_moderation_retries.run(), 1)
                self.assertEqual(self.review.REVW_STATUS, Review.ReviewStatus.UNDER_REVIEW)

    def test_ineligible_rows_do_not_use_recovery_batch_or_call_provider(self):
        valid_metadata = deepcopy(self.metadata())
        excluded = [
            {"outcome": "flagged"},
            {"retry_exhausted": True},
            {"retryable": False},
            {"retry_attempt": 4},
            {"findings": [{"source": "text", "flagged": True}]},
            {"findings": [{"source": "image", "flagged": True}]},
        ]
        for updates in excluded:
            self.set_metadata(**valid_metadata)
            self.set_metadata(**updates)
            self.assertEqual(recover_review_moderation_retries.run(), 0)
            self.assertEqual(retry_failed_review_moderation.run(self.review.pk), "stale")
        for status in (Review.ReviewStatus.REJECTED, Review.ReviewStatus.PUBLISHED):
            Review.objects.filter(pk=self.review.pk).update(
                REVW_MODERATION_DATA=valid_metadata,
                REVW_STATUS=status,
            )
            self.assertEqual(recover_review_moderation_retries.run(), 0)
            self.assertEqual(retry_failed_review_moderation.run(self.review.pk), "stale")
        self.review.delete()
        self.assertEqual(retry_failed_review_moderation.run(self.review.pk), "stale")
        self.provider.assert_not_called()
        self.enqueue.assert_not_called()

    def test_recovery_batch_is_bounded_and_beat_is_configured(self):
        author = User.objects.create_user(email="another-retry@example.com", password=None)
        Review.objects.create(
            USER_ID=author,
            BUSN_ID=self.business,
            REVW_TEXT="Another retryable review.",
            REVW_STATUS=Review.ReviewStatus.UNDER_REVIEW,
            REVW_MODERATION_DATA=deepcopy(self.metadata()),
        )
        with patch.object(ReviewModerationRetryService, "RECOVERY_BATCH_SIZE", 1):
            self.assertEqual(recover_review_moderation_retries.run(), 1)
        self.assertEqual(self.enqueue.call_count, 1)
        self.assertEqual(
            settings.CELERY_BEAT_SCHEDULE["recover-review-moderation-retries"],
            {"task": "apps.reviews.tasks.recover_review_moderation_retries", "schedule": 30.0},
        )

    def test_incomplete_safe_result_stays_retryable(self):
        result = moderation_result("safe")
        result["incomplete"] = True
        self.provider.side_effect = None
        self.provider.return_value = result
        self.assertEqual(retry_failed_review_moderation.run(self.review.pk), "provider_failure")
        self.assertEqual(self.review.REVW_STATUS, Review.ReviewStatus.UNDER_REVIEW)
        self.assertTrue(self.metadata()["retryable"])
        self.sentiment.assert_not_called()

    def test_publication_rollback_retains_claim_for_recovery(self):
        self.provider.side_effect = lambda **kwargs: moderation_result("safe")
        with patch.object(ReviewService, "publish_under_review", side_effect=DatabaseError()):
            with self.assertRaises(DatabaseError):
                retry_failed_review_moderation.run(self.review.pk)
        self.assertEqual(self.metadata()["outcome"], "provider_failure")
        self.assertEqual(self.metadata()["retry_attempt"], 0)
        self.advance(ReviewModerationRetryService.CLAIM_SECONDS)
        self.assertEqual(recover_review_moderation_retries.run(), 1)
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(retry_failed_review_moderation.run(self.review.pk), "published")
        self.sentiment.assert_called_once()


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class ModerationRecoveryConcurrencyTests(ModerationRecoveryFixture, TransactionTestCase):
    """Exercise recovery and duplicate deliveries using separate SQL connections."""

    def setUp(self):
        super().setUp()
        if connection.vendor != "postgresql":
            self.skipTest("Requires PostgreSQL row locks.")
        AnalyticsPolicyConfiguration.objects.get_or_create(pk=1)

    def test_concurrent_sweeps_and_duplicate_workers_call_provider_once(self):
        sweeps_ready = Barrier(2)
        provider_entered = Event()
        release_provider = Event()

        def sweep():
            try:
                sweeps_ready.wait(timeout=10)
                return ReviewModerationRetryService.recover_pending()
            finally:
                connections.close_all()

        def check_provider(**kwargs):
            self.assertFalse(connection.in_atomic_block)
            provider_entered.set()
            if not release_provider.wait(timeout=10):
                raise TimeoutError("Test provider synchronization timed out")
            return moderation_result("safe")

        def process():
            try:
                return retry_failed_review_moderation.run(self.review.pk, 0)
            finally:
                connections.close_all()

        self.provider.side_effect = check_provider
        with ThreadPoolExecutor(max_workers=2) as executor:
            first_sweep = executor.submit(sweep)
            second_sweep = executor.submit(sweep)
            self.assertEqual(first_sweep.result(timeout=15), 1)
            self.assertEqual(second_sweep.result(timeout=15), 1)
            self.assertEqual(self.enqueue.call_count, 2)
            first_worker = executor.submit(process)
            try:
                self.assertTrue(provider_entered.wait(timeout=10))
                duplicate = executor.submit(process)
                self.assertEqual(duplicate.result(timeout=10), "stale")
                self.assertEqual(ReviewModerationRetryService.recover_pending(), 0)
            finally:
                release_provider.set()
            self.assertEqual(first_worker.result(timeout=15), "published")

        self.provider.assert_called_once()
        self.sentiment.assert_called_once_with(self.review.pk, self.business.pk)
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, 1)
        self.assertEqual(
            ReviewInsightRegeneration.objects.get(BUSN_ID=self.business).RIRG_REQUESTED_REVISION,
            1,
        )
        self.assertEqual(
            ReviewInsightRegeneration.objects.get(BUSN_ID=self.business).RIRG_DUE_AT,
            self.clock.return_value + timedelta(seconds=120),
        )
