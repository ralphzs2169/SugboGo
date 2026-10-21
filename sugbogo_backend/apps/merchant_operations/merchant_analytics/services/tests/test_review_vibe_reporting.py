"""Verify the shared vibe rule and selected-cohort contract without database writes."""

from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from apps.reviews.models import BusinessReviewSummary
from apps.shared.analytics.date_ranges import resolve_period
from apps.shared.analytics.review_vibe import classify_review_vibe

from ...serializers.premium_analytics_serializers import ReviewCohortSerializer
from ..premium_review_performance_service import PremiumReviewPerformanceService


class ReviewVibeReportingTests(SimpleTestCase):
    def setUp(self):
        policy = {"sentiment_min_classified_reviews": 5}
        shared_policy = patch(
            "apps.shared.analytics.review_vibe.current_policy",
            return_value=policy,
        )
        report_policy = patch(
            "apps.merchant_operations.merchant_analytics.services."
            "premium_review_performance_service.current_policy",
            return_value=policy,
        )
        shared_policy.start()
        report_policy.start()
        self.addCleanup(shared_policy.stop)
        self.addCleanup(report_policy.stop)

    def test_preserves_existing_dominance_and_sample_boundaries(self):
        cases = (
            (0, 0, 0, None),
            (4, 0, 0, None),
            (5, 0, 0, "mostly_positive"),
            (7, 2, 1, "mostly_positive"),
            (2, 7, 2, "mostly_neutral"),
            (4, 3, 13, "mostly_negative"),
            (48, 27, 25, "mixed"),
            (11, 8, 1, "mostly_positive"),
            (54, 30, 16, "mixed"),
            (55, 41, 4, "mixed"),
            (5, 5, 0, "mixed"),
        )
        for positive, neutral, negative, expected in cases:
            with self.subTest(counts=(positive, neutral, negative)):
                classified = positive + neutral + negative
                summary = BusinessReviewSummary(
                    BRSU_CLASSIFIED_REVIEW_COUNT=classified,
                    BRSU_POSITIVE_COUNT=positive,
                    BRSU_NEUTRAL_COUNT=neutral,
                    BRSU_NEGATIVE_COUNT=negative,
                )
                self.assertEqual(summary.overall_vibe, expected)
                self.assertEqual(
                    classify_review_vibe(
                        counts={
                            "positive": positive,
                            "neutral": neutral,
                            "negative": negative,
                        },
                        classified_count=classified,
                    ),
                    expected,
                )

    def test_current_policy_threshold_is_not_replaced_with_a_fixed_minimum(self):
        with patch(
            "apps.shared.analytics.review_vibe.current_policy",
            return_value={"sentiment_min_classified_reviews": 10},
        ):
            self.assertIsNone(
                classify_review_vibe(
                    counts={"positive": 9, "neutral": 0, "negative": 0},
                    classified_count=9,
                ),
            )

    def test_cohort_and_serialized_badge_use_each_selected_period(self):
        now = datetime(2026, 10, 19, 5, tzinfo=UTC)
        selections = (
            ("7", 5, 0, 0, "mostly_positive"),
            ("30", 5, 5, 0, "mixed"),
            ("90", 1, 1, 8, "mostly_negative"),
        )
        for preset, positive, neutral, negative, expected in selections:
            with self.subTest(period=preset):
                period = resolve_period(
                    preset=preset,
                    now=now,
                )
                published = MagicMock()
                cohort = published.filter.return_value
                classified = positive + neutral + negative
                cohort.aggregate.return_value = {
                    "published_review_count": classified + 3,
                    "replied_review_count": 0,
                    "positive": positive,
                    "neutral": neutral,
                    "negative": negative,
                }
                cohort.filter.return_value.annotate.return_value.values_list.return_value = []
                _, measures = PremiumReviewPerformanceService.cohort(
                    published,
                    period,
                )
                published.filter.assert_called_once_with(
                    REVW_CREATED_AT__gte=period.start,
                    REVW_CREATED_AT__lt=period.end,
                )
                self.assertEqual(measures["overall_vibe"], expected)
                self.assertEqual(measures["unclassified_review_count"], 3)
                self.assertEqual(
                    ReviewCohortSerializer(measures).data["overall_vibe"],
                    expected,
                )

    def test_insufficient_cohort_exposes_null_without_hiding_counts(self):
        period = resolve_period(
            now=datetime(2026, 10, 19, 5, tzinfo=UTC),
        )
        published = MagicMock()
        cohort = published.filter.return_value
        cohort.aggregate.return_value = {
            "published_review_count": 8,
            "replied_review_count": 0,
            "positive": 4,
            "neutral": 0,
            "negative": 0,
        }
        cohort.filter.return_value.annotate.return_value.values_list.return_value = []
        _, measures = PremiumReviewPerformanceService.cohort(
            published,
            period,
        )
        self.assertIsNone(measures["overall_vibe"])
        self.assertFalse(measures["has_sufficient_sentiment_data"])
        self.assertEqual(measures["sentiment"]["positive"]["count"], 4)
        self.assertIsNone(
            ReviewCohortSerializer(measures).data["overall_vibe"],
        )
