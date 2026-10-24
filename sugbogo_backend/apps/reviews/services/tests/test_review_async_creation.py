"""Committed private intake and stored-content moderation for new submissions."""

from copy import deepcopy
from unittest.mock import patch

from django.db import DatabaseError, connection, transaction
from django.test import TransactionTestCase, override_settings
from django.utils import timezone

from apps.admin_operations.moderation.services.manage_under_review_service import (
    ManageUnderReviewService,
)
from apps.admin_operations.system_configuration.models import AnalyticsPolicyConfiguration
from apps.notifications.models import Notification
from apps.reviews.models import Review, ReviewInsightRegeneration, ReviewPhoto
from apps.reviews.services.review_insight_scheduling_service import ReviewInsightSchedulingService
from apps.reviews.services.review_service import ReviewEditContentFlagged, ReviewService
from apps.reviews.services.tests import test_review_service as review_tests
from apps.reviews.services.tests.test_review_moderation_service import provider_response
from apps.reviews.tasks import recover_review_moderation_retries, retry_failed_review_moderation
from apps.users.models import ReputationEvent, User


@override_settings(
    OPENAI_API_KEY="test-key",
    PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"],
)
class AsyncReviewCreationTests(TransactionTestCase):
    """Exercise actual commits with provider, upload, and delivery boundaries mocked."""

    def setUp(self):
        review_tests.ReviewServiceTests.setUpTestData.__func__(type(self))
        AnalyticsPolicyConfiguration.objects.get_or_create(pk=1)
        self.clock = self.enterContext(
            patch("django.utils.timezone.now", return_value=timezone.now()),
        )
        self.openai = self.enterContext(
            patch("apps.reviews.services.review_moderation_service.OpenAI"),
        )
        self.check = self.openai.return_value.moderations.create
        self.check.side_effect = lambda **kwargs: provider_response()
        self.upload = self.enterContext(
            patch(
                "apps.reviews.services.review_service.CloudinaryService.upload_image",
                side_effect=lambda photo, **kwargs: {
                    "public_id": f"reviews/{photo.name}",
                    "secure_url": f"https://example.com/{photo.name}",
                },
            ),
        )
        self.destroy = self.enterContext(
            patch(
                "apps.shared.services.cloudinary_service.cloudinary.uploader.destroy",
                return_value={"result": "ok"},
            ),
        )
        self.initial_dispatch = self.enterContext(
            patch("apps.reviews.tasks.retry_failed_review_moderation.delay"),
        )
        self.retry_dispatch = self.enterContext(
            patch("apps.reviews.tasks.retry_failed_review_moderation.apply_async"),
        )
        self.sentiment = self.enterContext(
            patch("apps.reviews.tasks.process_review_sentiment.delay"),
        )
        self.demand = self.enterContext(
            patch.object(
                ReviewInsightSchedulingService,
                "review_changed",
                wraps=ReviewInsightSchedulingService.review_changed,
            ),
        )

    def submit(
        self,
        photo_count=0,
        text="Excellent food and welcoming staff.",
    ):
        return ReviewService.create_review(
            user=self.user,
            business_id=self.business.pk,
            text=text,
            photos=[
                review_tests.ReviewServiceTests.create_test_image(f"{index}.jpg")
                for index in range(photo_count)
            ],
            installation_id="async-review-installation",
            show_in_community=False,
        )

    def assert_unpublished(
        self,
        review,
    ):
        review.refresh_from_db()
        self.business.refresh_from_db()
        self.assertEqual(review.REVW_STATUS, Review.ReviewStatus.UNDER_REVIEW)
        self.assertIsNone(review.REVW_PUBLISHED_AT)
        self.assertIsNone(review.REVW_SENTIMENT_LABEL)
        self.assertIsNone(review.REVW_SENTIMENT_SCORE)
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, 0)
        self.assertFalse(Notification.objects.exists())
        self.assertFalse(ReputationEvent.objects.exists())
        self.assertFalse(ReviewInsightRegeneration.objects.exists())
        self.sentiment.assert_not_called()
        self.demand.assert_not_called()

    def test_private_intake_never_calls_openai_or_publication_effects(self):
        review = self.submit(photo_count=2)
        self.openai.assert_not_called()
        self.assert_unpublished(review)
        self.assertEqual(review.photos.count(), 2)
        self.assertEqual(review.REVW_INSTALLATION_ID, "async-review-installation")
        self.assertFalse(review.REVW_SHOW_IN_COMMUNITY)
        self.assertEqual(
            review.REVW_RELIABILITY_CHECK_OUTCOME,
            Review.ReliabilityCheckOutcome.CHECKED,
        )
        metadata = review.REVW_MODERATION_DATA
        self.assertEqual(metadata["outcome"], "pending_initial")
        self.assertEqual(metadata["findings"], [])
        self.assertEqual(metadata["retry_attempt"], 0)
        self.assertIsNone(metadata["checked_at"])
        self.initial_dispatch.assert_called_once_with(review.pk)
        self.destroy.assert_not_called()
        other_preview = ReviewService.get_review_preview(self.business.pk, self.second_user)
        self.assertEqual(other_preview["reviews"], [])
        self.assertIsNone(other_preview["user_review"])
        own_preview = ReviewService.get_review_preview(self.business.pk, self.user)
        self.assertEqual(own_preview["user_review"].pk, review.pk)

    def test_dispatch_sees_committed_photos_and_fast_worker_publishes_once(self):
        def execute_after_commit(review_id):
            self.assertFalse(connection.in_atomic_block)
            stored = Review.objects.get(pk=review_id)
            self.assertEqual(stored.photos.count(), 2)
            self.assertEqual(stored.REVW_MODERATION_DATA["outcome"], "pending_initial")
            self.assertEqual(retry_failed_review_moderation.run(review_id), "published")

        self.initial_dispatch.side_effect = execute_after_commit
        review = self.submit(photo_count=2)
        self.assertEqual(review.REVW_STATUS, Review.ReviewStatus.UNDER_REVIEW)
        review.refresh_from_db()
        published_at = review.REVW_PUBLISHED_AT
        self.assertEqual(review.REVW_STATUS, Review.ReviewStatus.PUBLISHED)
        self.assertEqual(retry_failed_review_moderation.run(review.pk, 0), "stale")
        self.assertEqual(self.check.call_count, 3)
        self.assertEqual(
            [call.kwargs["input"] for call in self.check.call_args_list],
            [
                [{"type": "text", "text": review.REVW_TEXT}],
                [{"type": "image_url", "image_url": {"url": "https://example.com/0.jpg"}}],
                [{"type": "image_url", "image_url": {"url": "https://example.com/1.jpg"}}],
            ],
        )
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, 1)
        self.assertEqual(Notification.objects.count(), 1)
        self.assertEqual(ReputationEvent.objects.count(), 1)
        self.sentiment.assert_called_once_with(review.pk, self.business.pk)
        self.demand.assert_called_once()
        regeneration = ReviewInsightRegeneration.objects.get(BUSN_ID=self.business)
        self.assertEqual(regeneration.RIRG_REQUESTED_REVISION, 1)
        self.assertIsNotNone(regeneration.RIRG_DUE_AT)
        review.refresh_from_db()
        self.assertEqual(review.REVW_PUBLISHED_AT, published_at)
        self.destroy.assert_not_called()

    def test_outer_rollback_discards_dispatch_and_initial_work(self):
        with self.assertRaises(DatabaseError):
            with transaction.atomic():
                self.submit()
                self.initial_dispatch.assert_not_called()
                raise DatabaseError("Rollback enclosing request")
        self.assertFalse(Review.objects.exists())
        self.initial_dispatch.assert_not_called()
        self.openai.assert_not_called()
        self.assertEqual(recover_review_moderation_retries.run(), 0)

    def test_failure_after_callback_registration_rolls_back_and_compensates_uploads(self):
        queue_after_commit = ReviewService._queue_moderation_retry_after_commit

        def register_then_fail(review_id):
            queue_after_commit(review_id)
            raise DatabaseError("Rollback after registration")

        with patch.object(
            ReviewService,
            "_queue_moderation_retry_after_commit",
            side_effect=register_then_fail,
        ):
            with self.assertRaisesMessage(DatabaseError, "Rollback after registration"):
                self.submit(photo_count=2)

        self.assertFalse(Review.objects.exists())
        self.assertFalse(ReviewPhoto.objects.exists())
        self.initial_dispatch.assert_not_called()
        self.assertEqual(self.destroy.call_count, 2)
        self.openai.assert_not_called()

    def test_failed_dispatch_keeps_pending_work_for_recovery(self):
        self.initial_dispatch.side_effect = ConnectionError("Unavailable broker")
        with self.assertLogs("apps.reviews.services.review_service", level="ERROR"):
            review = self.submit(photo_count=1)
        self.assert_unpublished(review)
        self.assertEqual(recover_review_moderation_retries.run(), 1)
        self.retry_dispatch.assert_called_once_with(
            args=[review.pk, 0],
            countdown=0,
            retry=False,
        )
        self.assertEqual(retry_failed_review_moderation.run(review.pk, 0), "published")
        self.destroy.assert_not_called()

    def test_flagged_image_stays_held_with_stored_photo_evidence(self):
        review = self.submit(photo_count=1)
        self.check.side_effect = [provider_response(), provider_response(flagged=True)]
        self.assertEqual(retry_failed_review_moderation.run(review.pk), "flagged")
        self.assert_unpublished(review)
        self.assertEqual(review.REVW_MODERATION_DATA["outcome"], "flagged")
        self.assertEqual(
            review.REVW_MODERATION_DATA["findings"][1]["photo_id"],
            review.photos.get().pk,
        )
        self.assertEqual(recover_review_moderation_retries.run(), 0)
        self.retry_dispatch.assert_not_called()

    def test_cebuano_fallback_runs_in_worker_and_holds_safe_provider_result(self):
        review = self.submit(text="Patyon nako ang mga customer.")
        self.openai.assert_not_called()
        self.assertEqual(retry_failed_review_moderation.run(review.pk), "flagged")
        self.assert_unpublished(review)
        self.assertEqual(
            review.REVW_MODERATION_DATA["findings"][0]["source"],
            "local_cebuano_safety",
        )

    def test_provider_failure_enters_existing_retry_zero_then_recovers(self):
        review = self.submit()
        self.check.side_effect = TimeoutError("Mocked provider outage")
        self.assertEqual(retry_failed_review_moderation.run(review.pk), "provider_failure")
        self.assert_unpublished(review)
        self.assertEqual(review.REVW_MODERATION_DATA["retry_attempt"], 0)
        self.assertEqual(review.REVW_MODERATION_DATA["outcome"], "provider_failure")
        self.retry_dispatch.assert_called_once_with(
            args=[review.pk, 0],
            countdown=0,
            retry=False,
        )
        self.check.side_effect = lambda **kwargs: provider_response()
        self.assertEqual(retry_failed_review_moderation.run(review.pk, 0), "published")
        self.sentiment.assert_called_once()

    def test_author_deletion_during_check_does_not_publish_or_recreate_review(self):
        review = self.submit()
        review_id = review.pk

        def delete_during_check(**kwargs):
            ReviewService.delete_review(self.user, review_id)
            return provider_response()

        self.check.side_effect = delete_during_check
        self.assertEqual(retry_failed_review_moderation.run(review_id), "stale")
        self.assertFalse(Review.objects.filter(pk=review_id).exists())
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, 0)
        self.sentiment.assert_not_called()
        self.assertFalse(ReputationEvent.objects.exists())

    def assert_admin_wins(
        self,
        approve,
    ):
        review = self.submit()
        actor = User.objects.create_user(
            email="async-moderation-admin@example.com",
            password=None,
            USER_ROLE=User.UserRole.ADMIN,
        )

        def decide_during_check(**kwargs):
            ManageUnderReviewService.resolve(
                review.pk,
                actor=actor,
                approve=approve,
                moderation_notes="Administrator inspected the submitted review.",
            )
            return provider_response()

        self.check.side_effect = decide_during_check
        self.assertEqual(retry_failed_review_moderation.run(review.pk), "stale")
        self.assertEqual(retry_failed_review_moderation.run(review.pk), "stale")
        self.check.assert_called_once()
        review.refresh_from_db()
        self.business.refresh_from_db()
        if approve:
            self.assertEqual(review.REVW_STATUS, Review.ReviewStatus.PUBLISHED)
            self.assertEqual(self.business.BUSN_REVIEW_COUNT, 1)
            self.sentiment.assert_called_once()
        else:
            self.assert_unpublished_side_effects_after_rejection(review)

    def assert_unpublished_side_effects_after_rejection(
        self,
        review,
    ):
        self.assertEqual(review.REVW_STATUS, Review.ReviewStatus.REJECTED)
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, 0)
        self.assertFalse(ReputationEvent.objects.exists())
        self.sentiment.assert_not_called()

    def test_admin_approval_during_check_preserves_single_publication(self):
        self.assert_admin_wins(approve=True)

    def test_admin_rejection_during_check_prevents_publication(self):
        self.assert_admin_wins(approve=False)

    def test_stale_source_is_discarded_before_fresh_assessment(self):
        review = self.submit()

        def change_source(**kwargs):
            Review.objects.filter(pk=review.pk).update(REVW_TEXT="New authoritative stored text.")
            return provider_response()

        self.check.side_effect = change_source
        self.assertEqual(retry_failed_review_moderation.run(review.pk), "stale")
        self.assert_unpublished(review)
        self.assertEqual(review.REVW_MODERATION_DATA["outcome"], "pending_initial")
        self.check.side_effect = lambda **kwargs: provider_response()
        self.assertEqual(retry_failed_review_moderation.run(review.pk), "published")
        self.assertEqual(
            self.check.call_args.kwargs["input"],
            [{"type": "text", "text": "New authoritative stored text."}],
        )

    def test_published_review_edits_remain_synchronous_and_fail_closed(self):
        review = self.submit()
        self.assertEqual(retry_failed_review_moderation.run(review.pk), "published")
        review.refresh_from_db()
        previous_text = review.REVW_TEXT
        metadata = deepcopy(review.REVW_MODERATION_DATA)
        self.check.reset_mock()
        self.check.side_effect = lambda **kwargs: provider_response(flagged=True)
        with self.assertRaises(ReviewEditContentFlagged):
            ReviewService.update_review(
                self.user,
                review.pk,
                text="Flagged proposed edit checked synchronously.",
            )
        self.check.assert_called_once()
        review.refresh_from_db()
        self.assertEqual(review.REVW_TEXT, previous_text)
        self.assertEqual(review.REVW_MODERATION_DATA, metadata)
        self.check.side_effect = lambda **kwargs: provider_response()
        ReviewService.update_review(
            self.user,
            review.pk,
            text="Accepted edit checked before the request returns.",
        )
        review.refresh_from_db()
        self.assertEqual(review.REVW_TEXT, "Accepted edit checked before the request returns.")
        self.assertEqual(self.check.call_count, 2)
        self.initial_dispatch.assert_called_once_with(review.pk)
