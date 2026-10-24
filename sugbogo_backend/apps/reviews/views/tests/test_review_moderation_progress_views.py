from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import AnonymousUser
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient, APIRequestFactory, APITestCase

from apps.reviews.models import Review, ReviewPhoto
from apps.reviews.serializers.review_serializers import ReviewResponseSerializer
from apps.reviews.services.review_moderation_retry_service import (
    ReviewModerationRetryService,
)
from apps.reviews.services.tests.test_business_review_summary_service import (
    SummaryFixtureMixin,
)
from apps.users.models import User


class ReviewModerationProgressViewTests(SummaryFixtureMixin, APITestCase):
    """Exercise private progress and reconciliation through existing API routes."""

    @classmethod
    def setUpTestData(cls):
        cls.business = cls.create_business()
        cls.author = User.objects.create_user(
            email="moderation-progress@example.com",
            password=None,
            USER_FNAME="Review",
            USER_LNAME="Author",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

    def setUp(self):
        self.client.force_authenticate(self.author)
        self.preview_url = reverse(
            "review-preview",
            kwargs={"business_id": self.business.pk},
        )
        self.history_url = reverse("my-review-list")
        self.list_url = reverse(
            "review-list",
            kwargs={"business_id": self.business.pk},
        )
        self.review = Review.objects.create(
            BUSN_ID=self.business,
            USER_ID=self.author,
            REVW_TEXT="Private review awaiting a content safety assessment.",
            REVW_STATUS=Review.ReviewStatus.UNDER_REVIEW,
            REVW_MODERATION_DATA=ReviewModerationRetryService.initial_metadata(),
        )
        self.photo = ReviewPhoto.objects.create(
            REVW_ID=self.review,
            RPHO_PHOTO_URL="https://example.com/private-progress-photo.jpg",
            RPHO_PHOTO_PUBLIC_ID="private-progress-photo",
        )
        provider = patch(
            "apps.reviews.services.review_moderation_retry_service."
            "ReviewModerationService.moderate",
            side_effect=AssertionError("Progress reads must not call a provider."),
        )
        self.moderate = provider.start()
        self.addCleanup(provider.stop)

    def _assert_author_state(
        self,
        expected_state,
    ):
        """Check both restart-safe read paths and their existing envelopes."""
        preview = self.client.get(self.preview_url)
        history = self.client.get(self.history_url)
        self.assertEqual(preview.status_code, 200)
        self.assertEqual(history.status_code, 200)
        self.assertTrue(preview.data["success"])
        self.assertTrue(history.data["success"])
        for item in (
            preview.data["data"]["user_review"],
            history.data["data"]["items"][0],
        ):
            self.assertEqual(item["id"], self.review.pk)
            self.assertEqual(item["status"], self.review.REVW_STATUS)
            self.assertEqual(item["text"], self.review.REVW_TEXT)
            self.assertEqual(item["photos"][0]["id"], self.photo.pk)
            self.assertEqual(item["moderation_progress"], {"state": expected_state})
        self.moderate.assert_not_called()

    def _set_state(
        self,
        metadata,
        status=Review.ReviewStatus.UNDER_REVIEW,
    ):
        """Persist a worker/admin snapshot without invoking unrelated side effects."""
        self.review.REVW_MODERATION_DATA = metadata
        self.review.REVW_STATUS = status
        self.review.save(update_fields=["REVW_MODERATION_DATA", "REVW_STATUS"])

    def test_initial_pending_and_active_processing(self):
        self._assert_author_state("pending")
        metadata = self.review.REVW_MODERATION_DATA.copy()
        metadata["retry_claim_token"] = "secret-worker-claim"
        metadata["retry_claim_expires_at"] = (
            timezone.now() + timedelta(seconds=90)
        ).isoformat()
        self._set_state(metadata)
        self._assert_author_state("processing")

    def test_expired_interrupted_claim_returns_to_pending(self):
        metadata = self.review.REVW_MODERATION_DATA.copy()
        metadata["retry_claim_token"] = "expired-worker-claim"
        metadata["retry_claim_expires_at"] = (
            timezone.now() - timedelta(seconds=1)
        ).isoformat()
        self._set_state(metadata)
        self._assert_author_state("pending")

    def test_provider_failure_awaiting_retry_including_legacy_metadata(self):
        for metadata in (
            {"outcome": "provider_failure"},
            {
                "outcome": "provider_failure",
                "retry_attempt": 2,
                "retryable": True,
                "retry_exhausted": False,
                "retry_next_attempt_at": timezone.now().isoformat(),
                "findings": [],
            },
        ):
            with self.subTest(metadata=metadata):
                self._set_state(metadata)
                self._assert_author_state("awaiting_retry")

    def test_flagged_content_awaits_administration(self):
        self._set_state({"outcome": "flagged"})
        self._assert_author_state("awaiting_admin_review")
        self._set_state({}, status=Review.ReviewStatus.FLAGGED)
        self._assert_author_state("awaiting_admin_review")

    def test_automatic_retries_exhausted(self):
        self._set_state({
            "outcome": "provider_failure",
            "retry_attempt": 4,
            "retryable": False,
            "retry_exhausted": True,
            "retry_next_attempt_at": None,
        })
        self._assert_author_state("retries_exhausted")

    def test_legacy_and_incomplete_metadata_does_not_imply_queued_work(self):
        for metadata in (
            {},
            [],
            "legacy",
            {"outcome": "unknown"},
            {"outcome": "safe"},
            {"outcome": "pending_initial"},
            {"outcome": "provider_failure", "retryable": False},
            {"outcome": "provider_failure", "retry_attempt": "invalid"},
            {"outcome": "provider_failure", "retry_next_attempt_at": "invalid"},
            {"outcome": "provider_failure", "retry_attempt": 2},
            {"outcome": None},
        ):
            with self.subTest(metadata=metadata):
                self._set_state(metadata)
                self._assert_author_state("under_review")

    def test_reads_do_not_mutate_moderation_or_schedule_work(self):
        metadata = self.review.REVW_MODERATION_DATA.copy()
        updated_at = self.review.REVW_UPDATED_AT
        with patch(
            "apps.reviews.tasks.retry_failed_review_moderation.delay",
        ) as dispatch:
            self._assert_author_state("pending")
        dispatch.assert_not_called()
        self.review.refresh_from_db()
        self.assertEqual(self.review.REVW_MODERATION_DATA, metadata)
        self.assertEqual(self.review.REVW_UPDATED_AT, updated_at)

    def test_published_and_rejected_status_override_stale_worker_metadata(self):
        for status in (
            Review.ReviewStatus.PUBLISHED,
            Review.ReviewStatus.REJECTED,
        ):
            with self.subTest(status=status):
                self._set_state(
                    self.review.REVW_MODERATION_DATA,
                    status=status,
                )
                self._assert_author_state(status)

    def test_reads_reflect_initial_retry_flagged_and_admin_decision_transitions(self):
        self._assert_author_state("pending")
        self._set_state({"outcome": "provider_failure"})
        self._assert_author_state("awaiting_retry")
        self._set_state({"outcome": "flagged"})
        self._assert_author_state("awaiting_admin_review")
        self._set_state({"outcome": "flagged"}, status=Review.ReviewStatus.REJECTED)
        self._assert_author_state("rejected")

    def test_other_user_cannot_read_private_content_or_progress(self):
        self.client.force_authenticate(self.business.USER_ID)
        for status in (
            Review.ReviewStatus.UNDER_REVIEW,
            Review.ReviewStatus.FLAGGED,
            Review.ReviewStatus.REJECTED,
        ):
            with self.subTest(status=status):
                self._set_state({}, status=status)
                preview = self.client.get(self.preview_url)
                history = self.client.get(self.history_url)
                public_list = self.client.get(self.list_url)
                self.assertIsNone(preview.data["data"]["user_review"])
                self.assertEqual(preview.data["data"]["reviews"], [])
                self.assertEqual(history.data["data"]["items"], [])
                self.assertEqual(public_list.data["data"]["items"], [])
                for response in (preview, history, public_list):
                    rendered = response.content.decode()
                    self.assertNotIn(self.review.REVW_TEXT, rendered)
                    self.assertNotIn(self.photo.RPHO_PHOTO_URL, rendered)
                    self.assertNotIn("moderation_progress", rendered)

    def test_other_reader_sees_published_content_without_private_progress(self):
        self._set_state({}, status=Review.ReviewStatus.PUBLISHED)
        self.client.force_authenticate(self.business.USER_ID)
        preview = self.client.get(self.preview_url)
        public_list = self.client.get(self.list_url)
        for item in (
            preview.data["data"]["reviews"][0],
            public_list.data["data"]["items"][0],
        ):
            self.assertEqual(item["id"], self.review.pk)
            self.assertNotIn("moderation_progress", item)

    def test_anonymous_reads_are_denied(self):
        self.client.force_authenticate(None)
        for url in (self.preview_url, self.history_url, self.list_url):
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertIn(response.status_code, (401, 403))
                self.assertNotIn(self.review.REVW_TEXT, response.content.decode())

    def test_progress_requires_authenticated_author_context(self):
        self.review.is_own_review = True
        self.assertNotIn(
            "moderation_progress",
            ReviewResponseSerializer(self.review).data,
        )
        for user in (AnonymousUser(), self.business.USER_ID):
            with self.subTest(user=user):
                request = APIRequestFactory().get(self.preview_url)
                request.user = user
                data = ReviewResponseSerializer(
                    self.review,
                    context={"request": request},
                ).data
                self.assertNotIn("moderation_progress", data)

    def test_progress_does_not_expose_private_evidence_or_worker_metadata(self):
        self._set_state({
            "outcome": "provider_failure",
            "failure_type": "private-provider-error",
            "findings": [{"source": "cebuano", "evidence": "private-finding"}],
            "retry_claim_token": "private-claim",
            "retry_attempt": 1,
            "retry_next_attempt_at": timezone.now().isoformat(),
            "retry_claim_expires_at": timezone.now().isoformat(),
        })
        for url in (self.preview_url, self.history_url):
            response = self.client.get(url)
            rendered = response.content.decode()
            for secret in (
                "private-provider-error",
                "private-finding",
                "private-claim",
                "retry_attempt",
                "retry_next_attempt_at",
                "retry_claim_expires_at",
            ):
                self.assertNotIn(secret, rendered)
        self._assert_author_state("awaiting_retry")

    @patch("apps.reviews.tasks.retry_failed_review_moderation.delay")
    def test_creation_acknowledgement_and_lost_response_reconcile_without_duplicates(
        self,
        dispatch,
    ):
        self.review.delete()
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                self.preview_url,
                {"text": "This business had very friendly staff and excellent service."},
                format="multipart",
            )
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertEqual(set(data), {
            "id", "business_id", "user_id", "status", "moderation_progress",
        })
        self.assertEqual(data["status"], "under_review")
        self.assertEqual(data["moderation_progress"], {"state": "pending"})
        dispatch.assert_called_once_with(data["id"])
        self.moderate.assert_not_called()

        # A new client can recover the accepted identity without the POST response.
        self.client = APIClient()
        self.client.force_authenticate(self.author)
        preview = self.client.get(self.preview_url)
        history = self.client.get(self.history_url)
        for item in (
            preview.data["data"]["user_review"],
            history.data["data"]["items"][0],
        ):
            self.assertEqual(item["id"], data["id"])
            self.assertEqual(item["moderation_progress"], {"state": "pending"})

        duplicate = self.client.post(
            self.preview_url,
            {"text": "Another attempt after a network timeout should not duplicate it."},
            format="multipart",
        )
        self.assertEqual(duplicate.status_code, 400)
        self.assertFalse(duplicate.data["success"])
        self.assertEqual(Review.objects.filter(USER_ID=self.author).count(), 1)
        self.assertEqual(
            self.client.get(self.preview_url).data["data"]["user_review"]["id"],
            data["id"],
        )
