"""Explicit initial-check processing without changing synchronous review creation."""

from copy import deepcopy
from datetime import timedelta
from unittest.mock import patch

from django.db import DatabaseError
from django.test import TestCase, override_settings
from django.utils.dateparse import parse_datetime

from apps.admin_operations.moderation.services.manage_under_review_service import (
    ManageUnderReviewService,
)
from apps.notifications.models import Notification
from apps.reviews.models import Review, ReviewInsightRegeneration, ReviewPhoto
from apps.reviews.services.review_moderation_retry_service import ReviewModerationRetryService
from apps.reviews.services.review_moderation_service import ReviewModerationService
from apps.reviews.services.review_service import ReviewService
from apps.reviews.services.tests import test_review_moderation_recovery as recovery_tests
from apps.reviews.services.tests.test_review_moderation_retry_task import moderation_result
from apps.reviews.services.tests.test_review_moderation_service import provider_response
from apps.reviews.tasks import recover_review_moderation_retries, retry_failed_review_moderation
from apps.users.models import ReputationEvent, User


class InitialModerationFixture:
    """Persist explicit initial intent using the existing held-review fixtures."""

    def setUp(self):
        self.real_moderate = ReviewModerationService.moderate
        super().setUp()
        self.review.REVW_MODERATION_DATA = ReviewModerationRetryService.initial_metadata()
        self.review.save(update_fields=["REVW_MODERATION_DATA"])


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class InitialModerationTests(
    InitialModerationFixture,
    recovery_tests.ModerationRecoveryFixture,
    TestCase,
):
    """Protect initial outcomes, retry budget, stored identity, and publication effects."""

    def test_metadata_explicitly_represents_unchecked_work(self):
        metadata = self.metadata()
        self.assertEqual(metadata["outcome"], "pending_initial")
        self.assertEqual(metadata["retry_attempt"], 0)
        self.assertTrue(metadata["retryable"])
        self.assertFalse(metadata["retry_exhausted"])
        self.assertEqual(metadata["findings"], [])
        self.assertIsNone(metadata["checked_at"])
        self.assertIsNone(metadata["failure_type"])
        self.assertIsNone(metadata["last_attempted_at"])
        self.assertIsNone(metadata["last_provider_failure"])
        self.assertEqual(
            parse_datetime(metadata["retry_next_attempt_at"]),
            self.clock.return_value,
        )
        metadata["findings"].append({"flagged": True})
        self.assertEqual(ReviewModerationRetryService.initial_metadata()["findings"], [])

    def test_safe_initial_assessment_publishes_once_using_stored_snapshot(self):
        first = ReviewPhoto.objects.create(
            REVW_ID=self.review,
            RPHO_PHOTO_URL="https://example.com/first.jpg",
            RPHO_PHOTO_PUBLIC_ID="initial-first",
        )
        second = ReviewPhoto.objects.create(
            REVW_ID=self.review,
            RPHO_PHOTO_URL="https://example.com/second.jpg",
            RPHO_PHOTO_PUBLIC_ID="initial-second",
        )
        self.provider.side_effect = lambda **kwargs: moderation_result("safe")
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(retry_failed_review_moderation.run(self.review.pk, 0), "published")
            self.assertEqual(retry_failed_review_moderation.run(self.review.pk, 0), "stale")

        self.provider.assert_called_once_with(
            text=self.review.REVW_TEXT,
            image_urls=[first.RPHO_PHOTO_URL, second.RPHO_PHOTO_URL],
        )
        metadata = self.metadata()
        self.assertEqual(metadata["outcome"], "safe")
        self.assertEqual(metadata["retry_attempt"], 0)
        self.assertFalse(metadata["retryable"])
        self.assertNotIn("retry_claim_token", metadata)
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, 1)
        self.sentiment.assert_called_once_with(self.review.pk, self.business.pk)
        self.assertEqual(
            Notification.objects.filter(NOTF_TYPE="business_review_received").count(),
            1,
        )
        self.assertEqual(
            ReputationEvent.objects.filter(
                REVT_EVENT_TYPE=ReputationEvent.EventType.REVIEW_WITH_PHOTO_REWARD,
            ).count(),
            1,
        )
        self.assertEqual(
            ReviewInsightRegeneration.objects.get(BUSN_ID=self.business).RIRG_REQUESTED_REVISION,
            1,
        )
        self.assertEqual(recover_review_moderation_retries.run(), 0)

    @override_settings(OPENAI_API_KEY="test-key")
    def test_real_stored_moderation_maps_flagged_photo_and_keeps_review_private(self):
        photo = ReviewPhoto.objects.create(
            REVW_ID=self.review,
            RPHO_PHOTO_URL="https://example.com/flagged.jpg",
            RPHO_PHOTO_PUBLIC_ID="flagged-initial-photo",
        )
        with (
            patch.object(ReviewModerationService, "moderate", self.real_moderate),
            patch("apps.reviews.services.review_moderation_service.OpenAI") as client,
        ):
            create = client.return_value.moderations.create
            create.side_effect = [provider_response(), provider_response(flagged=True)]
            self.assertEqual(retry_failed_review_moderation.run(self.review.pk), "flagged")

        self.assertEqual(create.call_count, 2)
        self.assertEqual(
            create.call_args_list[0].kwargs["input"],
            [{"type": "text", "text": self.review.REVW_TEXT}],
        )
        self.assertEqual(
            create.call_args_list[1].kwargs["input"],
            [{"type": "image_url", "image_url": {"url": photo.RPHO_PHOTO_URL}}],
        )
        metadata = self.metadata()
        self.assertEqual(metadata["outcome"], "flagged")
        self.assertEqual(metadata["findings"][1]["photo_id"], photo.pk)
        self.assertFalse(metadata["retryable"])
        self.assertEqual(self.review.REVW_STATUS, Review.ReviewStatus.UNDER_REVIEW)
        self.assertEqual(recover_review_moderation_retries.run(), 0)
        self.assertFalse(ReviewInsightRegeneration.objects.exists())
        self.assertFalse(Notification.objects.exists())
        self.assertFalse(ReputationEvent.objects.exists())
        self.sentiment.assert_not_called()

    def test_initial_failure_preserves_full_existing_retry_budget_and_backoff(self):
        self.provider.side_effect = lambda **kwargs: moderation_result("provider_failure")
        self.assertEqual(retry_failed_review_moderation.run(self.review.pk), "provider_failure")
        metadata = self.metadata()
        self.assertEqual(metadata["retry_attempt"], 0)
        self.assertEqual(metadata["outcome"], "provider_failure")
        self.assertEqual(parse_datetime(metadata["retry_next_attempt_at"]), self.clock.return_value)
        self.assertEqual(metadata["last_provider_failure"], "TimeoutError")
        self.enqueue.assert_called_once_with(
            args=[self.review.pk, 0],
            countdown=0,
            retry=False,
        )

        for attempt, delay in enumerate((60, 120, 240)):
            with self.subTest(attempt=attempt):
                self.enqueue.reset_mock()
                self.assertEqual(
                    retry_failed_review_moderation.run(self.review.pk, attempt),
                    "provider_failure",
                )
                self.assertEqual(self.metadata()["retry_attempt"], attempt + 1)
                self.enqueue.assert_called_once_with(
                    args=[self.review.pk, attempt + 1],
                    countdown=delay,
                    retry=False,
                )
                self.assertEqual(retry_failed_review_moderation.run(self.review.pk), "stale")
                self.advance(delay)

        self.enqueue.reset_mock()
        self.assertEqual(retry_failed_review_moderation.run(self.review.pk, 3), "exhausted")
        self.assertEqual(self.provider.call_count, 5)
        self.assertEqual(self.metadata()["retry_attempt"], 4)
        self.assertTrue(self.metadata()["retry_exhausted"])
        self.assertIsNone(self.metadata()["retry_next_attempt_at"])
        self.assertEqual(recover_review_moderation_retries.run(), 0)
        self.enqueue.assert_not_called()
        self.sentiment.assert_not_called()

    def test_lost_initial_dispatch_and_failed_retry_dispatch_remain_recoverable(self):
        self.enqueue.side_effect = ConnectionError("PRIVATE broker credentials")
        with self.assertLogs(
            "apps.reviews.services.review_moderation_retry_service",
            level="ERROR",
        ):
            self.assertFalse(ReviewModerationRetryService.dispatch(self.review.pk))
        self.assertEqual(self.metadata()["outcome"], "pending_initial")
        self.provider.assert_not_called()
        self.enqueue.side_effect = None
        self.assertEqual(recover_review_moderation_retries.run(), 1)
        self.enqueue.side_effect = ConnectionError("PRIVATE broker credentials")
        self.provider.side_effect = lambda **kwargs: moderation_result("provider_failure")
        with self.assertLogs(
            "apps.reviews.services.review_moderation_retry_service",
            level="ERROR",
        ):
            self.assertEqual(retry_failed_review_moderation.run(self.review.pk), "provider_failure")
        self.enqueue.side_effect = None
        self.assertEqual(recover_review_moderation_retries.run(), 1)
        self.provider.side_effect = lambda **kwargs: moderation_result("safe")
        self.assertEqual(retry_failed_review_moderation.run(self.review.pk, 0), "published")

    def test_initial_worker_interruption_is_recovered_without_consuming_retry_budget(self):
        self.provider.side_effect = RuntimeError("Interrupted initial worker")
        with self.assertRaises(RuntimeError):
            retry_failed_review_moderation.run(self.review.pk)
        old_token = self.metadata()["retry_claim_token"]
        self.assertEqual(self.metadata()["outcome"], "pending_initial")
        self.assertIsNone(self.metadata()["checked_at"])
        self.assertEqual(recover_review_moderation_retries.run(), 0)
        self.assertEqual(retry_failed_review_moderation.run(self.review.pk), "stale")
        self.provider.assert_called_once()
        self.advance(ReviewModerationRetryService.CLAIM_SECONDS)
        self.assertEqual(recover_review_moderation_retries.run(), 1)

        def finish_initial(**kwargs):
            self.assertNotEqual(self.metadata()["retry_claim_token"], old_token)
            return moderation_result("flagged")

        self.provider.side_effect = finish_initial
        self.assertEqual(retry_failed_review_moderation.run(self.review.pk), "flagged")
        self.assertEqual(self.metadata()["retry_attempt"], 0)

    def test_stale_text_or_photos_discard_initial_result_and_release_claim(self):
        photo = ReviewPhoto.objects.create(
            REVW_ID=self.review,
            RPHO_PHOTO_URL="https://example.com/original.jpg",
            RPHO_PHOTO_PUBLIC_ID="original-photo",
        )
        for field, value in (
            ("REVW_TEXT", "New stored text."),
            ("RPHO_PHOTO_URL", "https://example.com/changed.jpg"),
            ("RPHO_PHOTO_PUBLIC_ID", "changed-photo"),
        ):
            with self.subTest(field=field):
                def change_source(**kwargs):
                    if field == "REVW_TEXT":
                        Review.objects.filter(pk=self.review.pk).update(**{field: value})
                    else:
                        ReviewPhoto.objects.filter(pk=photo.pk).update(**{field: value})
                    return moderation_result("safe")

                self.provider.side_effect = change_source
                self.assertEqual(retry_failed_review_moderation.run(self.review.pk), "stale")
                self.assertEqual(self.metadata()["outcome"], "pending_initial")
                self.assertEqual(self.metadata()["retry_attempt"], 0)
                self.assertNotIn("retry_claim_token", self.metadata())
                self.assertEqual(recover_review_moderation_retries.run(), 1)
        self.sentiment.assert_not_called()

    def assert_admin_decision_wins(
        self,
        approve,
    ):
        actor = User.objects.create_user(
            email="initial-admin@example.com",
            password=None,
            USER_ROLE=User.UserRole.ADMIN,
        )

        def decide(**kwargs):
            ManageUnderReviewService.resolve(
                self.review.pk,
                actor=actor,
                approve=approve,
                moderation_notes="Administrator inspected the stored review content.",
            )
            return moderation_result("safe")

        self.provider.side_effect = decide
        self.assertEqual(retry_failed_review_moderation.run(self.review.pk), "stale")
        self.review.refresh_from_db()
        expected = Review.ReviewStatus.REJECTED
        if approve:
            expected = Review.ReviewStatus.PUBLISHED
        self.assertEqual(self.review.REVW_STATUS, expected)
        self.assertEqual(self.metadata()["outcome"], "pending_initial")
        self.assertEqual(recover_review_moderation_retries.run(), 0)

    def test_admin_approval_prevents_initial_worker_from_republishing(self):
        self.assert_admin_decision_wins(approve=True)
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, 1)

    def test_admin_rejection_prevents_initial_worker_publication(self):
        self.assert_admin_decision_wins(approve=False)
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, 0)

    def test_deleted_initial_review_is_not_recreated(self):
        review_id = self.review.pk

        def delete_review(**kwargs):
            Review.objects.filter(pk=review_id).delete()
            return moderation_result("safe")

        self.provider.side_effect = delete_review
        self.assertEqual(retry_failed_review_moderation.run(review_id), "stale")
        self.assertFalse(Review.objects.filter(pk=review_id).exists())
        self.sentiment.assert_not_called()

    def test_changed_outcome_attempt_or_ownership_invalidates_initial_claim(self):
        initial = deepcopy(self.metadata())
        changed_identities = [
            {"outcome": "provider_failure"},
            {"retry_attempt": 1},
            {"retry_claim_token": "another-worker"},
            {"retry_claim_expires_at": self.clock.return_value.isoformat()},
        ]
        for updates in changed_identities:
            with self.subTest(updates=updates):
                Review.objects.filter(pk=self.review.pk).update(REVW_MODERATION_DATA=initial)

                def change_identity(**kwargs):
                    self.set_metadata(**updates)
                    return moderation_result("safe")

                self.provider.side_effect = change_identity
                self.assertEqual(retry_failed_review_moderation.run(self.review.pk), "stale")
        self.sentiment.assert_not_called()

    def test_late_initial_worker_cannot_overwrite_reclaimed_result(self):
        def reclaim_during_provider(**kwargs):
            self.advance(ReviewModerationRetryService.CLAIM_SECONDS)
            self.provider.side_effect = lambda **kwargs: moderation_result("flagged")
            self.assertEqual(retry_failed_review_moderation.run(self.review.pk), "flagged")
            return moderation_result("safe")

        self.provider.side_effect = reclaim_during_provider
        self.assertEqual(retry_failed_review_moderation.run(self.review.pk), "stale")
        self.assertEqual(self.metadata()["outcome"], "flagged")
        self.assertEqual(self.provider.call_count, 2)
        self.assertEqual(self.review.REVW_STATUS, Review.ReviewStatus.UNDER_REVIEW)
        self.sentiment.assert_not_called()

    def test_empty_legacy_and_incomplete_initial_markers_are_not_queued(self):
        initial = deepcopy(self.metadata())
        invalid_metadata = [
            {},
            {"findings": []},
            {"outcome": "pending_initial"},
            {**initial, "retry_attempt": 1},
            {**initial, "checked_at": self.clock.return_value.isoformat()},
            {**initial, "retry_next_attempt_at": None},
            {**initial, "findings": [{"source": "text", "flagged": True}]},
            {**initial, "outcome": "flagged"},
            {**initial, "retry_exhausted": True},
        ]
        for metadata in invalid_metadata:
            with self.subTest(metadata=metadata):
                Review.objects.filter(pk=self.review.pk).update(REVW_MODERATION_DATA=metadata)
                self.assertEqual(recover_review_moderation_retries.run(), 0)
                self.assertEqual(retry_failed_review_moderation.run(self.review.pk), "stale")
        self.provider.assert_not_called()
        self.enqueue.assert_not_called()

    def test_initial_and_legacy_provider_retries_share_recovery(self):
        author = User.objects.create_user(email="legacy-retry@example.com", password=None)
        retry = Review.objects.create(
            USER_ID=author,
            BUSN_ID=self.business,
            REVW_TEXT="A failed provider assessment awaiting retry.",
            REVW_STATUS=Review.ReviewStatus.UNDER_REVIEW,
            REVW_MODERATION_DATA={
                **moderation_result("provider_failure"),
                "retry_attempt": 2,
                "retryable": True,
                "retry_exhausted": False,
            },
        )
        self.assertEqual(recover_review_moderation_retries.run(), 2)
        self.assertEqual(
            {tuple(call.kwargs["args"]) for call in self.enqueue.call_args_list},
            {(self.review.pk, 0), (retry.pk, 2)},
        )
        self.assertEqual(retry_failed_review_moderation.run(self.review.pk), "flagged")
        self.assertEqual(retry_failed_review_moderation.run(retry.pk, 2), "flagged")
        retry.refresh_from_db()
        self.assertEqual(retry.REVW_MODERATION_DATA["retry_attempt"], 3)

    def test_initial_due_time_prevents_early_provider_checks(self):
        self.set_metadata(
            retry_next_attempt_at=(self.clock.return_value + timedelta(seconds=60)).isoformat(),
        )
        self.assertEqual(recover_review_moderation_retries.run(), 0)
        self.assertEqual(retry_failed_review_moderation.run(self.review.pk), "stale")
        self.provider.assert_not_called()
        self.advance(60)
        self.assertEqual(recover_review_moderation_retries.run(), 1)
        self.assertEqual(retry_failed_review_moderation.run(self.review.pk), "flagged")

    def test_publication_rollback_preserves_initial_claim_and_budget(self):
        self.provider.side_effect = lambda **kwargs: moderation_result("safe")
        with patch.object(ReviewService, "publish_under_review", side_effect=DatabaseError()):
            with self.assertRaises(DatabaseError):
                retry_failed_review_moderation.run(self.review.pk)
        self.assertEqual(self.metadata()["outcome"], "pending_initial")
        self.assertEqual(self.metadata()["retry_attempt"], 0)
        self.advance(ReviewModerationRetryService.CLAIM_SECONDS)
        self.assertEqual(recover_review_moderation_retries.run(), 1)
        self.assertEqual(retry_failed_review_moderation.run(self.review.pk), "published")


class InitialModerationConcurrencyTests(
    InitialModerationFixture,
    recovery_tests.ModerationRecoveryConcurrencyTests,
):
    """Run R3B's duplicate-sweep and worker publication test against initial intent."""
