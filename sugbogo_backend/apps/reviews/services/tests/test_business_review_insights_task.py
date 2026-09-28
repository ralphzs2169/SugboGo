from unittest.mock import ANY, patch

from celery.exceptions import Retry
from django.test import SimpleTestCase

from apps.reviews.services.business_review_insights_service import (
    BusinessReviewInsightsService,
)
from apps.reviews.services.review_keyword_service import (
    ReviewKeywordService,
    RetryableKeywordError,
)
from apps.reviews.tasks import refresh_business_review_insights


class BusinessReviewInsightsTaskTests(SimpleTestCase):
    @patch.object(BusinessReviewInsightsService, "refresh")
    def test_invokes_per_business_orchestration(self, refresh):
        refresh.return_value = {
            "business_id": 12,
            "sentiment_recomputed": True,
            "generation_outcome": "updated",
        }

        result = refresh_business_review_insights.run(business_id=12)

        refresh.assert_called_once_with(
            12,
            retry_keywords_only=False,
            reference_time=ANY,
        )
        self.assertEqual(result, refresh.return_value)

    @patch.object(
        BusinessReviewInsightsService,
        "refresh",
        side_effect=RetryableKeywordError("temporary"),
    )
    def test_keyword_failure_retries_only_keywords_with_existing_backoff(self, refresh):
        for retry_number, seconds in enumerate([60, 120, 240]):
            with self.subTest(retry_number=retry_number):
                refresh_business_review_insights.push_request(retries=retry_number)
                try:
                    with patch.object(
                        refresh_business_review_insights,
                        "retry",
                        side_effect=Retry(),
                    ) as retry:
                        with self.assertRaises(Retry):
                            refresh_business_review_insights.run(12)

                    self.assertEqual(retry.call_args.kwargs["countdown"], seconds)
                    self.assertEqual(retry.call_args.kwargs["kwargs"], {
                        "retry_keywords_only": True,
                        "reference_time_iso": ANY,
                    })
                finally:
                    refresh_business_review_insights.pop_request()

        self.assertEqual(refresh_business_review_insights.max_retries, 3)

    @patch.object(BusinessReviewInsightsService, "refresh", side_effect=ValueError("bad data"))
    def test_permanent_failure_is_not_retried(self, refresh):
        with patch.object(refresh_business_review_insights, "retry") as retry:
            with self.assertRaises(ValueError):
                refresh_business_review_insights.run(business_id=12)

        retry.assert_not_called()

    @patch.object(ReviewKeywordService, "mark_retry_exhausted")
    @patch.object(
        BusinessReviewInsightsService,
        "refresh",
        side_effect=RetryableKeywordError("temporary"),
    )
    def test_exhausted_keyword_retries_mark_non_retryable_without_retrying(
        self,
        refresh,
        mark_retry_exhausted,
    ):
        refresh_business_review_insights.push_request(retries=3)
        try:
            with (
                patch.object(refresh_business_review_insights, "retry") as retry,
                patch("apps.reviews.tasks.logger.error") as log,
                self.assertRaises(RetryableKeywordError),
            ):
                refresh_business_review_insights.run(business_id=12)
        finally:
            refresh_business_review_insights.pop_request()

        retry.assert_not_called()
        mark_retry_exhausted.assert_called_once_with(
            12,
            reference_time=ANY,
        )
        self.assertIn("exhausted", log.call_args.args[0])
