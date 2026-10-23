from unittest.mock import patch

from django.test import TestCase

from apps.reviews.services.review_insight_scheduling_service import ReviewInsightSchedulingService
from apps.reviews.services.review_sentiment_service import ReviewSentimentService
from apps.reviews.services.review_summary_batch_service import ReviewSummaryBatchService
from apps.reviews.services.tests.test_business_review_summary_service import SummaryFixtureMixin


class ReviewSummaryBatchServiceTests(SummaryFixtureMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.first = cls.create_business(1)
        cls.second = cls.create_business(2)

    def test_daily_batch_updates_sentiment_and_reconciles_both_businesses(self):
        with (
            patch.object(ReviewSentimentService, "reconcile_business") as sentiment,
            patch.object(ReviewInsightSchedulingService, "reconcile") as narrative,
        ):
            result = ReviewSummaryBatchService.recompute()
        self.assertEqual(result["considered"], 2)
        self.assertEqual(result["sentiment_updated"], 2)
        self.assertEqual(result["keywords_skipped"], 2)
        self.assertEqual(sentiment.call_count, 2)
        self.assertEqual(narrative.call_count, 2)

    def test_sentiment_failure_does_not_block_narrative_or_later_business(self):
        with (
            patch.object(ReviewSentimentService, "reconcile_business", side_effect=RuntimeError()),
            patch.object(ReviewInsightSchedulingService, "reconcile") as narrative,
        ):
            result = ReviewSummaryBatchService.recompute()
        self.assertEqual(result["failed_business_ids"], [self.first.pk, self.second.pk])
        self.assertEqual(narrative.call_count, 2)

    def test_selected_legacy_retry_ids_reconcile_without_duplicate_sentiment(self):
        with (
            patch.object(ReviewSentimentService, "reconcile_business") as sentiment,
            patch.object(ReviewInsightSchedulingService, "reconcile") as narrative,
        ):
            result = ReviewSummaryBatchService.recompute(business_ids=[self.first.pk, self.first.pk])
        self.assertEqual(result["considered"], 1)
        sentiment.assert_not_called()
        narrative.assert_called_once_with(self.first.pk)

    def test_empty_selected_batch_does_not_restart_full_scan(self):
        self.assertEqual(ReviewSummaryBatchService.recompute(business_ids=[])["considered"], 0)

    def test_coordinator_failure_does_not_stop_later_business(self):
        with patch.object(ReviewInsightSchedulingService, "reconcile", side_effect=[RuntimeError(), "queued"]):
            result = ReviewSummaryBatchService.recompute()
        self.assertEqual(result["failed_business_ids"], [self.first.pk])
        self.assertEqual(result["keywords_skipped"], 1)
