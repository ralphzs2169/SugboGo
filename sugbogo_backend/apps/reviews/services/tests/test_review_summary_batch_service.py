from unittest.mock import ANY, call, patch

from django.test import TestCase, override_settings

from apps.reviews.models import BusinessReviewSummary
from apps.reviews.services.business_review_summary_service import BusinessReviewSummaryService
from apps.reviews.services.review_keyword_service import RetryableKeywordError, ReviewKeywordService
from apps.reviews.services.review_summary_batch_service import ReviewSummaryBatchService
from apps.reviews.services.tests.test_business_review_summary_service import SummaryFixtureMixin


class ReviewSummaryBatchServiceTests(SummaryFixtureMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.first = cls.create_business(1)
        cls.second = cls.create_business(2)
        cls.create_review(cls.first)

    @patch.object(ReviewKeywordService, "refresh", side_effect=["updated", "cleared"])
    def test_batch_persists_sentiment_and_counts_keyword_outcomes(self, keywords):
        result = ReviewSummaryBatchService.recompute()
        self.assertEqual(result, {
            "considered": 2,
            "sentiment_updated": 2,
            "keywords_updated": 1,
            "keywords_cleared": 1,
            "keywords_skipped": 0,
            "failed_business_ids": [],
            "retry_business_ids": [],
        })
        self.assertEqual(BusinessReviewSummary.objects.get(BUSN_ID=self.first).BRSU_REVIEW_COUNT, 1)
        self.assertEqual(BusinessReviewSummary.objects.get(BUSN_ID=self.second).BRSU_REVIEW_COUNT, 0)
        self.assertEqual(keywords.call_args_list, [
            call(self.first.pk, reference_time=ANY),
            call(self.second.pk, reference_time=ANY),
        ])

    @patch.object(ReviewKeywordService, "refresh", side_effect=["failed", "updated"])
    def test_malformed_result_does_not_stop_later_business(self, keywords):
        result = ReviewSummaryBatchService.recompute()
        self.assertEqual(result["failed_business_ids"], [self.first.pk])
        self.assertEqual(result["retry_business_ids"], [])
        self.assertEqual(result["keywords_updated"], 1)

    @patch.object(ReviewKeywordService, "refresh", side_effect=[RetryableKeywordError(), "updated"])
    def test_transient_failure_is_isolated_and_selected_for_retry(self, keywords):
        result = ReviewSummaryBatchService.recompute()
        self.assertEqual(result["retry_business_ids"], [self.first.pk])
        self.assertEqual(result["failed_business_ids"], [])
        self.assertEqual(result["keywords_updated"], 1)
        self.assertEqual(result["sentiment_updated"], 2)

    @patch.object(BusinessReviewSummaryService, "recompute_sentiment", side_effect=[ValueError("bad data"), None])
    @patch.object(ReviewKeywordService, "refresh", return_value="updated")
    def test_sentiment_failure_does_not_stop_later_business(self, keywords, sentiment):
        result = ReviewSummaryBatchService.recompute()
        self.assertEqual(result["failed_business_ids"], [self.first.pk])
        self.assertEqual(result["sentiment_updated"], 1)
        keywords.assert_called_once_with(self.second.pk, reference_time=ANY)

    @patch.object(BusinessReviewSummaryService, "recompute_sentiment")
    @patch.object(ReviewKeywordService, "refresh", return_value="updated")
    def test_retry_only_targets_selected_keywords(self, keywords, sentiment):
        result = ReviewSummaryBatchService.recompute(business_ids=[self.first.pk, self.first.pk])
        keywords.assert_called_once_with(self.first.pk, reference_time=ANY)
        sentiment.assert_not_called()
        self.assertEqual(result["considered"], 1)
        self.assertEqual(result["sentiment_updated"], 0)

    @patch.object(ReviewKeywordService, "refresh")
    def test_empty_retry_selection_does_not_restart_full_batch(self, keywords):
        result = ReviewSummaryBatchService.recompute(business_ids=[])
        self.assertEqual(result["considered"], 0)
        keywords.assert_not_called()

    @patch.object(ReviewKeywordService, "refresh")
    def test_all_skip_outcomes_are_counted(self, keywords):
        for outcome in (
            "unchanged",
            "already_attempted",
            "busy",
            "stale",
            "insufficient_reviews",
        ):
            with self.subTest(outcome=outcome):
                keywords.return_value = outcome
                result = ReviewSummaryBatchService.recompute(business_ids=[self.first.pk])
                self.assertEqual(result["keywords_skipped"], 1)
                self.assertEqual(result["failed_business_ids"], [])

    @override_settings(GEMINI_API_KEY="")
    def test_missing_configuration_still_computes_sentiment(self):
        for index in range(1, 5):
            self.create_review(self.first, index)
        result = ReviewSummaryBatchService.recompute()
        self.assertEqual(result["sentiment_updated"], 2)
        self.assertEqual(result["failed_business_ids"], [self.first.pk])
        self.assertEqual(result["keywords_skipped"], 1)
        self.assertEqual(result["retry_business_ids"], [])
