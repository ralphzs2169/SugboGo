from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, BrokenBarrierError
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.db import OperationalError, close_old_connections, connection
from django.test import TransactionTestCase

from apps.business.models import Business, Category, Cluster, Location
from apps.reviews.models import Review
from apps.reviews.services.review_service import ReviewService
from apps.users.models import User


class ReviewReliabilityConcurrencyTests(TransactionTestCase):
    """Exercise reliability counts across independent PostgreSQL transactions."""

    def setUp(self):
        if connection.vendor != "postgresql":
            self.skipTest("PostgreSQL is required for the concurrency test.")

        self.cluster = Cluster.objects.create(
            CLUS_NAME="Concurrency cluster",
            CLUS_DESCRIPTION="Reliability test cluster",
        )
        self.category = Category.objects.create(
            CTGRY_NAME="Concurrency category",
            CTGRY_DESCRIPTION="Reliability test category",
            CLUS_ID=self.cluster,
        )
        self.next_user_number = 0
        self.next_business_number = 0

    def create_user(self):
        """Create an active account with a unique email."""
        self.next_user_number += 1
        return User.objects.create_user(
            email=f"reliability-concurrent-{self.next_user_number}@example.com",
            password=None,
            USER_FNAME="Concurrent",
            USER_LNAME="Reviewer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

    def create_business(self):
        """Create an eligible business owned by another account."""
        self.next_business_number += 1
        owner = self.create_user()
        location = Location.objects.create(
            LOCT_POINT=Point(123.8854, 10.3157, srid=4326),
            LOCT_ADDRESS="Reliability Street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        return Business.objects.create(
            BUSN_NAME=f"Concurrency business {self.next_business_number}",
            BUSN_DESCRIPTION="Business for review reliability concurrency tests.",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=owner,
            CTGRY_ID=self.category,
            LOCT_ID=location,
        )

    def create_prior_review(
        self,
        user,
        business,
        installation_id,
        text,
    ):
        """Persist eligible history without invoking the service under test."""
        return Review.objects.create(
            USER_ID=user,
            BUSN_ID=business,
            REVW_TEXT=text,
            REVW_INSTALLATION_ID=installation_id,
            REVW_STATUS=Review.ReviewStatus.PUBLISHED,
        )

    def create_concurrently(self, submissions):
        """Hold completed checks until both transactions reach the same boundary."""
        start_barrier = Barrier(2, timeout=10)
        barrier = Barrier(2, timeout=5)
        original_check = ReviewService._reliability_reasons

        def synchronized_check(review):
            result = original_check(review)
            try:
                barrier.wait()
            except BrokenBarrierError:
                # A serialized second request cannot reach detection until
                # the first transaction commits and releases its lock.
                pass
            return result

        def submit(
            user_id,
            business_id,
            text,
            installation_id,
        ):
            close_old_connections()
            try:
                user = User.objects.get(pk=user_id)
                start_barrier.wait()
                return ReviewService.create_review(
                    user=user,
                    business_id=business_id,
                    text=text,
                    installation_id=installation_id,
                ).pk
            finally:
                connection.close()

        moderation_result = {
            "outcome": "safe",
            "model": "omni-moderation-latest",
            "checked_at": "2026-10-14T00:00:00+00:00",
            "failure_type": None,
            "image_count": 0,
            "findings": [],
        }
        with (
            patch.object(
                ReviewService,
                "_reliability_reasons",
                side_effect=synchronized_check,
            ),
            patch(
                "apps.reviews.services.review_service.ReviewModerationService.moderate",
                return_value=moderation_result,
            ),
            patch.object(ReviewService, "_apply_published_effects"),
        ):
            with ThreadPoolExecutor(max_workers=2) as executor:
                futures = [
                    executor.submit(submit, *submission)
                    for submission in submissions
                ]
                review_ids = [
                    future.result(timeout=30)
                    for future in futures
                ]

        self.checks_overlapped = not barrier.broken
        return list(Review.objects.filter(pk__in=review_ids))

    def assert_checked(self, reviews):
        """Distinguish completed detection from swallowed worker failures."""
        self.assertEqual(len(reviews), 2)
        for review in reviews:
            self.assertEqual(
                review.REVW_RELIABILITY_CHECK_OUTCOME,
                Review.ReliabilityCheckOutcome.CHECKED,
            )
            self.assertEqual(
                review.REVW_STATUS,
                Review.ReviewStatus.UNDER_REVIEW,
            )

    def test_concurrent_rapid_submissions_detect_eleventh_review(self):
        installation_id = "rapid-concurrent-installation"
        author = self.create_user()
        for number in range(9):
            self.create_prior_review(
                author,
                self.create_business(),
                installation_id,
                f"Prior rapid review {number}",
            )

        reviews = self.create_concurrently([
            (
                self.create_user().pk,
                self.create_business().pk,
                "Concurrent rapid review one",
                installation_id,
            ),
            (
                self.create_user().pk,
                self.create_business().pk,
                "Concurrent rapid review two",
                installation_id,
            ),
        ])

        self.assert_checked(reviews)
        self.assertFalse(self.checks_overlapped)
        flagged = [
            review
            for review in reviews
            if Review.ReliabilityReason.RAPID_SUBMISSION
            in review.REVW_RELIABILITY_REASONS
        ]
        self.assertEqual(len(flagged), 1)
        self.assertEqual(
            flagged[0].REVW_RELIABILITY_EVIDENCE["rapid_submission"]["review_count"],
            11,
        )

    def test_concurrent_shared_accounts_detect_fourth_account(self):
        installation_id = "shared-concurrent-installation"
        business = self.create_business()
        for number in range(2):
            self.create_prior_review(
                self.create_user(),
                business,
                installation_id,
                f"Prior shared account review {number}",
            )

        reviews = self.create_concurrently([
            (
                self.create_user().pk,
                business.pk,
                "Concurrent shared account review one",
                installation_id,
            ),
            (
                self.create_user().pk,
                business.pk,
                "Concurrent shared account review two",
                installation_id,
            ),
        ])

        self.assert_checked(reviews)
        self.assertFalse(self.checks_overlapped)
        flagged = [
            review
            for review in reviews
            if Review.ReliabilityReason.SHARED_INSTALLATION_ACCOUNTS
            in review.REVW_RELIABILITY_REASONS
        ]
        self.assertEqual(len(flagged), 1)
        self.assertEqual(
            flagged[0].REVW_RELIABILITY_EVIDENCE[
                "shared_installation_accounts"
            ]["distinct_account_count"],
            4,
        )

    def test_concurrent_duplicate_content_detects_third_match(self):
        author = self.create_user()
        prior = self.create_prior_review(
            author,
            self.create_business(),
            None,
            "Same normalized review text",
        )

        reviews = self.create_concurrently([
            (
                author.pk,
                self.create_business().pk,
                " same  normalized   review text ",
                None,
            ),
            (
                author.pk,
                self.create_business().pk,
                "SAME NORMALIZED REVIEW TEXT",
                None,
            ),
        ])

        self.assert_checked(reviews)
        self.assertFalse(self.checks_overlapped)
        flagged = [
            review
            for review in reviews
            if Review.ReliabilityReason.DUPLICATE_CONTENT
            in review.REVW_RELIABILITY_REASONS
        ]
        self.assertEqual(len(flagged), 1)
        self.assertIn(
            prior.pk,
            flagged[0].REVW_RELIABILITY_EVIDENCE[
                "duplicate_content"
            ]["matched_review_ids"],
        )

    def test_unrelated_authors_and_installations_can_check_concurrently(self):
        reviews = self.create_concurrently([
            (
                self.create_user().pk,
                self.create_business().pk,
                "Independent review one",
                "independent-installation-one",
            ),
            (
                self.create_user().pk,
                self.create_business().pk,
                "Independent review two",
                "independent-installation-two",
            ),
        ])

        self.assert_checked(reviews)
        self.assertTrue(self.checks_overlapped)
        for review in reviews:
            self.assertEqual(review.REVW_RELIABILITY_REASONS, [])

    def test_creation_lock_failure_does_not_persist_a_clean_review(self):
        author = self.create_user()
        business = self.create_business()
        moderation_result = {
            "outcome": "safe",
            "model": "omni-moderation-latest",
            "checked_at": "2026-10-14T00:00:00+00:00",
            "failure_type": None,
            "image_count": 0,
            "findings": [],
        }

        with (
            patch(
                "apps.reviews.services.review_service.ReviewModerationService.moderate",
                return_value=moderation_result,
            ),
            patch.object(
                ReviewService,
                "_lock_reliability_creation_keys",
                side_effect=OperationalError("Advisory lock unavailable"),
            ),
            self.assertRaises(OperationalError),
        ):
            ReviewService.create_review(
                user=author,
                business_id=business.pk,
                text="Review with failed lock acquisition",
                installation_id="lock-failure-installation",
            )

        self.assertFalse(Review.objects.filter(USER_ID=author).exists())
