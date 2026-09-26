from datetime import timedelta
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import NotFound

from apps.business.models import Business, Category, Cluster, Location
from apps.reviews.models import BusinessReviewSummary, Review
from apps.reviews.services.business_review_summary_service import (
    BusinessReviewSummaryService,
)
from apps.users.models import User


class SummaryFixtureMixin:
    """Creates minimal independent businesses and reviews for summary tests."""

    @staticmethod
    def create_business(index=0):
        owner = User.objects.create_user(
            email=f"summary-owner-{index}@example.com",
            password=None,
            USER_FNAME="Summary",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        cluster = Cluster.objects.create(CLUS_NAME=f"Summary cluster {index}")
        category = Category.objects.create(
            CTGRY_NAME=f"Summary category {index}",
            CLUS_ID=cluster,
        )
        location = Location.objects.create(
            LOCT_POINT=Point(123.8854, 10.3157, srid=4326),
            LOCT_ADDRESS="Gorordo Avenue",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        return Business.objects.create(
            BUSN_NAME=f"Summary business {index}",
            BUSN_CONTACT_NUMBER="09171234567",
            USER_ID=owner,
            CTGRY_ID=category,
            LOCT_ID=location,
        )

    @staticmethod
    def create_review(business, index=0, **overrides):
        author = User.objects.create_user(
            email=f"summary-author-{business.pk}-{index}@example.com",
            password=None,
            USER_FNAME="Summary",
            USER_LNAME="Author",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        values = {
            "BUSN_ID": business,
            "USER_ID": author,
            "REVW_TEXT": "Friendly service.",
            "REVW_SENTIMENT_LABEL": "positive",
        }
        values.update(overrides)
        return Review.objects.create(**values)


class BusinessReviewSummaryServiceTests(SummaryFixtureMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.business = cls.create_business()

    def test_counts_and_percentages_use_classified_denominator(self):
        for index, label in enumerate([
            "positive", "positive", "neutral", "negative", None, "", "unknown",
        ]):
            self.create_review(self.business, index, REVW_SENTIMENT_LABEL=label)
        summary = BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        self.assertEqual(summary.BRSU_REVIEW_COUNT, 7)
        self.assertEqual(summary.BRSU_CLASSIFIED_REVIEW_COUNT, 4)
        self.assertEqual(summary.BRSU_POSITIVE_COUNT, 2)
        self.assertEqual(summary.BRSU_NEUTRAL_COUNT, 1)
        self.assertEqual(summary.BRSU_NEGATIVE_COUNT, 1)
        self.assertEqual(summary.sentiment_percentages, {
            "positive": 50.0, "neutral": 25.0, "negative": 25.0,
        })

    def test_sentiment_uses_the_same_rolling_thirty_day_window(self):
        reference_time = timezone.now()
        boundary = self.create_review(self.business, 100)
        expired = self.create_review(self.business, 101)
        Review.objects.filter(pk=boundary.pk).update(
            REVW_CREATED_AT=reference_time - timedelta(days=30),
        )
        Review.objects.filter(pk=expired.pk).update(
            REVW_CREATED_AT=reference_time - timedelta(days=30, seconds=1),
        )

        summary = BusinessReviewSummaryService.recompute_sentiment(
            self.business.pk,
            reference_time=reference_time,
        )

        self.assertEqual(summary.BRSU_REVIEW_COUNT, 1)
        self.assertEqual(summary.BRSU_POSITIVE_COUNT, 1)

    def test_each_moderation_exclusion_leaves_only_clean_review(self):
        self.create_review(self.business)
        exclusions = [
            {"REVW_STATUS": Review.ReviewStatus.REJECTED},
            {"REVW_STATUS": Review.ReviewStatus.FLAGGED},
            {"REVW_IS_SPAM_FLAGGED": True},
            {"REVW_IS_DEVICE_ABUSE_FLAGGED": True},
        ]
        for index, values in enumerate(exclusions, start=1):
            with self.subTest(values=values):
                excluded = self.create_review(
                    self.business, index, REVW_SENTIMENT_LABEL="negative", **values,
                )
                summary = BusinessReviewSummaryService.recompute_sentiment(
                    self.business.pk,
                )
                self.assertEqual(summary.BRSU_REVIEW_COUNT, 1)
                self.assertEqual(summary.BRSU_POSITIVE_COUNT, 1)
                self.assertEqual(summary.BRSU_NEGATIVE_COUNT, 0)
                excluded.delete()

    def test_outlier_is_included(self):
        self.create_review(self.business, REVW_IS_OUTLIER_SENTIMENT=True)
        summary = BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        self.assertEqual(summary.BRSU_POSITIVE_COUNT, 1)

    def test_other_business_reviews_are_not_counted(self):
        self.create_review(self.create_business(1))
        summary = BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        self.assertEqual(summary.BRSU_REVIEW_COUNT, 0)

    def test_empty_business_has_zero_percentages_and_computation_timestamp(self):
        before = timezone.now()
        summary = BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        self.assertEqual(summary.BRSU_REVIEW_COUNT, 0)
        self.assertEqual(summary.BRSU_CLASSIFIED_REVIEW_COUNT, 0)
        self.assertEqual(summary.sentiment_percentages, {
            "positive": 0.0, "neutral": 0.0, "negative": 0.0,
        })
        self.assertGreaterEqual(summary.BRSU_SENTIMENT_COMPUTED_AT, before)
        self.assertIsNone(summary.BRSU_KEYWORDS_PROCESSED_AT)

    def test_unclassified_only_business_has_zero_percentages(self):
        self.create_review(self.business, REVW_SENTIMENT_LABEL=None)
        summary = BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        self.assertEqual(summary.BRSU_REVIEW_COUNT, 1)
        self.assertEqual(summary.BRSU_CLASSIFIED_REVIEW_COUNT, 0)
        self.assertTrue(all(value == 0 for value in summary.sentiment_percentages.values()))

    def test_recomputation_reflects_moderation_without_updated_timestamp(self):
        review = self.create_review(self.business)
        summary = BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        for values in [
            {"REVW_STATUS": Review.ReviewStatus.REJECTED},
            {"REVW_IS_SPAM_FLAGGED": True},
            {"REVW_IS_DEVICE_ABUSE_FLAGGED": True},
        ]:
            with self.subTest(values=values):
                Review.objects.filter(pk=review.pk).update(
                    REVW_STATUS=Review.ReviewStatus.PUBLISHED,
                    REVW_IS_SPAM_FLAGGED=False,
                    REVW_IS_DEVICE_ABUSE_FLAGGED=False,
                )
                Review.objects.filter(pk=review.pk).update(**values)
                updated = BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
                self.assertEqual(updated.pk, summary.pk)
                self.assertEqual(updated.BRSU_REVIEW_COUNT, 0)
                self.assertEqual(updated.BRSU_POSITIVE_COUNT, 0)

    def test_recomputation_reflects_label_edits_and_deletion(self):
        review = self.create_review(self.business)
        BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        Review.objects.filter(pk=review.pk).update(REVW_SENTIMENT_LABEL="negative")
        summary = BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        self.assertEqual(summary.BRSU_POSITIVE_COUNT, 0)
        self.assertEqual(summary.BRSU_NEGATIVE_COUNT, 1)
        review.delete()
        summary = BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        self.assertEqual(summary.BRSU_REVIEW_COUNT, 0)

    def test_round_trip_and_recompute_preserve_keyword_state(self):
        processed_at = timezone.now()
        tags = [{"text": "friendly service", "count": 2}]
        stored = BusinessReviewSummary.objects.create(
            BUSN_ID=self.business,
            BRSU_KEYWORD_TAGS=tags,
            BRSU_KEYWORDS_PROCESSED_AT=processed_at,
        )
        self.create_review(self.business)
        BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        fetched = BusinessReviewSummaryService.get_summary(self.business.pk)
        self.assertEqual(fetched.pk, stored.pk)
        self.assertEqual(fetched.BRSU_KEYWORD_TAGS, tags)
        self.assertEqual(fetched.BRSU_KEYWORDS_PROCESSED_AT, processed_at)
        self.assertEqual(fetched.BRSU_POSITIVE_COUNT, 1)

    def test_missing_summary_returns_not_found_without_creating(self):
        with self.assertRaises(NotFound):
            BusinessReviewSummaryService.get_summary(self.business.pk)
        self.assertFalse(BusinessReviewSummary.objects.exists())

    def test_nonexistent_business_returns_not_found(self):
        with self.assertRaises(NotFound):
            BusinessReviewSummaryService.recompute_sentiment(-1)
        self.assertFalse(BusinessReviewSummary.objects.exists())

    def test_database_rejects_duplicate_business_summary(self):
        BusinessReviewSummary.objects.create(BUSN_ID=self.business)
        with self.assertRaises(IntegrityError), transaction.atomic():
            BusinessReviewSummary.objects.create(BUSN_ID=self.business)

    def test_database_rejects_invalid_counts(self):
        invalid_values = [
            {"BRSU_POSITIVE_COUNT": -1},
            {"BRSU_NEUTRAL_COUNT": -1},
            {"BRSU_NEGATIVE_COUNT": -1},
            {"BRSU_REVIEW_COUNT": -1},
            {"BRSU_CLASSIFIED_REVIEW_COUNT": -1},
            {"BRSU_POSITIVE_COUNT": 1, "BRSU_REVIEW_COUNT": 1},
            {"BRSU_POSITIVE_COUNT": 1, "BRSU_CLASSIFIED_REVIEW_COUNT": 1},
        ]
        for values in invalid_values:
            with self.subTest(values=values):
                with self.assertRaises(IntegrityError), transaction.atomic():
                    BusinessReviewSummary.objects.create(BUSN_ID=self.business, **values)

    def test_business_deletion_cascades_to_summary(self):
        summary = BusinessReviewSummary.objects.create(BUSN_ID=self.business)
        self.business.delete()
        self.assertFalse(BusinessReviewSummary.objects.filter(pk=summary.pk).exists())

    def test_failed_initial_aggregation_rolls_back_summary_creation(self):
        with patch.object(
            BusinessReviewSummaryService, "eligible_reviews",
            side_effect=RuntimeError("aggregation failed"),
        ):
            with self.assertRaises(RuntimeError):
                BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        self.assertFalse(BusinessReviewSummary.objects.exists())
