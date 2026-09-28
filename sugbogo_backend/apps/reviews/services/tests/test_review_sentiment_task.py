from unittest.mock import patch

from django.test import SimpleTestCase

from apps.reviews.services.review_sentiment_service import ReviewSentimentService
from apps.reviews.tasks import process_review_sentiment


class ReviewSentimentTaskTests(SimpleTestCase):
    @patch("apps.reviews.tasks.refresh_business_review_insights.delay")
    @patch.object(ReviewSentimentService, "process_review", return_value="updated")
    def test_updated_sentiment_queues_review_insights(self, process, refresh):
        self.assertEqual(process_review_sentiment.run(12, 34), "updated")
        process.assert_called_once_with(12)
        refresh.assert_called_once_with(34)

    @patch("apps.reviews.tasks.refresh_business_review_insights.delay")
    @patch.object(ReviewSentimentService, "process_review", return_value="missing")
    def test_deleted_review_exits_cleanly(self, process, refresh):
        self.assertEqual(process_review_sentiment.run(12, 34), "missing")
        refresh.assert_not_called()

    @patch("apps.reviews.tasks.refresh_business_review_insights.delay")
    @patch.object(ReviewSentimentService, "process_review", return_value="stale")
    def test_stale_result_is_reported(self, process, refresh):
        self.assertEqual(process_review_sentiment.run(12, 34), "stale")
        refresh.assert_not_called()

    @patch("apps.reviews.tasks.refresh_business_review_insights.delay")
    @patch.object(
        ReviewSentimentService,
        "process_review",
        side_effect=RuntimeError("model unavailable"),
    )
    def test_inference_failure_is_logged_without_task_failure(
        self,
        process,
        refresh,
    ):
        with patch("apps.reviews.tasks.logger.error") as log:
            self.assertEqual(process_review_sentiment.run(12, 34), "failed")

        self.assertEqual(log.call_args.kwargs["extra"], {
            "review_id": 12,
            "error_type": "RuntimeError",
        })
        refresh.assert_not_called()
