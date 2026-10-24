"""Automatic recovery for reviews held by moderation provider failures."""

from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.db import connection
from django.test import SimpleTestCase, TestCase, TransactionTestCase
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.business.models import Business, Category, Cluster, Location
from apps.reviews.models import Review, ReviewInsightRegeneration, ReviewPhoto
from apps.reviews.services.review_moderation_retry_service import (
    ReviewModerationRetryService,
)
from apps.reviews.services.review_service import ReviewService
from apps.reviews.tasks import retry_failed_review_moderation
from apps.users.models import User


def create_held_review() -> tuple[Review, Business]:
    owner = User.objects.create_user(
        email="moderation-retry-owner@example.com",
        password="StrongPassword123!",
        USER_FNAME="Business",
        USER_LNAME="Owner",
        USER_ROLE=User.UserRole.EXPLORER,
        USER_STATUS=User.UserStatus.ACTIVE,
    )
    author = User.objects.create_user(
        email="moderation-retry-author@example.com",
        password="StrongPassword123!",
        USER_FNAME="Review",
        USER_LNAME="Author",
        USER_ROLE=User.UserRole.EXPLORER,
        USER_STATUS=User.UserStatus.ACTIVE,
    )
    cluster = Cluster.objects.create(
        CLUS_NAME="Review retry test cluster",
        CLUS_DESCRIPTION="Test businesses",
    )
    category = Category.objects.create(
        CTGRY_NAME="Review retry test category",
        CTGRY_DESCRIPTION="Test category",
        CLUS_ID=cluster,
    )
    location = Location.objects.create(
        LOCT_POINT=Point(123.8854, 10.3157, srid=4326),
        LOCT_ADDRESS="Gorordo Avenue",
        LOCT_CITY="Cebu City",
        LOCT_PROVINCE="Cebu",
    )
    business = Business.objects.create(
        BUSN_NAME="Moderation Retry Business",
        BUSN_DESCRIPTION="A test business for moderation recovery.",
        BUSN_STATUS=Business.BusinessStatus.ACTIVE,
        USER_ID=owner,
        CTGRY_ID=category,
        LOCT_ID=location,
    )
    review = Review.objects.create(
        USER_ID=author,
        BUSN_ID=business,
        REVW_TEXT="A saved review waiting for provider recovery.",
        REVW_STATUS=Review.ReviewStatus.UNDER_REVIEW,
        REVW_MODERATION_DATA={
            "outcome": "provider_failure",
            "model": "omni-moderation-latest",
            "checked_at": "2026-10-11T00:00:00+00:00",
            "failure_type": "TimeoutError",
            "image_count": 0,
            "findings": [],
            "retry_attempt": 0,
            "retryable": True,
            "retry_exhausted": False,
            "last_attempted_at": "2026-10-11T00:00:00+00:00",
            "last_provider_failure": "TimeoutError",
        },
    )
    return review, business


def moderation_result(
    outcome: str,
    image_count: int = 0,
) -> dict:
    return {
        "outcome": outcome,
        "model": "omni-moderation-latest",
        "checked_at": "2026-10-11T00:01:00+00:00",
        "failure_type": "TimeoutError" if outcome == "provider_failure" else None,
        "image_count": image_count,
        "findings": [
            {
                "source": "text",
                "photo_index": None,
                "flagged": outcome == "flagged" and image_count == 0,
                "categories": {"violence": outcome == "flagged"},
            },
        ],
    }


class ReviewModerationRetryTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.review, cls.business = create_held_review()

    def setUp(self):
        self.clock = self.enterContext(
            patch("django.utils.timezone.now", return_value=timezone.now()),
        )

    def advance_to_retry(self):
        self.review.refresh_from_db()
        self.clock.return_value = parse_datetime(
            self.review.REVW_MODERATION_DATA["retry_next_attempt_at"],
        )

    @patch(
        "apps.reviews.services.review_moderation_retry_service."
        "ReviewModerationService.moderate",
        return_value=moderation_result("safe"),
    )
    def test_safe_retry_uses_publication_transition_exactly_once(
        self,
        moderate,
    ):
        with (
            patch.object(
                ReviewService,
                "publish_under_review",
                wraps=ReviewService.publish_under_review,
            ) as publish,
            patch.object(ReviewService, "_queue_sentiment_after_commit") as sentiment,
            patch.object(ReviewService, "_queue_review_insights_after_commit") as insights,
        ):
            outcome = ReviewModerationRetryService.retry(
                review_id=self.review.pk,
                expected_attempt=0,
                max_retries=3,
            )
            duplicate = ReviewModerationRetryService.retry(
                review_id=self.review.pk,
                expected_attempt=0,
                max_retries=3,
            )

        self.assertEqual(outcome, "published")
        self.assertEqual(duplicate, "stale")
        moderate.assert_called_once_with(
            text=self.review.REVW_TEXT,
            image_urls=[],
        )
        publish.assert_called_once_with(self.review.pk)
        sentiment.assert_called_once_with(self.review.pk, self.business.pk)
        insights.assert_not_called()
        self.assertEqual(
            ReviewInsightRegeneration.objects.get(
                BUSN_ID=self.business,
            ).RIRG_REQUESTED_REVISION,
            1,
        )
        self.review.refresh_from_db()
        self.business.refresh_from_db()
        self.assertEqual(self.review.REVW_STATUS, Review.ReviewStatus.PUBLISHED)
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, 1)
        self.assertFalse(self.review.REVW_MODERATION_DATA["retryable"])

    @patch(
        "apps.reviews.services.review_moderation_retry_service."
        "ReviewModerationService.moderate",
    )
    def test_flagged_persisted_image_stays_held_with_photo_identity(
        self,
        moderate,
    ):
        first = ReviewPhoto.objects.create(
            REVW_ID=self.review,
            RPHO_PHOTO_URL=(
                "https://res.cloudinary.com/test/image/upload/first.jpg"
            ),
            RPHO_PHOTO_PUBLIC_ID="first",
        )
        second = ReviewPhoto.objects.create(
            REVW_ID=self.review,
            RPHO_PHOTO_URL=(
                "https://res.cloudinary.com/test/image/upload/second.jpg"
            ),
            RPHO_PHOTO_PUBLIC_ID="second",
        )
        result = moderation_result("flagged", image_count=2)
        result["findings"][0]["flagged"] = False
        result["findings"].extend([
            {
                "source": "image",
                "photo_index": 0,
                "flagged": False,
                "categories": {"violence": False},
            },
            {
                "source": "image",
                "photo_index": 1,
                "flagged": True,
                "categories": {"violence": True},
            },
        ])
        moderate.return_value = result

        outcome = ReviewModerationRetryService.retry(
            review_id=self.review.pk,
            expected_attempt=0,
            max_retries=3,
        )
        self.assertEqual(outcome, "flagged")
        moderate.assert_called_once_with(
            text=self.review.REVW_TEXT,
            image_urls=[first.RPHO_PHOTO_URL, second.RPHO_PHOTO_URL],
        )
        self.review.refresh_from_db()
        findings = self.review.REVW_MODERATION_DATA["findings"]
        self.assertEqual(self.review.REVW_STATUS, Review.ReviewStatus.UNDER_REVIEW)
        self.assertEqual(self.review.REVW_MODERATION_DATA["outcome"], "flagged")
        self.assertFalse(self.review.REVW_MODERATION_DATA["retryable"])
        self.assertEqual(findings[1]["photo_id"], first.pk)
        self.assertEqual(findings[2]["photo_id"], second.pk)
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, 0)

    @patch(
        "apps.reviews.services.review_moderation_retry_service."
        "ReviewModerationService.moderate",
        return_value=moderation_result("provider_failure"),
    )
    def test_provider_failures_record_attempts_and_exhaustion(
        self,
        moderate,
    ):
        for retry_number in range(4):
            with self.subTest(retry_number=retry_number):
                outcome = ReviewModerationRetryService.retry(
                    review_id=self.review.pk,
                    expected_attempt=retry_number,
                    max_retries=3,
                )
                if retry_number == 3:
                    expected_outcome = "exhausted"
                else:
                    expected_outcome = "provider_failure"
                self.assertEqual(outcome, expected_outcome)
                self.review.refresh_from_db()
                self.assertEqual(
                    self.review.REVW_MODERATION_DATA["retry_attempt"],
                    retry_number + 1,
                )
                if retry_number < 3:
                    self.advance_to_retry()

        self.assertEqual(moderate.call_count, 4)
        self.assertEqual(self.review.REVW_STATUS, Review.ReviewStatus.UNDER_REVIEW)
        self.assertFalse(self.review.REVW_MODERATION_DATA["retryable"])
        self.assertTrue(self.review.REVW_MODERATION_DATA["retry_exhausted"])
        self.assertEqual(
            self.review.REVW_MODERATION_DATA["last_provider_failure"],
            "TimeoutError",
        )
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, 0)
        self.assertEqual(
            ReviewModerationRetryService.retry(self.review.pk, 4, 3),
            "stale",
        )

    @patch(
        "apps.reviews.services.review_moderation_retry_service."
        "ReviewModerationService.moderate",
    )
    def test_local_finding_preserves_provider_retry_until_check_completes(
        self,
        moderate,
    ):
        """Local evidence cannot suppress recovery from a separate outage."""
        local_finding = {
            "source": "local_cebuano_safety",
            "photo_index": None,
            "flagged": True,
            "category": "violence_threat",
            "matched_rule": "direct_kill_threat",
        }
        metadata = self.review.REVW_MODERATION_DATA
        metadata["findings"] = [local_finding]
        self.review.save(update_fields=["REVW_MODERATION_DATA"])

        failed_again = moderation_result("provider_failure")
        failed_again["findings"].insert(0, local_finding)
        completed = moderation_result("flagged")
        completed["findings"][0]["flagged"] = False
        completed["findings"].insert(0, local_finding)
        moderate.side_effect = [failed_again, completed]

        first_outcome = ReviewModerationRetryService.retry(
            self.review.pk,
            expected_attempt=0,
            max_retries=3,
        )
        self.advance_to_retry()
        second_outcome = ReviewModerationRetryService.retry(
            self.review.pk,
            expected_attempt=1,
            max_retries=3,
        )

        self.assertEqual(first_outcome, "provider_failure")
        self.assertEqual(second_outcome, "flagged")
        self.assertEqual(moderate.call_count, 2)
        self.review.refresh_from_db()
        self.business.refresh_from_db()
        self.assertEqual(self.review.REVW_STATUS, Review.ReviewStatus.UNDER_REVIEW)
        self.assertFalse(self.review.REVW_MODERATION_DATA["retryable"])
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, 0)

    @patch(
        "apps.reviews.services.review_moderation_retry_service."
        "ReviewModerationService.moderate",
        return_value=moderation_result("provider_failure"),
    )
    def test_final_task_failure_stays_held_without_another_retry(
        self,
        moderate,
    ):
        metadata = self.review.REVW_MODERATION_DATA
        metadata["retry_attempt"] = 3
        self.review.save(update_fields=["REVW_MODERATION_DATA"])

        with patch.object(ReviewModerationRetryService, "dispatch") as dispatch:
            outcome = retry_failed_review_moderation.run(self.review.pk)

        self.assertEqual(outcome, "exhausted")
        moderate.assert_called_once()
        dispatch.assert_not_called()
        self.review.refresh_from_db()
        self.assertEqual(self.review.REVW_STATUS, Review.ReviewStatus.UNDER_REVIEW)
        self.assertTrue(self.review.REVW_MODERATION_DATA["retry_exhausted"])
        self.assertFalse(self.review.REVW_MODERATION_DATA["retryable"])

    @patch(
        "apps.reviews.services.review_moderation_retry_service."
        "ReviewModerationService.moderate",
    )
    def test_non_retryable_and_deleted_reviews_skip_provider(
        self,
        moderate,
    ):
        self.review.REVW_STATUS = Review.ReviewStatus.REJECTED
        self.review.save(update_fields=["REVW_STATUS"])
        self.assertEqual(
            ReviewModerationRetryService.retry(self.review.pk, 0, 3),
            "stale",
        )

        self.review.REVW_STATUS = Review.ReviewStatus.UNDER_REVIEW
        self.review.REVW_MODERATION_DATA["outcome"] = "flagged"
        self.review.save(update_fields=["REVW_STATUS", "REVW_MODERATION_DATA"])
        self.assertEqual(
            ReviewModerationRetryService.retry(self.review.pk, 0, 3),
            "stale",
        )

        self.review.REVW_MODERATION_DATA["outcome"] = "provider_failure"
        self.review.REVW_MODERATION_DATA["findings"] = [
            {"source": "image", "flagged": True},
        ]
        self.review.save(update_fields=["REVW_MODERATION_DATA"])
        self.assertEqual(
            ReviewModerationRetryService.retry(self.review.pk, 0, 3),
            "stale",
        )

        review_id = self.review.pk
        self.review.delete()
        self.assertEqual(
            ReviewModerationRetryService.retry(review_id, 0, 3),
            "stale",
        )
        moderate.assert_not_called()

    @patch(
        "apps.reviews.services.review_moderation_retry_service."
        "ReviewModerationService.moderate",
        return_value=moderation_result("safe"),
    )
    def test_state_change_during_provider_call_discards_result(
        self,
        moderate,
    ):
        def publish_during_call(**kwargs):
            ReviewService.publish_under_review(self.review.pk)
            return moderation_result("safe")

        moderate.side_effect = publish_during_call
        outcome = ReviewModerationRetryService.retry(self.review.pk, 0, 3)
        self.assertEqual(outcome, "stale")
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, 1)


class ReviewModerationRetryTransactionTests(TransactionTestCase):
    def test_provider_call_occurs_outside_database_transaction(self):
        review, business = create_held_review()

        def check_transaction(**kwargs):
            self.assertFalse(connection.in_atomic_block)
            return moderation_result("flagged")

        with patch(
            "apps.reviews.services.review_moderation_retry_service."
            "ReviewModerationService.moderate",
            side_effect=check_transaction,
        ):
            outcome = ReviewModerationRetryService.retry(review.pk, 0, 3)

        self.assertEqual(outcome, "flagged")
        business.refresh_from_db()
        self.assertEqual(business.BUSN_REVIEW_COUNT, 0)


class ReviewModerationRetryTaskTests(SimpleTestCase):
    @patch.object(
        ReviewModerationRetryService,
        "retry",
        return_value="provider_failure",
    )
    def test_provider_failure_dispatches_from_persisted_state(
        self,
        service,
    ):
        with patch.object(ReviewModerationRetryService, "dispatch") as dispatch:
            outcome = retry_failed_review_moderation.run(42, expected_attempt=2)

        self.assertEqual(outcome, "provider_failure")
        service.assert_called_once_with(review_id=42, expected_attempt=2)
        dispatch.assert_called_once_with(42)

    @patch.object(
        ReviewModerationRetryService,
        "retry",
        return_value="exhausted",
    )
    def test_exhaustion_does_not_request_another_retry(
        self,
        service,
    ):
        with patch.object(ReviewModerationRetryService, "dispatch") as dispatch:
            outcome = retry_failed_review_moderation.run(42)

        self.assertEqual(outcome, "exhausted")
        service.assert_called_once_with(
            review_id=42,
            expected_attempt=None,
        )
        dispatch.assert_not_called()

    @patch.object(
        ReviewModerationRetryService,
        "retry",
        return_value="flagged",
    )
    def test_flagged_result_stops_task_retries(
        self,
        service,
    ):
        with patch.object(ReviewModerationRetryService, "dispatch") as dispatch:
            outcome = retry_failed_review_moderation.run(42)

        self.assertEqual(outcome, "flagged")
        service.assert_called_once()
        dispatch.assert_not_called()
