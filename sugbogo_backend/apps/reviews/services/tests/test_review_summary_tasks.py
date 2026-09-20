import json
from datetime import UTC, datetime
from unittest.mock import patch

from celery.exceptions import Retry
from django.conf import settings
from django.test import SimpleTestCase

from apps.reviews.services.review_keyword_service import RetryableKeywordError
from apps.reviews.services.review_summary_batch_service import ReviewSummaryBatchService
from apps.reviews.tasks import recompute_review_summaries


class ReviewSummaryTaskTests(SimpleTestCase):
    reference_time = datetime(2026, 9, 20, 3, tzinfo=UTC)

    def result(self, **overrides):
        result = {
            "considered": 2,
            "sentiment_updated": 2,
            "keywords_updated": 2,
            "keywords_cleared": 0,
            "keywords_skipped": 0,
            "failed_business_ids": [],
            "retry_business_ids": [],
        }
        result.update(overrides)
        return result

    @patch.object(ReviewSummaryBatchService, "recompute")
    def test_success_returns_json_summary_and_structured_logs(self, batch):
        batch.return_value = self.result()
        with patch("apps.reviews.tasks.timezone.now", return_value=self.reference_time), patch(
            "apps.reviews.tasks.logger.info",
        ) as log:
            result = recompute_review_summaries.run()
        self.assertEqual(result["reference_time"], self.reference_time.isoformat())
        self.assertEqual(result["failed"], 0)
        self.assertEqual(json.loads(json.dumps(result)), result)
        batch.assert_called_once_with(business_ids=None)
        self.assertEqual(log.call_args.kwargs["extra"], result)

    @patch.object(ReviewSummaryBatchService, "recompute")
    def test_permanent_business_failure_returns_without_retry(self, batch):
        batch.return_value = self.result(keywords_updated=1, failed_business_ids=[8])
        with patch.object(recompute_review_summaries, "retry") as retry, patch(
            "apps.reviews.tasks.logger.warning",
        ) as log:
            result = recompute_review_summaries.run()
        retry.assert_not_called()
        self.assertEqual(result["failed"], 1)
        self.assertEqual(log.call_args.kwargs["extra"], result)

    @patch.object(ReviewSummaryBatchService, "recompute")
    def test_retry_uses_only_transient_ids_and_preserves_run_summary(self, batch):
        batch.return_value = self.result(keywords_updated=1, retry_business_ids=[8])
        for retry_number, seconds in enumerate([60, 120, 240]):
            with self.subTest(retry_number=retry_number):
                recompute_review_summaries.push_request(retries=retry_number)
                try:
                    with patch.object(recompute_review_summaries, "retry", side_effect=Retry()) as retry:
                        with self.assertRaises(Retry):
                            recompute_review_summaries.run(reference_time_iso=self.reference_time.isoformat())
                    self.assertEqual(retry.call_args.kwargs["countdown"], seconds)
                    kwargs = retry.call_args.kwargs["kwargs"]
                    self.assertEqual(kwargs["business_ids"], [8])
                    self.assertEqual(kwargs["reference_time_iso"], self.reference_time.isoformat())
                    self.assertEqual(kwargs["previous_summary"]["keywords_updated"], 1)
                finally:
                    recompute_review_summaries.pop_request()
        self.assertEqual(recompute_review_summaries.max_retries, 3)

    @patch.object(ReviewSummaryBatchService, "recompute")
    def test_recovered_retry_merges_counts_without_double_counting_businesses(self, batch):
        previous = self.result(keywords_updated=1, retry_business_ids=[8])
        batch.return_value = self.result(considered=1, sentiment_updated=0, keywords_updated=1)
        result = recompute_review_summaries.run(
            reference_time_iso=self.reference_time.isoformat(),
            business_ids=[8],
            previous_summary=previous,
        )
        batch.assert_called_once_with(business_ids=[8])
        self.assertEqual(result["considered"], 2)
        self.assertEqual(result["sentiment_updated"], 2)
        self.assertEqual(result["keywords_updated"], 2)
        self.assertEqual(result["failed"], 0)

    @patch.object(ReviewSummaryBatchService, "recompute")
    def test_retry_preserves_prior_permanent_failures(self, batch):
        previous = self.result(keywords_updated=0, failed_business_ids=[7], retry_business_ids=[8])
        batch.return_value = self.result(considered=1, sentiment_updated=0, keywords_updated=1)
        result = recompute_review_summaries.run(business_ids=[8], previous_summary=previous)
        self.assertEqual(result["failed_business_ids"], [7])
        self.assertEqual(result["failed"], 1)

    @patch.object(ReviewSummaryBatchService, "recompute")
    def test_exhausted_retries_raise_without_enqueuing_again(self, batch):
        batch.return_value = self.result(keywords_updated=1, retry_business_ids=[8])
        recompute_review_summaries.push_request(retries=3, called_directly=False)
        try:
            with patch.object(recompute_review_summaries, "apply_async") as enqueue:
                with self.assertRaises(RetryableKeywordError):
                    recompute_review_summaries.run()
                enqueue.assert_not_called()
        finally:
            recompute_review_summaries.pop_request()

    @patch.object(ReviewSummaryBatchService, "recompute", side_effect=ValueError("batch failed"))
    def test_unexpected_batch_error_is_logged_and_not_retried(self, batch):
        with patch.object(recompute_review_summaries, "retry") as retry, patch(
            "apps.reviews.tasks.logger.exception",
        ) as log:
            with self.assertRaises(ValueError):
                recompute_review_summaries.run()
        retry.assert_not_called()
        log.assert_called_once()

    def test_daily_schedule_is_registered_at_three_utc(self):
        registration = settings.CELERY_BEAT_SCHEDULE["daily-review-summary-recomputation"]
        self.assertEqual(registration["task"], recompute_review_summaries.name)
        self.assertEqual(registration["schedule"].hour, {3})
        self.assertEqual(registration["schedule"].minute, {0})
        self.assertEqual(settings.CELERY_TIMEZONE, "UTC")
