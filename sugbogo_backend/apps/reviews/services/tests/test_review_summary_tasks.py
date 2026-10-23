from unittest.mock import ANY, patch

from django.conf import settings
from django.test import SimpleTestCase

from apps.reviews.services.review_summary_batch_service import ReviewSummaryBatchService
from apps.reviews.tasks import recompute_review_summaries


class ReviewSummaryTaskTests(SimpleTestCase):
    @patch.object(ReviewSummaryBatchService, "recompute")
    def test_daily_report_preserves_operational_keys(self, batch):
        batch.return_value = {
            "considered": 2, "sentiment_updated": 2,
            "keywords_updated": 0, "keywords_cleared": 0, "keywords_skipped": 2,
            "failed_business_ids": [], "retry_business_ids": [],
        }
        result = recompute_review_summaries.run()
        self.assertEqual(result["failed"], 0)
        self.assertEqual(result["keywords_skipped"], 2)
        batch.assert_called_once_with(business_ids=None, reference_time=ANY)

    @patch.object(ReviewSummaryBatchService, "recompute")
    def test_old_daily_retry_arguments_do_not_restart_provider_generation(self, batch):
        batch.return_value = {"failed_business_ids": [8]}
        with patch.object(recompute_review_summaries, "retry") as retry:
            result = recompute_review_summaries.run(
                reference_time_iso="2020-01-01T00:00:00+00:00",
                business_ids=[8],
                previous_summary={"considered": 99},
            )
        self.assertEqual(result["failed"], 1)
        retry.assert_not_called()
        batch.assert_called_once_with(business_ids=[8], reference_time=ANY)

    def test_debounce_recovery_runs_every_thirty_seconds(self):
        entry = settings.CELERY_BEAT_SCHEDULE["recover-review-insight-regeneration"]
        self.assertEqual(entry["schedule"], 30.0)
        self.assertEqual(entry["task"], "apps.reviews.tasks.recover_review_insight_regeneration")
