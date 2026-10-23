from unittest.mock import patch

from django.test import TestCase

from apps.reviews.models import ReviewInsightRegeneration
from apps.reviews.services.business_review_insights_service import BusinessReviewInsightsService
from apps.reviews.services.review_insight_scheduling_service import ReviewInsightSchedulingService
from apps.reviews.services.review_keyword_service import ReviewKeywordService
from apps.reviews.services.review_sentiment_service import ReviewSentimentService
from apps.reviews.services.tests.test_business_review_summary_service import SummaryFixtureMixin


class BusinessReviewInsightsServiceTests(SummaryFixtureMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.business = cls.create_business()

    def test_legacy_refresh_requests_durable_work_without_inference(self):
        with (
            patch.object(ReviewSentimentService, "reconcile_business") as sentiment,
            patch.object(ReviewKeywordService, "_generate") as provider,
        ):
            result = BusinessReviewInsightsService.refresh(self.business.pk)
        self.assertEqual(result["generation_outcome"], "queued")
        self.assertFalse(result["sentiment_recomputed"])
        self.assertEqual(ReviewInsightRegeneration.objects.get(BUSN_ID=self.business).RIRG_REQUESTED_REVISION, 1)
        sentiment.assert_not_called()
        provider.assert_not_called()

    def test_duplicate_legacy_refresh_does_not_advance_revision(self):
        BusinessReviewInsightsService.refresh(self.business.pk)
        result = BusinessReviewInsightsService.refresh(self.business.pk, retry_keywords_only=True)
        self.assertEqual(result["generation_outcome"], "pending")
        self.assertEqual(ReviewInsightRegeneration.objects.get(BUSN_ID=self.business).RIRG_REQUESTED_REVISION, 1)

    def test_legacy_keywords_entry_point_uses_same_coordinator(self):
        with patch.object(ReviewInsightSchedulingService, "reconcile", return_value="pending") as request:
            self.assertEqual(ReviewKeywordService.refresh(self.business.pk), "pending")
        request.assert_called_once_with(self.business.pk)
