"""PostgreSQL regression coverage for moderation results racing with edits."""

from concurrent.futures import ThreadPoolExecutor
from threading import Event
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.db import connection, connections
from django.test import TransactionTestCase

from apps.admin_operations.system_configuration.models import AnalyticsPolicyConfiguration
from apps.business.models import Business, Category, Cluster, Location
from apps.reviews.models import Review
from apps.reviews.services.review_service import ReviewEditConflict, ReviewService
from apps.users.models import User


class ReviewEditConcurrencyTests(TransactionTestCase):
    def setUp(self):
        if connection.vendor != "postgresql":
            self.skipTest("This test requires PostgreSQL transaction visibility.")

        AnalyticsPolicyConfiguration.objects.get_or_create(pk=1)
        self.user = User.objects.create_user(
            email="concurrent-review-author@example.com",
            password="StrongPassword123!",
            USER_FNAME="Review",
            USER_LNAME="Author",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        owner = User.objects.create_user(
            email="concurrent-business-owner@example.com",
            password="StrongPassword123!",
            USER_FNAME="Business",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
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
            BUSN_NAME="Concurrency Bistro",
            BUSN_DESCRIPTION="A Cebu-based local restaurant.",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=owner,
            CTGRY_ID=category,
            LOCT_ID=location,
        )
        self.review = Review.objects.create(
            USER_ID=self.user,
            BUSN_ID=business,
            REVW_TEXT="Original published review.",
            REVW_STATUS=Review.ReviewStatus.PUBLISHED,
        )

    def test_older_moderation_result_cannot_overwrite_newer_accepted_edit(self):
        entered_moderation = Event()
        release_moderation = Event()

        def moderate(*, text, photos, image_urls):
            if text == "Older proposed edit.":
                entered_moderation.set()
                if not release_moderation.wait(10):
                    raise TimeoutError("The edit synchronization timed out.")
            return {
                "outcome": "safe",
                "checked_at": "2026-10-11T00:00:00+00:00",
                "findings": [],
            }

        def submit_older_edit():
            try:
                ReviewService.update_review(
                    user=self.user,
                    review_id=self.review.pk,
                    text="Older proposed edit.",
                )
            finally:
                connections.close_all()

        with (
            patch(
                "apps.reviews.services.review_service.ReviewModerationService.moderate",
                side_effect=moderate,
            ),
            patch.object(ReviewService, "_queue_sentiment_after_commit"),
            patch(
                "apps.reviews.services.review_service.BusinessReviewSummaryService.recompute_sentiment",
            ),
            patch(
                "apps.reviews.services.review_service.ReviewKeywordService.remove_review_evidence",
            ),
            ThreadPoolExecutor(max_workers=1) as executor,
        ):
            older_edit = executor.submit(submit_older_edit)
            try:
                self.assertTrue(entered_moderation.wait(10))
                ReviewService.update_review(
                    user=self.user,
                    review_id=self.review.pk,
                    text="Newer accepted edit.",
                )
            finally:
                release_moderation.set()

            with self.assertRaises(ReviewEditConflict):
                older_edit.result(timeout=10)

        self.review.refresh_from_db()
        self.assertEqual(self.review.REVW_TEXT, "Newer accepted edit.")
        self.assertEqual(self.review.REVW_STATUS, Review.ReviewStatus.PUBLISHED)
