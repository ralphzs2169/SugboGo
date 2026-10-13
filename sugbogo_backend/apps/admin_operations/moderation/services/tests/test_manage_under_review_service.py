"""Focused service coverage for direct held-review decisions."""

from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.test import TestCase
from rest_framework.exceptions import ValidationError

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.moderation.services.manage_under_review_service import (
    ManageUnderReviewService,
)
from apps.business.models import Business, Category, Cluster, Location
from apps.reviews.models import Review
from apps.reviews.services.review_service import ReviewService
from apps.users.models import User


def create_under_review_context():
    """Create the minimum account and business records for queue tests."""
    owner = User.objects.create(
        USER_EMAIL="queue-owner@example.com",
        USER_FNAME="Business",
        USER_LNAME="Owner",
        USER_ROLE=User.UserRole.MERCHANT,
        USER_STATUS=User.UserStatus.ACTIVE,
        password="!",
    )
    author = User.objects.create(
        USER_EMAIL="queue-author@example.com",
        USER_FNAME="Review",
        USER_LNAME="Author",
        USER_ROLE=User.UserRole.EXPLORER,
        USER_STATUS=User.UserStatus.ACTIVE,
        password="!",
    )
    cluster = Cluster.objects.create(
        CLUS_NAME="Food and Dining",
        CLUS_DESCRIPTION="Food businesses",
    )
    category = Category.objects.create(
        CTGRY_NAME="Restaurants",
        CTGRY_DESCRIPTION="Places that serve meals",
        CLUS_ID=cluster,
    )
    location = Location.objects.create(
        LOCT_POINT=Point(123.8854, 10.3157, srid=4326),
        LOCT_ADDRESS="Gorordo Avenue",
        LOCT_CITY="Cebu City",
        LOCT_PROVINCE="Cebu",
    )
    business = Business.objects.create(
        BUSN_NAME="Sugbo Bistro",
        BUSN_DESCRIPTION="A Cebu-based local restaurant.",
        BUSN_STATUS=Business.BusinessStatus.ACTIVE,
        USER_ID=owner,
        CTGRY_ID=category,
        LOCT_ID=location,
    )
    return owner, author, business


class ManageUnderReviewServiceTests(TestCase):
    """Ensure Admin actions reuse the canonical review lifecycle once."""

    @classmethod
    def setUpTestData(cls):
        """Create an existing business, review author, and administrator."""
        cls.owner, cls.author, cls.business = create_under_review_context()
        cls.admin = User.objects.create(
            USER_EMAIL="under-review-admin@example.com",
            USER_FNAME="Admin",
            USER_LNAME="Moderator",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
            password="!",
        )

    def setUp(self):
        """Create one held review for each isolated decision test."""
        self.review = Review.objects.create(
            USER_ID=self.author,
            BUSN_ID=self.business,
            REVW_TEXT="A held review awaiting an administrator decision.",
            REVW_STATUS=Review.ReviewStatus.UNDER_REVIEW,
        )

    def test_approval_uses_canonical_transition_and_records_action_once(self):
        """Publication side effects and audit happen only for the first decision."""
        with (
            patch.object(
                ReviewService,
                "_queue_sentiment_after_commit",
            ) as sentiment,
            patch.object(
                ReviewService,
                "_queue_review_insights_after_commit",
            ) as insights,
            patch.object(
                ReviewService,
                "publish_under_review",
                wraps=ReviewService.publish_under_review,
            ) as publish,
        ):
            ManageUnderReviewService.resolve(
                self.review.pk,
                actor=self.admin,
                approve=True,
            )
            with self.assertRaises(ValidationError):
                ManageUnderReviewService.resolve(
                    self.review.pk,
                    actor=self.admin,
                    approve=True,
                )

        publish.assert_called_once_with(self.review.pk)
        sentiment.assert_called_once_with(self.review.pk, self.business.pk)
        insights.assert_called_once_with(self.business.pk)
        self.review.refresh_from_db()
        self.business.refresh_from_db()
        self.assertEqual(self.review.REVW_STATUS, Review.ReviewStatus.PUBLISHED)
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, 1)
        activity = AdminActivity.objects.get()
        self.assertEqual(
            activity.AACT_ACTION,
            AdminActivity.Action.REVIEW_MODERATION_APPROVED,
        )
        self.assertEqual(activity.TARGET_USER_ID, self.author)
        self.assertEqual(activity.AACT_CONTEXT["review_id"], self.review.pk)

    def test_rejection_preserves_count_and_records_action_once(self):
        """A never-published review cannot decrement the public count."""
        with patch.object(
            ReviewService,
            "reject_under_review",
            wraps=ReviewService.reject_under_review,
        ) as reject:
            ManageUnderReviewService.resolve(
                self.review.pk,
                actor=self.admin,
                approve=False,
            )
            with self.assertRaises(ValidationError):
                ManageUnderReviewService.resolve(
                    self.review.pk,
                    actor=self.admin,
                    approve=False,
                )

        reject.assert_called_once_with(self.review.pk)
        self.review.refresh_from_db()
        self.business.refresh_from_db()
        self.assertEqual(self.review.REVW_STATUS, Review.ReviewStatus.REJECTED)
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, 0)
        self.assertEqual(
            AdminActivity.objects.get().AACT_ACTION,
            AdminActivity.Action.REVIEW_MODERATION_REJECTED,
        )

    def test_stale_opposite_decision_is_rejected(self):
        """An Admin cannot reject content another Admin already published."""
        with (
            patch.object(ReviewService, "_queue_sentiment_after_commit"),
            patch.object(ReviewService, "_queue_review_insights_after_commit"),
        ):
            ManageUnderReviewService.resolve(
                self.review.pk,
                actor=self.admin,
                approve=True,
            )
        with self.assertRaises(ValidationError):
            ManageUnderReviewService.resolve(
                self.review.pk,
                actor=self.admin,
                approve=False,
            )
        self.assertEqual(AdminActivity.objects.count(), 1)
