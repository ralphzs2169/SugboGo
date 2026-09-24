from unittest.mock import patch

from celery.exceptions import Retry
from django.test import SimpleTestCase

from apps.reviews.services.business_review_insights_service import (
    BusinessReviewInsightsService,
)
from apps.reviews.services.review_keyword_service import RetryableKeywordError
from apps.reviews.tasks import refresh_business_review_insights


class BusinessReviewInsightsTaskTests(SimpleTestCase):
    @patch.object(BusinessReviewInsightsService, "refresh")
    def test_invokes_per_business_orchestration(self, refresh):
        refresh.return_value = {
            "business_id": 12,
            "sentiment_recomputed": True,
            "keyword_outcome": "updated",
        }

        result = refresh_business_review_insights.run(business_id=12)

        refresh.assert_called_once_with(12, retry_keywords_only=False)
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
                            refresh_business_review_insights.run(business_id=12)

                    self.assertEqual(retry.call_args.kwargs["countdown"], seconds)
                    self.assertEqual(retry.call_args.kwargs["kwargs"], {
                        "business_id": 12,
                        "retry_keywords_only": True,
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
