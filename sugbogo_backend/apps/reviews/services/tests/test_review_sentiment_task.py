from unittest.mock import patch

from django.test import SimpleTestCase

from apps.reviews.services.review_sentiment_service import ReviewSentimentService
from apps.reviews.tasks import process_review_sentiment


class ReviewSentimentTaskTests(SimpleTestCase):
    @patch.object(ReviewSentimentService, "process_review", return_value="updated")
    def test_task_calls_sentiment_service(self, process):
        self.assertEqual(process_review_sentiment.run(12), "updated")
        process.assert_called_once_with(12)

    @patch.object(ReviewSentimentService, "process_review", return_value="missing")
    def test_deleted_review_exits_cleanly(self, process):
        self.assertEqual(process_review_sentiment.run(12), "missing")

    @patch.object(ReviewSentimentService, "process_review", return_value="stale")
    def test_stale_result_is_reported(self, process):
        self.assertEqual(process_review_sentiment.run(12), "stale")

    @patch.object(
        ReviewSentimentService,
        "process_review",
        side_effect=RuntimeError("model unavailable"),
    )
    def test_inference_failure_is_logged_without_task_failure(self, process):
        with patch("apps.reviews.tasks.logger.error") as log:
            self.assertEqual(process_review_sentiment.run(12), "failed")

        self.assertEqual(log.call_args.kwargs["extra"], {
            "review_id": 12,
            "error_type": "RuntimeError",
        })
