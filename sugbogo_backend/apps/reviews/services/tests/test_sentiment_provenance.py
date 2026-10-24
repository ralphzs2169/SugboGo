from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from apps.reviews.models import BusinessReviewSummary, Review
from apps.reviews.services.business_review_summary_service import (
    BusinessReviewSummaryService,
)
from apps.reviews.services.review_sentiment_service import ReviewSentimentService
from apps.reviews.services.tests.test_business_review_summary_service import (
    SummaryFixtureMixin,
)


class SentimentProvenanceTests(SummaryFixtureMixin, TestCase):
    """Verify exact aggregate membership independently of timestamps and counts."""

    @classmethod
    def setUpTestData(cls):
        cls.business = cls.create_business()

    def included(self, review):
        current = BusinessReviewSummaryService.annotate_sentiment_source(
            Review.objects.all(),
            review.USER_ID,
        ).get(pk=review.pk)
        with self.assertNumQueries(0):
            return BusinessReviewSummaryService.is_sentiment_included(current)

    def test_failed_aggregation_and_redelivery_do_not_repeat_inference(self):
        review = self.create_review(
            self.business,
            REVW_SENTIMENT_SCORE=None,
            REVW_SENTIMENT_LABEL=None,
        )
        original = BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        with patch(
            "apps.reviews.services.review_sentiment_service.route_sentiment",
            return_value=(0.7, "Positive", "vader"),
        ) as scorer:
            with patch.object(
                BusinessReviewSummaryService,
                "recompute_sentiment",
                side_effect=RuntimeError("aggregate unavailable"),
            ):
                with self.assertRaisesMessage(RuntimeError, "aggregate unavailable"):
                    ReviewSentimentService.process_review(review.pk)
            review.refresh_from_db()
            self.assertEqual(review.REVW_SENTIMENT_LABEL, "positive")
            self.assertFalse(self.included(review))
            original.refresh_from_db()
            self.assertEqual(original.BRSU_SENTIMENT_SOURCES, {})
            self.assertEqual(original.BRSU_CLASSIFIED_REVIEW_COUNT, 0)
            self.assertEqual(
                ReviewSentimentService.process_review(review.pk),
                "already_scored",
            )
            scorer.assert_called_once()
        self.assertTrue(self.included(review))

    def test_same_counts_and_newer_timestamp_do_not_verify_changed_sources(self):
        review = self.create_review(self.business)
        summary = BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        original_sources = summary.BRSU_SENTIMENT_SOURCES.copy()
        mutations = (
            {"REVW_TEXT": "A different review with the same sentiment."},
            {"REVW_SENTIMENT_SCORE": 0.9},
            {"REVW_SENTIMENT_LABEL": "neutral"},
            {"REVW_PUBLISHED_AT": timezone.now()},
        )
        for mutation in mutations:
            with self.subTest(mutation=mutation):
                Review.objects.filter(pk=review.pk).update(**mutation)
                BusinessReviewSummary.objects.filter(pk=summary.pk).update(
                    BRSU_SENTIMENT_COMPUTED_AT=timezone.now() + timedelta(days=1),
                )
                self.assertFalse(self.included(review))
                summary = BusinessReviewSummaryService.recompute_sentiment(
                    self.business.pk,
                )
                self.assertTrue(self.included(review))
                self.assertNotEqual(summary.BRSU_SENTIMENT_SOURCES, original_sources)
                original_sources = summary.BRSU_SENTIMENT_SOURCES.copy()

    def test_edit_clearing_classification_invalidates_membership(self):
        review = self.create_review(self.business)
        BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        Review.objects.filter(pk=review.pk).update(
            REVW_TEXT="Edited review awaiting a new classification.",
            REVW_SENTIMENT_LABEL=None,
            REVW_SENTIMENT_SCORE=None,
        )
        self.assertFalse(self.included(review))
        summary = BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        self.assertEqual(summary.BRSU_SENTIMENT_SOURCES, {})
        self.assertEqual(summary.BRSU_CLASSIFIED_REVIEW_COUNT, 0)

    def test_legacy_provenance_is_unverified_and_repaired_without_inference(self):
        review = self.create_review(self.business)
        BusinessReviewSummary.objects.create(
            BUSN_ID=self.business,
            BRSU_REVIEW_COUNT=1,
            BRSU_CLASSIFIED_REVIEW_COUNT=1,
            BRSU_POSITIVE_COUNT=1,
            BRSU_SENTIMENT_COMPUTED_AT=timezone.now(),
        )
        self.assertFalse(self.included(review))
        with patch(
            "apps.reviews.services.review_sentiment_service.route_sentiment",
        ) as scorer:
            ReviewSentimentService.process_review(review.pk)
        scorer.assert_not_called()
        self.assertTrue(self.included(review))

    def test_provenance_is_deterministic_and_ignores_unrelated_updates(self):
        review = self.create_review(self.business)
        first = BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        Review.objects.filter(pk=review.pk).update(
            REVW_LIKE_COUNT=2,
            REVW_EDITED_AT=timezone.now(),
            REVW_UPDATED_AT=timezone.now(),
        )
        self.assertTrue(self.included(review))
        second = BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        self.assertEqual(first.BRSU_SENTIMENT_SOURCES, second.BRSU_SENTIMENT_SOURCES)
        review.refresh_from_db()
        self.assertEqual(second.BRSU_SENTIMENT_SOURCES, {
            str(review.pk): BusinessReviewSummaryService.sentiment_source(review),
        })

    def test_rejection_publication_and_deletion_change_membership(self):
        review = self.create_review(self.business)
        BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        for status in (
            Review.ReviewStatus.REJECTED,
            Review.ReviewStatus.UNDER_REVIEW,
            Review.ReviewStatus.FLAGGED,
        ):
            with self.subTest(status=status):
                Review.objects.filter(pk=review.pk).update(REVW_STATUS=status)
                self.assertFalse(self.included(review))
        summary = BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        self.assertEqual(summary.BRSU_SENTIMENT_SOURCES, {})
        Review.objects.filter(pk=review.pk).update(
            REVW_STATUS=Review.ReviewStatus.PUBLISHED,
            REVW_PUBLISHED_AT=timezone.now(),
        )
        self.assertFalse(self.included(review))
        summary = BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        self.assertTrue(self.included(review))
        review.delete()
        summary = BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        self.assertEqual(summary.BRSU_SENTIMENT_SOURCES, {})
        self.assertEqual(summary.BRSU_REVIEW_COUNT, 0)

    def test_expired_reviews_and_incomplete_classifications_are_not_complete(self):
        review = self.create_review(self.business)
        BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        with patch(
            "apps.reviews.services.business_review_summary_service.timezone.now",
            return_value=timezone.now() + timedelta(days=31),
        ):
            self.assertFalse(self.included(review))
        Review.objects.filter(pk=review.pk).update(REVW_SENTIMENT_SCORE=None)
        summary = BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        # Preserve the existing label-based count contract for partial legacy rows.
        self.assertEqual(summary.BRSU_CLASSIFIED_REVIEW_COUNT, 1)
        self.assertFalse(self.included(review))

    def test_summary_save_failure_rolls_back_counts_and_provenance_together(self):
        review = self.create_review(self.business)
        original = BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        Review.objects.filter(pk=review.pk).update(
            REVW_SENTIMENT_SCORE=-0.6,
            REVW_SENTIMENT_LABEL="negative",
        )
        save = BusinessReviewSummary.save

        def fail_after_save(instance, *args, **kwargs):
            save(instance, *args, **kwargs)
            raise RuntimeError("commit failed")

        with patch.object(BusinessReviewSummary, "save", fail_after_save):
            with self.assertRaisesMessage(RuntimeError, "commit failed"):
                BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        stored = BusinessReviewSummary.objects.get(pk=original.pk)
        self.assertEqual(stored.BRSU_SENTIMENT_SOURCES, original.BRSU_SENTIMENT_SOURCES)
        self.assertEqual(stored.BRSU_POSITIVE_COUNT, 1)
        self.assertEqual(stored.BRSU_NEGATIVE_COUNT, 0)
        self.assertFalse(self.included(review))
