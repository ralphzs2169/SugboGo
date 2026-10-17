from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from pymongo.errors import AutoReconnect
from rest_framework.exceptions import NotFound

from apps.business.models import BusinessPocket, BusinessVouch
from apps.business.services.visibility_event_service import VisibilityEventService, VisibilityTrackingUnavailable
from apps.reviews.models import Review, ReviewReply
from apps.shared.analytics.date_ranges import resolve_period

from ..standard_analytics_service import StandardAnalyticsService
from .fixtures import MerchantAnalyticsFixtures


class StandardAnalyticsServiceTests(MerchantAnalyticsFixtures, TestCase):
    def report(self, period=None):
        return StandardAnalyticsService.get_report(self.merchant_a, period or self.period)

    def test_empty_owned_business_has_zero_sql_and_recorded_counts_but_no_reply_rate(self):
        report = self.report()
        self.assertEqual(report["profile_visits"], 0)
        self.assertEqual(report["distinct_profile_visitors"], 0)
        self.assertEqual(report["saves_in_period"], 0)
        self.assertEqual(report["current_pocket_holders"], 0)
        self.assertIsNone(report["reviews"]["reply_rate"])
        self.assertEqual(report["reviews"]["current_published_total"], 0)
        self.assertEqual(len(report["specialty_support"]), 2)
        self.assertTrue(all(row["valid_vouches"] == row["distinct_supporters"] == 0 for row in report["specialty_support"]))
        self.assertIn("coverage_unverified", report["sources"]["visibility"]["partial_reasons"])

    def test_owned_business_only_with_period_wide_profile_uniques_and_half_open_edges(self):
        for explorer, timestamp in (
            (1, self.period.start), (1, self.period.start + timedelta(days=1)),
            (2, self.NOW - timedelta(hours=1)), (9, self.period.start - timedelta(microseconds=1)),
            (9, self.period.end),
        ):
            self.event("PROFILE_VISIT", explorer, timestamp)
        self.event("PROFILE_VISIT", 3, self.period.start, self.business_b)
        self.event("IMPRESSION", 4, self.period.start)
        report = self.report()
        self.assertEqual(report["profile_visits"], 3)
        self.assertEqual(report["distinct_profile_visitors"], 2)
        self.assertNotIn("impressions", report)
        other = StandardAnalyticsService.get_report(self.merchant_b, self.period)
        self.assertEqual(other["profile_visits"], 1)
        self.assertEqual(other["business"]["id"], self.business_b.pk)

    def test_recorded_saves_and_current_holders_remain_separate_after_unsave(self):
        for offset in (2, 3):
            self.event("SAVE", 1, self.period.start + timedelta(days=offset))
        pocket = BusinessPocket.objects.create(BUSN_ID=self.business_a, USER_ID=self.supporter_a)
        BusinessPocket.objects.filter(pk=pocket.pk).update(PCKT_CREATED_AT=self.NOW - timedelta(days=1))
        self.assertEqual(self.report()["current_pocket_holders"], 1)
        pocket.delete()
        report = self.report()
        self.assertEqual(report["saves_in_period"], 2)
        self.assertEqual(report["current_pocket_holders"], 0)

    def test_valid_current_specialties_ignore_cached_counts_and_inactive_or_invalid_evidence(self):
        for tag, supporter, valid in (
            (self.tags[0], self.supporter_a, True), (self.tags[1], self.supporter_a, True),
            (self.tags[0], self.supporter_b, False), (self.tags[2], self.supporter_b, True),
        ):
            vouch = BusinessVouch.objects.create(
                BUSN_ID=self.business_a, TAG_ID=tag, USER_ID=supporter,
                VOUCH_REPUTATION_SNAPSHOT=supporter.USER_REPUTATION,
                VOUCH_EVIDENCE_IS_VALID=valid, VOUCH_FLAG_SUSPICIOUS=True,
            )
            BusinessVouch.objects.filter(pk=vouch.pk).update(VOUCH_CREATED_AT=self.NOW - timedelta(days=1))
        report = self.report()
        self.assertEqual([(row["valid_vouches"], row["distinct_supporters"]) for row in report["specialty_support"]], [(1, 1), (1, 1)])
        self.assertEqual({row["specialty_id"] for row in report["specialty_support"]}, {tag.pk for tag in self.tags[:2]})

    def test_published_cohort_and_whole_unanswered_backlog_use_declared_reply_cutoff(self):
        answered = self.review(self.NOW - timedelta(days=2))
        self.reply(answered, self.NOW - timedelta(days=1))
        self.review(self.period.start - timedelta(days=1))
        self.review(self.NOW - timedelta(days=3))
        self.review(self.NOW - timedelta(days=4), Review.ReviewStatus.REJECTED)
        future_reply = self.review(self.NOW - timedelta(days=1))
        self.reply(future_reply, self.NOW + timedelta(days=1))
        self.review(self.NOW + timedelta(days=1))
        self.review(self.NOW - timedelta(days=1), business=self.business_b)
        result = self.report()["reviews"]
        self.assertEqual(result["current_published_total"], 4)
        self.assertEqual(result["current_unanswered_published"], 3)
        self.assertEqual(result["new_published_in_period"], 3)
        self.assertEqual(result["period_replied_published"], 1)
        self.assertEqual(result["reply_rate"], 33.3)
        self.assertEqual(result["reply_cutoff"], self.NOW.isoformat())
        self.assertEqual(result["excluded_reply_timestamp_count"], 1)

    def test_reply_after_selected_end_but_before_generation_counts_for_older_cohort(self):
        period = resolve_period(preset="custom", start_date="2026-09-20", end_date="2026-09-22", now=self.NOW)
        review = self.review(period.start + timedelta(hours=1))
        self.reply(review, period.end + timedelta(days=1))
        result = self.report(period)["reviews"]
        self.assertEqual(result["reply_rate"], 100)
        self.assertEqual(result["current_unanswered_published"], 0)

    def test_review_and_reply_deletion_or_moderation_revises_current_state(self):
        review = self.review(self.NOW - timedelta(days=1))
        reply = self.reply(review, self.NOW)
        self.assertEqual(self.report()["reviews"]["reply_rate"], 100)
        ReviewReply.objects.filter(pk=reply.pk).delete()
        self.assertEqual(self.report()["reviews"]["reply_rate"], 0)
        Review.objects.filter(pk=review.pk).update(REVW_STATUS=Review.ReviewStatus.UNDER_REVIEW)
        self.assertIsNone(self.report()["reviews"]["reply_rate"])
        review.delete()
        self.assertEqual(self.report()["reviews"]["current_published_total"], 0)

    def test_negative_reply_timestamp_is_excluded_and_flagged(self):
        review = self.review(self.NOW - timedelta(days=1))
        self.reply(review, review.REVW_CREATED_AT - timedelta(hours=1))
        result = self.report()
        self.assertEqual(result["reviews"]["reply_rate"], 0)
        self.assertIn("reply_timestamp_anomalies", result["sources"]["domain"]["partial_reasons"])

    def test_real_mongo_read_failure_preserves_sql_without_fabricating_zeros(self):
        with patch.object(self.collection, "aggregate", side_effect=AutoReconnect("Mongo unavailable")):
            result = self.report()
        self.assertIsNone(result["profile_visits"])
        self.assertIsNone(result["saves_in_period"])
        self.assertIsNone(result["distinct_profile_visitors"])
        self.assertEqual(result["current_pocket_holders"], 0)
        self.assertEqual(result["sources"]["visibility"]["availability"], "unavailable")
        self.assertEqual(result["meta"]["availability"], "partial")

    def test_partial_tracking_preserves_successful_counts(self):
        self.event("PROFILE_VISIT", 1, self.period.start)
        with patch.object(VisibilityEventService, "count_analytics_explorers", side_effect=VisibilityTrackingUnavailable()):
            result = self.report()
        self.assertEqual(result["profile_visits"], 1)
        self.assertIsNone(result["distinct_profile_visitors"])
        self.assertEqual(result["sources"]["visibility"]["availability"], "partial")

    def test_merchant_without_owned_business_gets_not_found(self):
        with self.assertRaises(NotFound):
            StandardAnalyticsService.get_report(self.user("no-business", role="merchant"), self.period)

    def test_standard_metadata_omits_prior_boundaries_everywhere(self):
        report = self.report()
        for meta in (report["meta"], *report["sources"].values()):
            self.assertEqual(set(meta["period"]), {"timezone", "start_date", "end_date", "start", "end_exclusive"})
