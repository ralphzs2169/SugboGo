from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase

from apps.business.services.visibility_event_service import VisibilityEventService, VisibilityTrackingUnavailable
from apps.reviews.models import BusinessReviewSummary
from apps.reviews.services.business_review_insights_service import BusinessReviewInsightsService

from ..merchant_report_service import MerchantReportService
from .peer_fixtures import PeerAnalyticsFixtures


class MerchantReportServiceTests(PeerAnalyticsFixtures, TestCase):
    def report(self):
        return MerchantReportService.get_report(self.merchant_a, self.period)

    def test_report_composes_all_sections_with_one_period_and_cutoff(self):
        report = self.report()
        self.assertEqual(set(report["results"]["premium"]),
                         {"visibility", "pocket", "specialties", "review_insights", "review_performance"})
        for section in (report["results"]["standard"], *report["results"]["premium"].values(), report["peers"]):
            self.assertEqual(section["business"]["id"], self.business_a.pk)
            self.assertEqual(section["meta"]["generated_at"], self.NOW.isoformat())
            self.assertEqual(section["meta"]["period"]["start"], self.period.start.isoformat())
            self.assertEqual(section["meta"]["period"]["end_exclusive"], self.period.end.isoformat())
        self.assertEqual(report["results"]["standard"]["reviews"]["reply_cutoff"], self.NOW.isoformat())
        self.assertEqual(report["results"]["premium"]["review_performance"]["reply_cutoff"], self.NOW.isoformat())
        self.assertEqual(report["snapshot_as_of"], self.NOW.isoformat())

    def test_insufficient_peers_do_not_hide_owned_results_or_fabricate_changes(self):
        self.event("PROFILE_VISIT", 1, self.period.start)
        report = self.report()
        self.assertEqual(report["peers"]["status"], "insufficient_data")
        self.assertEqual(report["results"]["standard"]["profile_visits"], 1)
        self.assertIsNone(report["changes"]["visibility"]["profile_visits"]["value"])
        self.assertIn("INSUFFICIENT_PEERS", {finding["code"] for finding in report["key_findings"]})

    def test_unanswered_action_is_whole_current_backlog_and_removed_after_reply(self):
        review = self.review(self.period.start - timedelta(days=10))
        report = self.report()
        self.assertIn("UNANSWERED_REVIEWS", {action["code"] for action in report["recommended_actions"]})
        self.assertEqual(report["results"]["premium"]["review_performance"]["current"]["published_review_count"], 0)
        self.reply(review, self.NOW)
        self.assertNotIn("UNANSWERED_REVIEWS", {finding["code"] for finding in self.report()["key_findings"]})

    def test_insufficient_sentiment_action_disappears_at_existing_threshold(self):
        self.assertIn("INSUFFICIENT_SENTIMENT", {action["code"] for action in self.report()["recommended_actions"]})
        self.sentiment(self.business_a, 4, 5)
        self.assertNotIn("INSUFFICIENT_SENTIMENT", {finding["code"] for finding in self.report()["key_findings"]})

    def test_outdated_stored_insights_retain_state_and_never_trigger_refresh(self):
        summary = BusinessReviewSummary.objects.create(
            BUSN_ID=self.business_a, BRSU_GENERATION_STATE="outdated", BRSU_NARRATIVE="Stored narrative",
        )
        before = summary.BRSU_UPDATED_AT
        with patch.object(BusinessReviewInsightsService, "refresh", side_effect=AssertionError("LLM refresh attempted")):
            report = self.report()
        summary.refresh_from_db()
        self.assertEqual(summary.BRSU_UPDATED_AT, before)
        self.assertIn("STORED_INSIGHTS_OUTDATED", {finding["code"] for finding in report["key_findings"]})

    def test_tracking_outage_retains_sql_and_never_produces_performance_advice(self):
        with patch.object(VisibilityEventService, "get_analytics_totals", side_effect=VisibilityTrackingUnavailable()), patch.object(
            VisibilityEventService, "count_analytics_explorers", side_effect=VisibilityTrackingUnavailable(),
        ), patch.object(VisibilityEventService, "get_analytics_series", side_effect=VisibilityTrackingUnavailable()), patch.object(
            VisibilityEventService, "get_analytics_explorer_series", side_effect=VisibilityTrackingUnavailable(),
        ):
            report = self.report()
        self.assertIsNone(report["results"]["standard"]["profile_visits"])
        self.assertEqual(report["results"]["standard"]["reviews"]["current_published_total"], 0)
        self.assertIn("VISIBILITY_UNAVAILABLE", {finding["code"] for finding in report["key_findings"]})
        self.assertFalse(any("VISIBILITY" in action["code"] for action in report["recommended_actions"]))

    def test_findings_are_deterministic_and_never_expose_peer_names(self):
        peers = self.five_peers()
        first = self.report()
        second = self.report()
        self.assertEqual(first["key_findings"], second["key_findings"])
        self.assertEqual(first["recommended_actions"], second["recommended_actions"])
        for business in peers:
            self.assertNotIn(business.BUSN_NAME, str(first))

    def test_peer_only_tracking_failure_is_disclosed_without_hiding_owned_observations(self):
        self.five_peers()
        self.event("PROFILE_VISIT", 1, self.period.start)
        with patch.object(VisibilityEventService, "get_business_attention_metrics", side_effect=VisibilityTrackingUnavailable()):
            report = self.report()
        self.assertEqual(report["results"]["standard"]["profile_visits"], 1)
        self.assertIsNone(report["peers"]["metrics"]["profile_visits"]["peer_median"])
        self.assertIn("VISIBILITY_UNAVAILABLE", {finding["code"] for finding in report["key_findings"]})
