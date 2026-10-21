from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.db import transaction
from django.test import TestCase
from rest_framework.exceptions import ValidationError

from apps.business.models import Business, Category, Cluster, Location
from apps.notifications.models import Notification
from apps.notifications.services.notification_event_service import (
    NotificationEventService,
)
from apps.notifications.tests.fixtures import NotificationFixtures
from apps.reviews.models import Review
from apps.reviews.services.review_service import ReviewService
from apps.users.models import User


class BusinessReviewNotificationFixtures(NotificationFixtures):
    """Provide one business owner and an independent public review author."""

    def setUp(self):
        """Create the business and isolate publication from external providers."""
        super().setUp()
        self.other.USER_ROLE = User.UserRole.MERCHANT
        self.other.save(update_fields=["USER_ROLE"])
        cluster = Cluster.objects.create(CLUS_NAME="Food")
        category = Category.objects.create(
            CTGRY_NAME="Cafe",
            CLUS_ID=cluster,
        )
        location = Location.objects.create(
            LOCT_POINT=Point(123.88, 10.31, srid=4326),
            LOCT_ADDRESS="Cebu City",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        self.business = Business.objects.create(
            BUSN_NAME="Merchant cafe",
            USER_ID=self.other,
            CTGRY_ID=category,
            LOCT_ID=location,
        )
        for method in (
            "_queue_sentiment_after_commit",
            "_queue_review_insights_after_commit",
        ):
            patcher = patch.object(ReviewService, method)
            patcher.start()
            self.addCleanup(patcher.stop)
        reward = patch(
            "apps.reviews.services.review_service.ReputationService.apply_review_reward",
        )
        reward.start()
        self.addCleanup(reward.stop)

    def create_review(
        self,
        status=Review.ReviewStatus.PUBLISHED,
    ):
        """Persist a review without running publication effects."""
        return Review.objects.create(
            BUSN_ID=self.business,
            USER_ID=self.user,
            REVW_TEXT="Friendly staff and a welcoming place to visit.",
            REVW_STATUS=status,
        )


class BusinessReviewNotificationTests(BusinessReviewNotificationFixtures, TestCase):
    """Cover first publication, moderation, deduplication, and atomicity."""

    def test_immediate_publication_notifies_only_owner_with_public_name(self):
        with patch(
            "apps.reviews.services.review_service.ReviewModerationService.moderate",
            return_value={
                "outcome": "safe",
                "checked_at": "2026-10-20T00:00:00+00:00",
                "failure_type": None,
                "findings": [],
            },
        ):
            review = ReviewService.create_review(
                user=self.user,
                business_id=self.business.pk,
                text="Friendly staff and a welcoming place to visit.",
            )
        notification = Notification.objects.get()
        self.assertIsNotNone(review.REVW_PUBLISHED_AT)
        self.assertEqual(notification.USER_ID_id, self.other.pk)
        self.assertEqual(notification.NOTF_TYPE, "business_review_received")
        self.assertEqual(notification.NOTF_TITLE, "New review received")
        self.assertEqual(
            notification.NOTF_BODY,
            f"{self.user.full_name} left a review. See what they shared and reply.",
        )
        self.assertEqual(notification.NOTF_TARGET_TYPE, "business_review")
        self.assertEqual(notification.NOTF_TARGET_ID, review.pk)
        self.assertNotIn(self.user.USER_EMAIL, notification.NOTF_BODY)
        self.assertNotIn(self.business.BUSN_NAME, notification.NOTF_BODY)

    def test_held_review_notifies_only_once_after_publication(self):
        review = self.create_review(Review.ReviewStatus.UNDER_REVIEW)
        NotificationEventService.business_review_received(review)
        self.assertFalse(Notification.objects.exists())
        ReviewService.publish_under_review(review.pk)
        review.refresh_from_db()
        self.assertIsNotNone(review.REVW_PUBLISHED_AT)
        published_at = review.REVW_PUBLISHED_AT
        NotificationEventService.business_review_received(review)
        self.assertEqual(Notification.objects.count(), 1)
        with self.assertRaises(ValidationError):
            ReviewService.publish_under_review(review.pk)
        review.refresh_from_db()
        self.assertEqual(review.REVW_PUBLISHED_AT, published_at)
        self.assertEqual(Notification.objects.count(), 1)

    def test_rejected_review_does_not_notify_owner(self):
        review = self.create_review(Review.ReviewStatus.UNDER_REVIEW)
        ReviewService.reject_under_review(review.pk)
        review.refresh_from_db()
        NotificationEventService.business_review_received(review)
        self.assertFalse(Notification.objects.exists())

    def test_editing_a_published_review_does_not_send_another_notification(self):
        review = self.create_review()
        NotificationEventService.business_review_received(review)
        with patch(
            "apps.reviews.services.review_service.ReviewModerationService.moderate",
            return_value={
                "outcome": "safe",
                "findings": [],
                "checked_at": "2026-10-20T00:00:00+00:00",
            },
        ):
            ReviewService.update_review(
                user=self.user,
                review_id=review.pk,
                text="Updated review describing the friendly staff and helpful service.",
            )
        self.assertEqual(Notification.objects.count(), 1)

    def test_blank_public_name_uses_explorer_fallback(self):
        self.user.USER_FNAME = " "
        self.user.USER_LNAME = " "
        self.user.save(update_fields=["USER_FNAME", "USER_LNAME"])
        NotificationEventService.business_review_received(self.create_review())
        self.assertEqual(
            Notification.objects.get().NOTF_BODY,
            "An explorer left a review. See what they shared and reply.",
        )

    def test_rolled_back_publication_does_not_leave_a_notification(self):
        review = self.create_review(Review.ReviewStatus.UNDER_REVIEW)
        with self.assertRaises(RuntimeError):
            with transaction.atomic():
                ReviewService.publish_under_review(review.pk)
                raise RuntimeError("Rollback")
        review.refresh_from_db()
        self.assertEqual(review.REVW_STATUS, Review.ReviewStatus.UNDER_REVIEW)
        self.assertFalse(Notification.objects.exists())
