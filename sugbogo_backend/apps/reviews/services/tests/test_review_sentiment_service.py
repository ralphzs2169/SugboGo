from unittest.mock import patch

from django.test import TestCase

from apps.reviews.models import BusinessReviewSummary, Review
from apps.reviews.services.business_review_insights_service import (
    BusinessReviewInsightsService,
)
from apps.reviews.services.business_review_summary_service import (
    BusinessReviewSummaryService,
)
from apps.reviews.services.review_keyword_service import ReviewKeywordService
from apps.reviews.services.review_sentiment_service import ReviewSentimentService
from apps.reviews.services.review_summary_batch_service import ReviewSummaryBatchService
from apps.reviews.services.tests.test_business_review_summary_service import (
    SummaryFixtureMixin,
)


class ReviewSentimentServiceTests(SummaryFixtureMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.business = cls.create_business()

    def test_scores_review_and_recomputes_summary_without_keywords(self):
        review = self.create_review(
            self.business,
            REVW_SENTIMENT_SCORE=None,
            REVW_SENTIMENT_LABEL=None,
        )
        with (
            patch(
                "apps.reviews.services.review_sentiment_service.route_sentiment",
                return_value=(-0.6, "Negative", "vader"),
            ) as scorer,
            patch.object(ReviewKeywordService, "refresh") as keywords,
        ):
            outcome = ReviewSentimentService.process_review(review.pk)

        review.refresh_from_db()
        summary = BusinessReviewSummary.objects.get(BUSN_ID=self.business)
        self.assertEqual(outcome, "updated")
        scorer.assert_called_once_with(review.REVW_TEXT)
        keywords.assert_not_called()
        self.assertEqual(review.REVW_SENTIMENT_SCORE, -0.6)
        self.assertEqual(review.REVW_SENTIMENT_LABEL, "negative")
        self.assertEqual(summary.BRSU_REVIEW_COUNT, 1)
        self.assertEqual(summary.BRSU_NEGATIVE_COUNT, 1)

    def test_missing_review_exits_without_scoring(self):
        with patch(
            "apps.reviews.services.review_sentiment_service.route_sentiment",
        ) as scorer:
            outcome = ReviewSentimentService.process_review(-1)

        self.assertEqual(outcome, "missing")
        scorer.assert_not_called()

    def test_deletion_during_inference_exits_cleanly(self):
        review = self.create_review(
            self.business,
            REVW_SENTIMENT_SCORE=None,
            REVW_SENTIMENT_LABEL=None,
        )

        def delete_during_scoring(text):
            review.delete()
            return 0.5, "Positive", "vader"

        with patch(
            "apps.reviews.services.review_sentiment_service.route_sentiment",
            side_effect=delete_during_scoring,
        ):
            outcome = ReviewSentimentService.process_review(review.pk)

        self.assertEqual(outcome, "missing")
        self.assertFalse(BusinessReviewSummary.objects.exists())

    def test_text_edit_during_inference_discards_stale_result(self):
        review = self.create_review(
            self.business,
            REVW_SENTIMENT_SCORE=None,
            REVW_SENTIMENT_LABEL=None,
        )

        def edit_during_scoring(text):
            Review.objects.filter(pk=review.pk).update(REVW_TEXT="Edited review.")
            return 0.5, "Positive", "vader"

        with patch(
            "apps.reviews.services.review_sentiment_service.route_sentiment",
            side_effect=edit_during_scoring,
        ):
            outcome = ReviewSentimentService.process_review(review.pk)

        review.refresh_from_db()
        self.assertEqual(outcome, "stale")
        self.assertEqual(review.REVW_TEXT, "Edited review.")
        self.assertIsNone(review.REVW_SENTIMENT_SCORE)
        self.assertIsNone(review.REVW_SENTIMENT_LABEL)
        self.assertFalse(BusinessReviewSummary.objects.exists())

    def test_inference_failure_leaves_sentiment_pending(self):
        review = self.create_review(
            self.business,
            REVW_SENTIMENT_SCORE=None,
            REVW_SENTIMENT_LABEL=None,
        )
        with patch(
            "apps.reviews.services.review_sentiment_service.route_sentiment",
            side_effect=RuntimeError("model unavailable"),
        ):
            with self.assertRaises(RuntimeError):
                ReviewSentimentService.process_review(review.pk)

        review.refresh_from_db()
        self.assertIsNone(review.REVW_SENTIMENT_SCORE)
        self.assertIsNone(review.REVW_SENTIMENT_LABEL)

    def test_reconciliation_isolates_failure_and_skips_complete_reviews(self):
        failed = self.create_review(
            self.business,
            1,
            REVW_TEXT="Failed review.",
            REVW_SENTIMENT_SCORE=None,
            REVW_SENTIMENT_LABEL=None,
        )
        recovered = self.create_review(
            self.business,
            2,
            REVW_TEXT="Recoverable review.",
            REVW_SENTIMENT_SCORE=None,
            REVW_SENTIMENT_LABEL=None,
        )
        self.create_review(self.business, 3)

        def score(text):
            if text == failed.REVW_TEXT:
                raise RuntimeError("model unavailable")
            return -0.6, "Negative", "vader"

        with patch(
            "apps.reviews.services.review_sentiment_service.route_sentiment",
            side_effect=score,
        ) as scorer:
            result = ReviewSentimentService.reconcile_business(self.business.pk)

        BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        summary = BusinessReviewSummary.objects.get(BUSN_ID=self.business)
        failed.refresh_from_db()
        recovered.refresh_from_db()
        self.assertEqual(result["attempted"], 2)
        self.assertEqual(result["updated"], 1)
        self.assertEqual(result["failed"], 1)
        self.assertEqual(scorer.call_count, 2)
        self.assertIsNone(failed.REVW_SENTIMENT_LABEL)
        self.assertEqual(recovered.REVW_SENTIMENT_LABEL, "negative")
        self.assertEqual(summary.BRSU_REVIEW_COUNT, 3)
        self.assertEqual(summary.BRSU_CLASSIFIED_REVIEW_COUNT, 2)
        self.assertEqual(summary.sentiment_percentages["positive"], 50.0)

    def test_manual_refresh_reconciles_before_aggregation(self):
        review = self.create_review(
            self.business,
            REVW_SENTIMENT_SCORE=None,
            REVW_SENTIMENT_LABEL=None,
        )
        with (
            patch(
                "apps.reviews.services.review_sentiment_service.route_sentiment",
                return_value=(0.5, "Positive", "vader"),
            ),
            patch.object(ReviewKeywordService, "refresh", return_value="unchanged"),
        ):
            result = BusinessReviewInsightsService.refresh(self.business.pk)

        summary = BusinessReviewSummary.objects.get(BUSN_ID=self.business)
        self.assertEqual(result["keyword_outcome"], "unchanged")
        self.assertEqual(summary.BRSU_POSITIVE_COUNT, 1)
        self.assertEqual(summary.BRSU_CLASSIFIED_REVIEW_COUNT, 1)
        review.refresh_from_db()
        self.assertEqual(review.REVW_SENTIMENT_LABEL, "positive")

    def test_daily_batch_uses_same_reconciliation_path(self):
        review = self.create_review(
            self.business,
            REVW_SENTIMENT_SCORE=None,
            REVW_SENTIMENT_LABEL=None,
        )
        with (
            patch(
                "apps.reviews.services.review_sentiment_service.route_sentiment",
                return_value=(0.5, "Positive", "vader"),
            ),
            patch.object(ReviewKeywordService, "refresh", return_value="unchanged"),
        ):
            result = ReviewSummaryBatchService.recompute()

        self.assertEqual(result["sentiment_updated"], 1)
        self.assertEqual(result["failed_business_ids"], [])
        review.refresh_from_db()
        self.assertEqual(review.REVW_SENTIMENT_LABEL, "positive")
        summary = BusinessReviewSummary.objects.get(BUSN_ID=self.business)
        self.assertEqual(summary.BRSU_POSITIVE_COUNT, 1)

    def test_failed_review_does_not_block_another_business(self):
        other_business = self.create_business(2)
        self.create_review(
            self.business,
            1,
            REVW_TEXT="Failed review.",
            REVW_SENTIMENT_SCORE=None,
            REVW_SENTIMENT_LABEL=None,
        )
        recovered = self.create_review(
            other_business,
            1,
            REVW_TEXT="Recoverable review.",
            REVW_SENTIMENT_SCORE=None,
            REVW_SENTIMENT_LABEL=None,
        )

        def score(text):
            if text == "Failed review.":
                raise RuntimeError("model unavailable")
            return 0.5, "Positive", "vader"

        with (
            patch(
                "apps.reviews.services.review_sentiment_service.route_sentiment",
                side_effect=score,
            ),
            patch.object(ReviewKeywordService, "refresh", return_value="unchanged"),
        ):
            result = ReviewSummaryBatchService.recompute()

        self.assertEqual(result["sentiment_updated"], 2)
        self.assertEqual(result["failed_business_ids"], [])
        self.assertEqual(
            BusinessReviewSummary.objects.get(BUSN_ID=self.business).BRSU_REVIEW_COUNT,
            1,
        )
        recovered.refresh_from_db()
        self.assertEqual(recovered.REVW_SENTIMENT_LABEL, "positive")
