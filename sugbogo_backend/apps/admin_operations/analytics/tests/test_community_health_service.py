"""Current publication-state cohorts, pooled sentiment and SQL time buckets."""

from datetime import timedelta

from django.test import TestCase

from apps.admin_operations.analytics.services.community_health_service import CommunityHealthService
from apps.reviews.models import Review

from .reporting_fixtures import ReportingFixtures


class CommunityHealthServiceTests(ReportingFixtures, TestCase):
    def review(
        self,
        label=None,
        status=Review.ReviewStatus.PUBLISHED,
        when=None,
        business=None,
    ):
        if business is None:
            business = self.make_business()
        if when is None:
            when = self.period.start
        review = Review.objects.create(
            USER_ID=self.make_user(),
            BUSN_ID=business,
            REVW_TEXT="Stored review evidence.",
            REVW_STATUS=status,
            REVW_SENTIMENT_LABEL=label,
        )
        Review.objects.filter(pk=review.pk).update(REVW_CREATED_AT=when)
        return review

    def test_empty_reviews_have_zero_counts_and_null_classified_percentages(self):
        report = CommunityHealthService.get_report(self.period)
        self.assertEqual(
            report["inventory"]["retained_reviews"],
            0,
        )
        self.assertEqual(
            report["current"]["published_review_count"],
            0,
        )
        self.assertIsNone(report["current"]["sentiment"]["positive"]["percentage"])
        self.assertEqual(
            len(report["series"]),
            7,
        )
        self.assertFalse(report["series_is_sparse"])

    def test_only_currently_published_creation_cohorts_contribute_to_period_activity(self):
        self.review("positive")
        self.review(
            "negative",
            Review.ReviewStatus.REJECTED,
        )
        self.review(
            "neutral",
            Review.ReviewStatus.UNDER_REVIEW,
        )
        self.review(
            None,
            Review.ReviewStatus.FLAGGED,
        )
        report = CommunityHealthService.get_report(self.period)
        self.assertEqual(
            report["inventory"]["retained_reviews"],
            4,
        )
        self.assertEqual(
            report["inventory"]["rejected"],
            1,
        )
        self.assertEqual(
            report["inventory"]["under_review"],
            1,
        )
        self.assertEqual(
            report["inventory"]["flagged"],
            1,
        )
        self.assertEqual(
            report["current"]["published_review_count"],
            1,
        )
        self.assertIn(
            "not publication transition history",
            report["definition"],
        )

    def test_sentiment_uses_pooled_recognized_labels_and_separate_unclassified_count(self):
        business = self.make_business()
        for label in ("positive", "positive", "neutral", "negative", None, "legacy_unknown"):
            self.review(
                label,
                business=business,
            )
        with self.assertNumQueries(3):
            report = CommunityHealthService.get_report(self.period)
        current = report["current"]
        self.assertEqual(
            current["published_review_count"],
            6,
        )
        self.assertEqual(
            current["classified_review_count"],
            4,
        )
        self.assertEqual(
            current["unclassified_review_count"],
            2,
        )
        self.assertEqual(
            current["sentiment"]["positive"],
            {"count": 2, "percentage": 50},
        )
        self.assertEqual(
            current["sentiment"]["neutral"]["percentage"],
            25,
        )
        self.assertEqual(
            current["sentiment"]["negative"]["percentage"],
            25,
        )
        # Stored labels qualify just as in Merchant Analytics, even with no numeric score.
        self.assertIsNone(Review.objects.first().REVW_SENTIMENT_SCORE)

    def test_unclassified_only_cohort_does_not_create_zero_sentiment_shares(self):
        self.review()
        report = CommunityHealthService.get_report(self.period)
        self.assertEqual(
            report["current"]["unclassified_review_count"],
            1,
        )
        self.assertEqual(
            report["current"]["classified_review_count"],
            0,
        )
        self.assertIsNone(report["current"]["sentiment"]["negative"]["percentage"])

    def test_period_edges_and_previous_cohort_match_series_and_comparison(self):
        self.review(
            "positive",
            when=self.period.start,
        )
        self.review(
            "negative",
            when=self.period.end - timedelta(microseconds=1),
        )
        self.review(
            "neutral",
            when=self.period.end,
        )
        self.review(
            "neutral",
            when=self.period.previous_start,
        )
        report = CommunityHealthService.get_report(self.period)
        self.assertEqual(
            report["current"]["published_review_count"],
            2,
        )
        self.assertEqual(
            report["previous"]["published_review_count"],
            1,
        )
        self.assertEqual(
            report["published_review_count_change"]["value"],
            1,
        )
        self.assertEqual(
            report["series"][0]["published_review_count"],
            1,
        )
        self.assertEqual(
            report["series"][-1]["published_review_count"],
            1,
        )
        self.assertEqual(
            report["series"][1]["published_review_count"],
            0,
        )

    def test_status_changes_revise_retained_history_and_are_explicitly_disclosed(self):
        review = self.review("positive")
        Review.objects.filter(pk=review.pk).update(REVW_STATUS=Review.ReviewStatus.REJECTED)
        report = CommunityHealthService.get_report(
            self.period,
            interval="weekly",
        )
        self.assertEqual(
            report["current"]["published_review_count"],
            0,
        )
        self.assertEqual(
            report["inventory"]["rejected"],
            1,
        )
        self.assertEqual(
            report["measurement_type"],
            "period_current_state",
        )
        self.assertIn(
            "current_publication_and_sentiment_state",
            report["meta"]["partial_reasons"],
        )
        self.assertEqual(
            len(report["series"]),
            1,
        )
