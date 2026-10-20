from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase

from apps.reviews.models import BusinessReviewSummary, Review
from apps.reviews.services.business_review_insights_service import BusinessReviewInsightsService

from ..premium_review_insights_service import PremiumReviewInsightsService
from ..premium_review_performance_service import PremiumReviewPerformanceService
from .fixtures import MerchantAnalyticsFixtures


class PremiumReviewServicesTests(MerchantAnalyticsFixtures, TestCase):
    def test_review_count_change_uses_eligible_creation_cohorts_and_zero_baselines(self):
        current = self.review(self.period.start)
        self.review(self.period.start, Review.ReviewStatus.REJECTED)
        self.review(self.period.end)
        report = PremiumReviewPerformanceService.get_report(
            self.merchant_a,
            self.period,
        )
        self.assertEqual(report["published_review_count_change"]["value"], 1)
        self.assertEqual(report["published_review_count_change"]["unit"], "count")
        self.review(self.period.previous_start)
        report = PremiumReviewPerformanceService.get_report(
            self.merchant_a,
            self.period,
        )
        self.assertEqual(report["published_review_count_change"]["value"], 0)
        current.delete()
        report = PremiumReviewPerformanceService.get_report(
            self.merchant_a,
            self.period,
        )
        self.assertEqual(report["published_review_count_change"]["value"], -1)

    def summary(self, state="ready", narrative="Stored review narrative."):
        return BusinessReviewSummary.objects.create(
            BUSN_ID=self.business_a, BRSU_GENERATION_STATE=state, BRSU_NARRATIVE=narrative,
            BRSU_REVIEW_COUNT=10, BRSU_POSITIVE_COUNT=4, BRSU_NEUTRAL_COUNT=1,
            BRSU_NEGATIVE_COUNT=1, BRSU_CLASSIFIED_REVIEW_COUNT=6,
            BRSU_ELIGIBLE_REVIEW_COUNT=10, BRSU_ANALYZED_REVIEW_COUNT=5,
            BRSU_KEYWORD_TAGS=[{"text": "friendly staff", "count": 3, "review_ids": [999], "polarity": "praise"}],
            BRSU_SUPPORTING_REVIEW_REFERENCES={"private": [999]},
            BRSU_COVERAGE_START=self.NOW - timedelta(days=30), BRSU_COVERAGE_END=self.NOW - timedelta(days=1),
            BRSU_GENERATED_AT=self.NOW - timedelta(days=1),
        )

    def test_missing_stored_summary_is_null_and_requests_do_not_refresh(self):
        with patch.object(BusinessReviewInsightsService, "refresh", side_effect=AssertionError("Refresh attempted")):
            report = PremiumReviewInsightsService.get_report(self.merchant_a, self.period)
        self.assertIsNone(report["stored_summary"])
        self.assertFalse(BusinessReviewSummary.objects.exists())
        self.assertIn("stored_summary_missing", report["meta"]["partial_reasons"])

    def test_stored_summary_preserves_coverage_sampling_and_safe_mentions(self):
        summary = self.summary()
        report = PremiumReviewInsightsService.get_report(self.merchant_a, self.period)
        insights = report["stored_summary"]
        self.assertTrue(insights["is_sampled"])
        self.assertEqual(insights["classified_review_count"], 6)
        self.assertEqual(insights["frequent_mentions"], [{"label": "friendly staff", "count": 3}])
        self.assertEqual(insights["coverage_end"], summary.BRSU_COVERAGE_END.isoformat().replace("+00:00", "Z"))
        self.assertNotIn("supporting_review_references", insights)
        self.assertIsNone(PremiumReviewInsightsService.get_report(self.merchant_b, self.period)["stored_summary"])

    def test_pending_insufficient_and_invalidated_content_are_not_exposed(self):
        for state, narrative in (("pending", "Old text"), ("insufficient_reviews", "Old text"), ("outdated", "")):
            with self.subTest(state=state):
                summary = self.summary(state, narrative)
                insights = PremiumReviewInsightsService.get_report(self.merchant_a, self.period)["stored_summary"]
                self.assertFalse(insights["content_available"])
                self.assertIsNone(insights["narrative"])
                self.assertEqual(insights["frequent_mentions"], [])
                summary.delete()

    def test_outdated_retained_content_and_insufficient_sentiment_follow_existing_gate(self):
        summary = self.summary("outdated")
        BusinessReviewSummary.objects.filter(pk=summary.pk).update(
            BRSU_POSITIVE_COUNT=1, BRSU_NEUTRAL_COUNT=0, BRSU_NEGATIVE_COUNT=0, BRSU_CLASSIFIED_REVIEW_COUNT=1,
        )
        report = PremiumReviewInsightsService.get_report(self.merchant_a, self.period)
        insights = report["stored_summary"]
        self.assertTrue(insights["content_available"])
        self.assertFalse(insights["has_sufficient_sentiment_data"])
        self.assertIsNone(insights["overall_vibe"])
        self.assertEqual(insights["sentiment"]["positive"]["percentage"], 100)
        self.assertIn("stored_content_outdated", report["meta"]["partial_reasons"])

    def test_empty_review_period_has_null_rates_and_median_not_fake_zero(self):
        report = PremiumReviewPerformanceService.get_report(self.merchant_a, self.period)
        self.assertEqual(report["current"]["published_review_count"], 0)
        self.assertIsNone(report["current"]["reply_rate"])
        self.assertIsNone(report["current"]["median_first_reply_seconds"])
        self.assertIsNone(report["reply_rate_change"]["value"])
        self.assertTrue(all(row["reply_rate"] is None for row in report["series"]))
        self.assertIsNone(report["current"]["sentiment"]["positive"]["percentage"])

    def test_reply_median_uses_replied_cohort_only_with_generated_cutoff(self):
        for hours in (2, 6):
            review = self.review(self.NOW - timedelta(days=3))
            self.reply(review, review.REVW_CREATED_AT + timedelta(hours=hours))
        self.review(self.NOW - timedelta(days=2))
        self.review(self.period.start - timedelta(days=1))
        self.review(self.NOW - timedelta(days=1), business=self.business_b)
        report = PremiumReviewPerformanceService.get_report(self.merchant_a, self.period)
        self.assertEqual(report["current"]["median_first_reply_seconds"], 4 * 3600)
        self.assertEqual(report["current"]["median_replied_sample_size"], 2)
        self.assertEqual(report["current"]["reply_rate"], 66.67)
        self.assertEqual(report["current_unanswered_published"], 2)

    def test_future_and_negative_reply_timestamps_are_excluded(self):
        for reply_time in (self.NOW + timedelta(hours=1), self.NOW - timedelta(days=3)):
            review = self.review(self.NOW - timedelta(days=1))
            self.reply(review, reply_time)
        report = PremiumReviewPerformanceService.get_report(self.merchant_a, self.period)
        self.assertEqual(report["excluded_reply_timestamp_count"], 2)
        self.assertEqual(report["current"]["replied_review_count"], 0)
        self.assertIsNone(report["current"]["median_first_reply_seconds"])

    def test_pooled_sentiment_ignores_unclassified_and_unpublished_reviews(self):
        for label in ("positive", "positive", "negative", "neutral", ""):
            review = self.review(self.NOW - timedelta(days=1))
            Review.objects.filter(pk=review.pk).update(REVW_SENTIMENT_LABEL=label)
        self.review(self.NOW - timedelta(days=1), Review.ReviewStatus.REJECTED)
        report = PremiumReviewPerformanceService.get_report(self.merchant_a, self.period)
        current = report["current"]
        self.assertEqual(current["published_review_count"], 5)
        self.assertEqual(current["classified_review_count"], 4)
        self.assertFalse(current["has_sufficient_sentiment_data"])
        self.assertEqual(current["sentiment"]["positive"]["percentage"], 50)
        self.assertEqual(sum(row["published_review_count"] for row in report["series"]), 5)

    def test_reply_rate_changes_are_percentage_points_even_when_prior_rate_is_zero(self):
        previous = self.review(self.period.previous_start)
        current = self.review(self.period.start)
        self.reply(current, self.NOW)
        report = PremiumReviewPerformanceService.get_report(self.merchant_a, self.period)
        self.assertEqual(report["previous"]["published_review_count"], 1)
        self.assertEqual(report["reply_rate_change"]["value"], 100)
        self.assertEqual(report["reply_rate_change"]["unit"], "percentage_points")
        previous.delete()
        self.assertIsNone(PremiumReviewPerformanceService.get_report(self.merchant_a, self.period)["reply_rate_change"]["value"])

    def test_period_shares_pool_counts_instead_of_averaging_weekly_percentages(self):
        for days, label in ((20, "negative"), (1, "positive"), (1, "positive"), (1, "positive"), (1, "positive")):
            review = self.review(self.NOW - timedelta(days=days))
            Review.objects.filter(pk=review.pk).update(REVW_SENTIMENT_LABEL=label)
        report = PremiumReviewPerformanceService.get_report(self.merchant_a, self.period)
        self.assertTrue(report["current"]["has_sufficient_sentiment_data"])
        self.assertEqual(report["current"]["sentiment"]["positive"]["percentage"], 80)
        self.assertEqual(sum(row["classified_review_count"] for row in report["series"]), 5)
