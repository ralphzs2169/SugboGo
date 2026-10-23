"""Configured rules reach existing analytics and stored generation without changing raw metrics."""

import json
from datetime import timedelta
from unittest.mock import patch

from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from apps.admin_operations.analytics.services.business_attention_service import BusinessAttentionService
from apps.admin_operations.analytics.services.merchant_application_analytics_service import MerchantApplicationAnalyticsService
from apps.business.models import Business
from apps.business.services.visibility_event_service import VisibilityEventService
from apps.explorer_operations.explore_businesses.serializers.review_insights_serializers import BusinessReviewInsightsSerializer
from apps.merchant_operations.merchant_analytics.services.peer_analytics_service import PeerAnalyticsService
from apps.reviews.models import BusinessReviewSummary
from apps.reviews.services.review_keyword_service import ReviewKeywordService
from apps.reviews.services.tests.test_business_review_summary_service import SummaryFixtureMixin
from apps.shared.analytics.date_ranges import resolve_period
from apps.shared.analytics.policy import with_policy_snapshot

from ..analytics_policy_service import AnalyticsPolicyService
from .test_analytics_policy_service import create_policy_admin


@override_settings(GEMINI_API_KEY="test-only-key", GEMINI_KEYWORD_MODEL="test-model")
class AnalyticsPolicyConsumerTests(SummaryFixtureMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.business = cls.create_business()
        cls.reviews = [cls.create_review(cls.business, index) for index in range(5)]
        cls.summary = BusinessReviewSummary.objects.create(BUSN_ID=cls.business,
            BRSU_POSITIVE_COUNT=5, BRSU_CLASSIFIED_REVIEW_COUNT=5, BRSU_REVIEW_COUNT=5,
            BRSU_ELIGIBLE_REVIEW_COUNT=5, BRSU_ANALYZED_REVIEW_COUNT=5,
            BRSU_NARRATIVE="Stored friendly service summary.",
            BRSU_GENERATION_STATE=BusinessReviewSummary.GenerationState.READY,
            BRSU_KEYWORD_TAGS=[{"text": "friendly service", "count": 2, "review_ids": []}])
        cls.actor = create_policy_admin()

    def update(self, values):
        return AnalyticsPolicyService.update(actor=self.actor, expected_version=1,
            reason="Consumer policy acceptance.", values=values)

    def provider_response(self):
        ids = [review.pk for review in self.reviews[:2]]
        return json.dumps({"narrative": "Visitors mention friendly service.", "narrative_review_ids": ids,
                           "tags": [{"text": "friendly service", "count": 2, "review_ids": ids}]})

    def test_sentiment_rule_changes_conclusion_not_classified_counts_or_shares(self):
        self.assertEqual(self.summary.overall_vibe, "mostly_positive")
        self.update({"sentiment_min_classified_reviews": 6})
        data = BusinessReviewInsightsSerializer(self.summary).data
        self.assertFalse(data["has_sufficient_sentiment_data"])
        self.assertIsNone(data["overall_vibe"])
        self.assertEqual(data["sentiment"]["positive"], {"count": 5, "percentage": 100.0})

    def test_narrative_gate_is_read_only_and_legacy_version_is_not_backfilled(self):
        self.update({"narrative_min_eligible_reviews": 6})
        with CaptureQueriesContext(connection) as queries:
            data = BusinessReviewInsightsSerializer(self.summary).data
        self.assertFalse(data["content_available"])
        self.assertIsNone(data["narrative"])
        self.assertIn("6", data["state_message"])
        self.assertIsNone(data["policy"]["generated_version"])
        self.assertEqual(data["policy"]["provenance"], "legacy_unknown")
        self.assertTrue(all(query["sql"].lstrip().upper().startswith("SELECT") for query in queries))
        self.summary.refresh_from_db()
        self.assertEqual(self.summary.BRSU_NARRATIVE, "")
        self.assertIsNone(self.summary.BRSU_GENERATION_POLICY_VERSION)

    def test_higher_mention_rule_filters_stored_mentions_and_labels_original_content(self):
        self.summary.BRSU_GENERATION_POLICY_VERSION = 1
        self.summary.BRSU_GENERATION_POLICY_VALUES = AnalyticsPolicyService.read().review_rules
        self.summary.save()
        self.update({"mention_min_supporting_reviews": 3})
        data = BusinessReviewInsightsSerializer(self.summary).data
        self.assertEqual(data["frequent_mentions"], [])
        self.assertTrue(data["content_available"])
        self.assertEqual(data["state"], "outdated")
        self.assertEqual(data["policy"]["current_version"], 2)
        self.assertEqual(data["policy"]["generated_version"], 1)
        self.assertFalse(data["policy"]["generation_rules_match"])

    def test_successful_background_generation_records_its_policy_snapshot(self):
        with patch.object(ReviewKeywordService, "_generate", return_value=self.provider_response()):
            result = with_policy_snapshot(ReviewKeywordService._refresh_locked)(self.business.pk, timezone.now())
        self.assertEqual(result, "updated")
        self.summary.refresh_from_db()
        self.assertEqual(self.summary.BRSU_GENERATION_POLICY_VERSION, 1)
        self.assertEqual(self.summary.BRSU_GENERATION_POLICY_VALUES, AnalyticsPolicyService.read().review_rules)

    def test_inflight_generation_does_not_publish_after_its_review_rules_change(self):
        def generate(_reviews):
            self.update({"mention_min_supporting_reviews": 3})
            return self.provider_response()

        with patch.object(ReviewKeywordService, "_generate", side_effect=generate):
            result = with_policy_snapshot(ReviewKeywordService._refresh_locked)(self.business.pk, timezone.now())
        self.assertEqual(result, "stale")
        self.summary.refresh_from_db()
        self.assertNotEqual(self.summary.BRSU_NARRATIVE, "Visitors mention friendly service.")
        self.assertIsNone(self.summary.BRSU_GENERATION_POLICY_VERSION)

    def test_peer_floor_change_suppresses_an_existing_five_peer_group_before_reads(self):
        for index in range(1, 6):
            peer = self.create_business(index)
            Business.objects.filter(pk=peer.pk).update(CTGRY_ID=self.business.CTGRY_ID)
        period = resolve_period(now=timezone.now())
        self.update({"peer_min_businesses": 6})
        with patch.object(VisibilityEventService, "get_business_attention_metrics") as tracking:
            report = PeerAnalyticsService.get_report(self.business.USER_ID, period)
        self.assertEqual(report["group"]["size"], 5)
        self.assertEqual(report["group"]["minimum_size"], 6)
        self.assertEqual(report["status"], "insufficient_data")
        self.assertTrue(all(metric["peer_median"] is None for metric in report["metrics"].values()))
        tracking.assert_not_called()

    def test_low_exposure_rule_changes_selection_but_retains_fixed_window_and_counts(self):
        now = timezone.now()
        Business.objects.filter(pk=self.business.pk).update(BUSN_CREATED_AT=now - timedelta(days=60))
        period = resolve_period(now=now)
        counts = {self.business.pk: {"profile_visits": 5, "saves": 0, "distinct_savers": 0}}
        support = {self.business.pk: {"valid_vouches": 5, "distinct_supporters": 5}}
        with patch.object(VisibilityEventService, "get_business_attention_metrics", return_value=counts), \
                patch.object(BusinessAttentionService, "specialty_support", return_value=support):
            before = BusinessAttentionService.get_report(period, low_exposure=True)
            self.update({"low_exposure_max_profile_visits": 5})
            after = BusinessAttentionService.get_report(period, low_exposure=True)
        self.assertEqual(before["items"], [])
        self.assertEqual(after["items"][0]["profile_visits"], 5)
        self.assertEqual(after["thresholds"]["window_days"], 30)
        self.assertTrue(after["thresholds"]["excludes_today"])
        self.assertEqual(after["thresholds"]["policy_version"], 2)

    def test_onboarding_rule_changes_sample_eligibility_without_changing_populations(self):
        self.assertIsNotNone(MerchantApplicationAnalyticsService.calculate_trend(12, 10, 12, 10))
        self.update({"onboarding_comparison_min_sample": 20})
        self.assertIsNone(MerchantApplicationAnalyticsService.calculate_trend(12, 10, 12, 10))
