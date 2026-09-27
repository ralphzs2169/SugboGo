from unittest.mock import ANY, patch

from django.test import TestCase
from django.utils import timezone

from apps.reviews.models import BusinessReviewSummary, Review
from apps.reviews.services.business_review_insights_service import (
    BusinessReviewInsightsService,
)
from apps.reviews.services.business_review_summary_service import (
    BusinessReviewSummaryService,
)
from apps.reviews.services.review_keyword_service import (
    RetryableKeywordError,
    ReviewKeywordService,
)
from apps.reviews.services.review_sentiment_service import ReviewSentimentService
from apps.reviews.services.tests.test_business_review_summary_service import (
    SummaryFixtureMixin,
)


class BusinessReviewInsightsServiceTests(SummaryFixtureMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.business = cls.create_business()

    def test_recomputes_sentiment_before_keywords_and_returns_outcome(self):
        calls = []
        reference_time = timezone.now()

        def recompute_sentiment(business_id, reference_time=None):
            calls.append(("sentiment", business_id, reference_time))

        def reconcile_sentiment(business_id, reference_time=None):
            calls.append(("reconcile", business_id, reference_time))

        def refresh_keywords(business_id, reference_time=None):
            calls.append(("keywords", business_id, reference_time))
            return "updated"

        with (
            patch.object(
                ReviewSentimentService,
                "reconcile_business",
                side_effect=reconcile_sentiment,
            ),
            patch.object(
                BusinessReviewSummaryService,
                "recompute_sentiment",
                side_effect=recompute_sentiment,
            ),
            patch.object(
                ReviewKeywordService,
                "refresh",
                side_effect=refresh_keywords,
            ),
        ):
            result = BusinessReviewInsightsService.refresh(
                self.business.pk,
                reference_time=reference_time,
            )

        self.assertEqual(
            calls,
            [
                ("reconcile", self.business.pk, reference_time),
                ("sentiment", self.business.pk, reference_time),
                ("keywords", self.business.pk, reference_time),
            ],
        )
        self.assertEqual(result, {
            "business_id": self.business.pk,
            "sentiment_recomputed": True,
            "generation_outcome": "updated",
        })

    def test_keyword_retry_does_not_recompute_sentiment(self):
        with (
            patch.object(ReviewSentimentService, "reconcile_business") as reconcile,
            patch.object(BusinessReviewSummaryService, "recompute_sentiment") as sentiment,
            patch.object(ReviewKeywordService, "refresh", return_value="unchanged") as keywords,
        ):
            result = BusinessReviewInsightsService.refresh(
                self.business.pk,
                retry_keywords_only=True,
            )

        reconcile.assert_not_called()
        sentiment.assert_not_called()
        keywords.assert_called_once_with(self.business.pk, reference_time=ANY)
        self.assertEqual(result["sentiment_recomputed"], False)
        self.assertEqual(result["generation_outcome"], "unchanged")

    def test_existing_unchanged_snapshot_skips_provider(self):
        for index in range(5):
            self.create_review(self.business, index)
        summary = BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        fingerprint = ReviewKeywordService._fingerprint(
            ReviewKeywordService._snapshot(self.business.pk),
        )
        summary.BRSU_KEYWORDS_FINGERPRINT = fingerprint
        summary.BRSU_GENERATION_STATE = BusinessReviewSummary.GenerationState.READY
        summary.save(update_fields=[
            "BRSU_KEYWORDS_FINGERPRINT",
            "BRSU_GENERATION_STATE",
        ])

        with patch.object(ReviewKeywordService, "_generate") as provider:
            result = BusinessReviewInsightsService.refresh(self.business.pk)

        self.assertEqual(result["generation_outcome"], "unchanged")
        provider.assert_not_called()

    def test_empty_eligible_snapshot_uses_existing_clear_behavior(self):
        review = self.create_review(self.business)
        summary = BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        summary.BRSU_KEYWORD_TAGS = [{"text": "friendly service", "count": 2}]
        summary.save(update_fields=["BRSU_KEYWORD_TAGS"])
        Review.objects.filter(pk=review.pk).update(REVW_IS_SPAM_FLAGGED=True)

        with patch.object(ReviewKeywordService, "_generate") as provider:
            result = BusinessReviewInsightsService.refresh(self.business.pk)

        summary.refresh_from_db()
        self.assertEqual(result["generation_outcome"], "insufficient_reviews")
        self.assertEqual(summary.BRSU_REVIEW_COUNT, 0)
        self.assertEqual(summary.BRSU_KEYWORD_TAGS, [])
        provider.assert_not_called()

    def test_keyword_error_propagates_after_sentiment_recomputation(self):
        with patch.object(
            ReviewKeywordService,
            "refresh",
            side_effect=RetryableKeywordError("temporary"),
        ):
            with self.assertRaises(RetryableKeywordError):
                BusinessReviewInsightsService.refresh(self.business.pk)

        self.assertTrue(
            BusinessReviewSummary.objects.filter(BUSN_ID=self.business).exists(),
        )
