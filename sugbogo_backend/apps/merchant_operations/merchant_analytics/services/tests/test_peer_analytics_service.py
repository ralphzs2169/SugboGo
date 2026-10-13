from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase

from apps.business.models import Business
from apps.business.services.visibility_event_service import VisibilityEventService, VisibilityTrackingUnavailable
from apps.reviews.models import Review

from ... import constants
from ..peer_analytics_service import PeerAnalyticsService
from .peer_fixtures import PeerAnalyticsFixtures


class PeerAnalyticsServiceTests(PeerAnalyticsFixtures, TestCase):
    def report(self):
        return PeerAnalyticsService.get_report(self.merchant_a, self.period)

    def test_group_of_four_excludes_own_business_and_suppresses_all_metrics(self):
        for _ in range(3):
            self.peer()
        self.event("PROFILE_VISIT", 1, self.period.start)
        with patch.object(VisibilityEventService, "get_business_attention_metrics", side_effect=AssertionError("Small group queried")):
            report = self.report()
        self.assertEqual(report["status"], "insufficient_data")
        self.assertEqual(report["group"]["size"], 4)
        self.assertEqual(report["group"]["minimum_size"], constants.MIN_PEER_GROUP_SIZE)
        for metric in report["metrics"].values():
            for field in ("merchant_value", "peer_median", "position", "eligible_peer_sample_size"):
                self.assertIsNone(metric[field])

    def test_five_other_category_peers_are_enough_and_cluster_outliers_are_excluded(self):
        peers = self.five_peers()
        outsider = self.peer(category=self.other_category())
        for business in peers:
            self.event("PROFILE_VISIT", 1, self.period.start, business)
        for explorer in range(10):
            self.event("PROFILE_VISIT", explorer, self.period.start, outsider)
            self.event("PROFILE_VISIT", explorer, self.period.start)
        report = self.report()
        self.assertEqual((report["group"]["scope"], report["group"]["size"]), ("category", 5))
        self.assertIsNone(report["group"]["fallback_reason"])
        self.assertEqual(report["metrics"]["profile_visits"]["peer_median"], 1)
        self.assertEqual(report["metrics"]["profile_visits"]["merchant_value"], 10)
        self.assertEqual(report["metrics"]["profile_visits"]["position"], "above_median")

    def test_category_falls_back_to_cluster_when_only_cluster_has_five(self):
        category = self.other_category()
        for _ in range(4):
            self.peer(category=category)
        report = self.report()
        self.assertEqual((report["group"]["scope"], report["group"]["size"]), ("cluster", 5))
        self.assertEqual(report["group"]["fallback_reason"], "category_group_too_small")

    def test_suspended_other_cluster_and_future_businesses_are_not_peers(self):
        self.peer(status=Business.BusinessStatus.SUSPENDED)
        self.peer(category=self.other_category(other_cluster=True))
        future = self.peer()
        Business.objects.filter(pk=future.pk).update(BUSN_CREATED_AT=self.NOW + timedelta(days=1))
        self.assertEqual(self.report()["group"]["size"], 1)

    def test_empty_period_includes_zero_businesses_with_ties_and_no_sentiment_comparison(self):
        self.five_peers()
        report = self.report()
        for name in ("profile_visits", "saves", "specialty_support"):
            self.assertEqual(report["metrics"][name]["merchant_value"], 0)
            self.assertEqual(report["metrics"][name]["peer_median"], 0)
            self.assertEqual(report["metrics"][name]["position"], "at_median")
        self.assertIsNone(report["metrics"]["positive_review_share"]["peer_median"])

    def test_even_group_median_and_below_position_do_not_exclude_zero_peers(self):
        peers = [*self.five_peers(), self.peer()]
        for business, count in zip(peers, (0, 0, 2, 4, 9, 10), strict=True):
            for explorer in range(count):
                self.event("SAVE", explorer, self.period.start, business)
        metric = self.report()["metrics"]["saves"]
        self.assertEqual(metric["peer_median"], 3)
        self.assertEqual(metric["position"], "below_median")
        self.assertEqual(metric["reason"], "coverage_unverified")

    def test_displayed_equal_values_have_at_median_position(self):
        metric = PeerAnalyticsService.comparison("positive_review_share", 66.66666, [66.667] * 5)
        self.assertEqual(metric["merchant_value"], 66.67)
        self.assertEqual(metric["peer_median"], 66.67)
        self.assertEqual(metric["position"], "at_median")

    def test_visibility_failure_suppresses_both_values_but_sql_support_survives(self):
        self.five_peers()
        self.support(self.business_a, self.tags[0])
        with patch.object(VisibilityEventService, "get_business_attention_metrics", side_effect=VisibilityTrackingUnavailable()):
            report = self.report()
        for name in ("profile_visits", "saves"):
            self.assertEqual(report["metrics"][name]["status"], "unavailable")
            self.assertIsNone(report["metrics"][name]["merchant_value"])
            self.assertIsNone(report["metrics"][name]["peer_median"])
        self.assertEqual(report["metrics"]["specialty_support"]["merchant_value"], 1)

    def test_specialty_comparison_uses_period_valid_rows_on_active_links_not_cached_totals(self):
        peers = self.five_peers()
        self.support(self.business_a, self.tags[0])
        self.support(self.business_a, self.tags[1], timestamp=self.period.start - timedelta(seconds=1))
        self.support(self.business_a, self.tags[2], active=False)
        self.support(peers[0], self.tags[0], valid=False)
        self.support(peers[1], self.tags[0], timestamp=self.period.end)
        report = self.report()
        metric = report["metrics"]["specialty_support"]
        self.assertEqual(metric["merchant_value"], 1)
        self.assertEqual(metric["peer_median"], 0)
        self.assertEqual(metric["label"], "Vouches added and still valid")

    def test_positive_share_is_median_of_business_shares_not_pooled_platform_share(self):
        peers = self.five_peers()
        self.sentiment(self.business_a, 4, 5)
        for business, positive, count in zip(peers, (0, 1, 2, 4, 20), (5, 5, 5, 5, 20), strict=True):
            self.sentiment(business, positive, count)
        metric = self.report()["metrics"]["positive_review_share"]
        self.assertEqual(metric["merchant_value"], 80)
        self.assertEqual(metric["peer_median"], 40)
        self.assertEqual(metric["eligible_peer_sample_size"], 5)
        self.assertEqual(metric["merchant_classified_review_count"], 5)

    def test_fewer_than_five_review_eligible_peers_suppresses_sentiment_without_group_switch(self):
        peers = self.five_peers()
        self.sentiment(self.business_a, 5, 5)
        for business in peers[:4]:
            self.sentiment(business, 5, 5)
        # More sentiment-rich cluster peers must not trigger metric-specific fallback.
        other_category = self.other_category()
        for _ in range(5):
            self.sentiment(self.peer(category=other_category), 5, 5)
        report = self.report()
        self.assertEqual(report["group"]["scope"], "category")
        metric = report["metrics"]["positive_review_share"]
        self.assertEqual(metric["reason"], "peer_sentiment_sample_too_small")
        self.assertEqual(metric["eligible_peer_sample_size"], 4)
        self.assertIsNone(metric["merchant_value"])
        self.assertIsNone(metric["peer_median"])

    def test_merchant_minimum_and_classified_period_published_scope(self):
        peers = self.five_peers()
        for business in peers:
            self.sentiment(business, 5, 5)
        self.sentiment(self.business_a, 4, 4)
        for timestamp, status, label in (
            (self.period.start, Review.ReviewStatus.PUBLISHED, ""),
            (self.period.end, Review.ReviewStatus.PUBLISHED, "positive"),
            (self.period.start, Review.ReviewStatus.REJECTED, "positive"),
        ):
            review = self.review(timestamp, status=status)
            Review.objects.filter(pk=review.pk).update(REVW_SENTIMENT_LABEL=label)
        self.assertEqual(self.report()["metrics"]["positive_review_share"]["reason"], "merchant_sentiment_sample_too_small")
        self.sentiment(self.business_a, 0, 1)
        metric = self.report()["metrics"]["positive_review_share"]
        self.assertEqual(metric["merchant_value"], 80)
        self.assertEqual(metric["position"], "below_median")

    def test_batch_sql_aggregations_use_one_query_each_without_peer_identity_output(self):
        peers = self.five_peers()
        ids = [self.business_a.pk, *[business.pk for business in peers]]
        with self.assertNumQueries(1):
            PeerAnalyticsService.specialty_counts(ids, self.period)
        with self.assertNumQueries(1):
            PeerAnalyticsService.sentiment_counts(ids, self.period)
        text = str(self.report())
        for business in peers:
            self.assertNotIn(business.BUSN_NAME, text)
        for forbidden in ("peer_ids", "explorer_id", "USER_ID", "review_ids"):
            self.assertNotIn(forbidden, text)
