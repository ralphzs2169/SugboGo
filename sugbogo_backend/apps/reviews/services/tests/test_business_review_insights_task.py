from unittest.mock import patch

from django.test import SimpleTestCase

from apps.reviews.services.business_review_insights_service import BusinessReviewInsightsService
from apps.reviews.tasks import refresh_business_review_insights


class BusinessReviewInsightsTaskTests(SimpleTestCase):
    @patch.object(BusinessReviewInsightsService, "refresh")
    def test_old_queued_message_reconciles_instead_of_generating(self, refresh):
        refresh.return_value = {"generation_outcome": "pending"}
        result = refresh_business_review_insights.run(
            12,
            retry_keywords_only=True,
            reference_time_iso="2020-01-01T00:00:00+00:00",
        )
        refresh.assert_called_once_with(12, retry_keywords_only=True, reference_time=None)
        self.assertEqual(result, refresh.return_value)

    @patch.object(BusinessReviewInsightsService, "refresh", return_value={"generation_outcome": "missing"})
    def test_deleted_business_does_not_create_retry_loop(self, refresh):
        with patch.object(refresh_business_review_insights, "retry") as retry:
            result = refresh_business_review_insights.run(12)
        self.assertEqual(result["generation_outcome"], "missing")
        retry.assert_not_called()
