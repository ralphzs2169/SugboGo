from datetime import timedelta
from unittest.mock import patch
from uuid import uuid4

from django.utils import timezone
from rest_framework.test import APITestCase

from apps.admin_operations.business_management.services.manage_business_service import (
    BusinessService,
)
from apps.admin_operations.system_configuration.services.analytics_policy_service import (
    AnalyticsPolicyService,
)
from apps.explorer_operations.explore_businesses.serializers.review_insights_serializers import (
    BusinessReviewInsightsSerializer,
    ReviewInsightRegenerationSerializer,
)
from apps.explorer_operations.explore_businesses.services.explore_business_service import (
    ExploreBusinessService,
)
from apps.reviews.models import BusinessReviewSummary, ReviewInsightRegeneration
from apps.reviews.services.tests.test_business_review_summary_service import (
    SummaryFixtureMixin,
)
from apps.shared.analytics.policy import current_policy, policy_scope


class ReviewInsightRegenerationViewsTests(SummaryFixtureMixin, APITestCase):
    def setUp(self):
        self.business = self.create_business()
        self.client.force_authenticate(self.business.USER_ID)
        self.url = f"/api/explorer/explore/businesses/{self.business.pk}/"
        self.now = timezone.now()
        self.enterContext(patch("django.utils.timezone.now", return_value=self.now))

    def summary(
        self,
        **overrides,
    ):
        values = {
            "BUSN_ID": self.business,
            "BRSU_GENERATION_STATE": "ready",
            "BRSU_NARRATIVE": "Visitors mention friendly service.",
            "BRSU_GENERATED_AT": self.now - timedelta(minutes=5),
            "BRSU_COVERAGE_START": self.now - timedelta(days=30),
            "BRSU_COVERAGE_END": self.now - timedelta(minutes=5),
            "BRSU_ELIGIBLE_REVIEW_COUNT": 5,
            "BRSU_KEYWORDS_FINGERPRINT": "completed-fingerprint",
            "BRSU_GENERATION_POLICY_VERSION": 1,
            "BRSU_GENERATION_POLICY_VALUES": AnalyticsPolicyService.read().review_rules,
            "BRSU_SUPPORTING_REVIEW_REFERENCES": {"narrative_review_ids": [1, 2]},
            "BRSU_KEYWORD_TAGS": [{"text": "friendly service", "count": 2}],
        }
        values.update(overrides)
        return BusinessReviewSummary.objects.create(**values)

    def work(
        self,
        **overrides,
    ):
        values = {
            "BUSN_ID": self.business,
            "RIRG_REQUESTED_REVISION": 2,
            "RIRG_OBSERVED_REVISION": 2,
            "RIRG_COMPLETED_REVISION": 1,
            "RIRG_FIRST_CHANGED_AT": self.now - timedelta(seconds=60),
            "RIRG_LATEST_CHANGED_AT": self.now - timedelta(seconds=60),
            "RIRG_DUE_AT": self.now + timedelta(seconds=60),
            "RIRG_INPUT_FINGERPRINT": "requested-fingerprint",
            "RIRG_RECHECK_AT": self.now + timedelta(days=1),
        }
        values.update(overrides)
        return ReviewInsightRegeneration.objects.create(**values)

    def completed_work(
        self,
        **overrides,
    ):
        values = {
            "RIRG_REQUESTED_REVISION": 1,
            "RIRG_OBSERVED_REVISION": 1,
            "RIRG_COMPLETED_REVISION": 1,
            "RIRG_FIRST_CHANGED_AT": None,
            "RIRG_LATEST_CHANGED_AT": None,
            "RIRG_DUE_AT": None,
            "RIRG_INPUT_FINGERPRINT": "completed-fingerprint",
        }
        values.update(overrides)
        return self.work(**values)

    def detail(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        return response.data["data"]

    def test_missing_summary_and_work_stay_null_and_untracked_without_writes(self):
        data = self.detail()
        self.assertIsNone(data["review_insights"])
        self.assertEqual(data["review_insight_regeneration"], {
            "status": "untracked",
            "is_outstanding": False,
            "requested_revision": None,
            "completed_revision": None,
            "run_after": None,
            "content_available": False,
            "content_is_current": False,
        })
        self.assertFalse(BusinessReviewSummary.objects.exists())
        self.assertFalse(ReviewInsightRegeneration.objects.exists())

    def test_legacy_summary_remains_visible_without_claiming_a_completed_revision(self):
        self.summary(
            BRSU_GENERATION_POLICY_VALUES={},
            BRSU_GENERATION_POLICY_VERSION=None,
        )
        data = self.detail()
        progress = data["review_insight_regeneration"]
        self.assertEqual(progress, data["review_insights"]["regeneration"])
        self.assertTrue(progress["content_available"])
        self.assertFalse(progress["content_is_current"])
        self.assertIsNone(progress["completed_revision"])
        self.assertEqual(data["review_insights"]["state"], "ready")
        self.assertFalse(ReviewInsightRegeneration.objects.exists())

    def test_demand_is_observable_before_a_summary_exists(self):
        self.work()
        data = self.detail()
        self.assertIsNone(data["review_insights"])
        self.assertEqual(data["review_insight_regeneration"]["status"], "scheduled")
        self.assertEqual(data["review_insight_regeneration"]["requested_revision"], 2)

    def test_scheduled_demand_retains_safe_content_and_cannot_report_ready(self):
        self.summary()
        self.work()
        data = self.detail()
        progress = data["review_insight_regeneration"]
        self.assertEqual(progress["status"], "scheduled")
        self.assertTrue(progress["is_outstanding"])
        self.assertEqual(progress["completed_revision"], 1)
        self.assertEqual(
            progress["run_after"],
            (self.now + timedelta(seconds=60)).isoformat().replace("+00:00", "Z"),
        )
        self.assertTrue(progress["content_available"])
        self.assertFalse(progress["content_is_current"])
        self.assertEqual(data["review_insights"]["state"], "outdated")

    def test_active_generation_exposes_safe_retained_bundle_without_claiming_freshness(self):
        self.summary(BRSU_GENERATION_STATE="pending")
        self.work(
            RIRG_ATTEMPT_TOKEN=uuid4(),
            RIRG_CLAIMED_REVISION=2,
            RIRG_LEASE_EXPIRES_AT=self.now + timedelta(seconds=180),
        )
        data = self.detail()
        progress = data["review_insight_regeneration"]
        self.assertEqual(progress["status"], "processing")
        self.assertIsNone(progress["run_after"])
        self.assertTrue(progress["content_available"])
        self.assertFalse(progress["content_is_current"])
        self.assertEqual(
            data["review_insights"]["narrative"],
            "Visitors mention friendly service.",
        )
        self.assertEqual(data["review_insights"]["frequent_mentions"], [
            {"label": "friendly service", "count": 2},
        ])

    def test_pending_legacy_or_unproven_content_remains_hidden(self):
        self.summary(
            BRSU_GENERATION_STATE="pending",
            BRSU_GENERATION_POLICY_VALUES={},
        )
        self.work()
        data = self.detail()
        self.assertFalse(data["review_insight_regeneration"]["content_available"])
        self.assertIsNone(data["review_insights"]["narrative"])

    def test_processing_without_supporting_provenance_does_not_expose_old_text(self):
        self.summary(
            BRSU_GENERATION_STATE="pending",
            BRSU_SUPPORTING_REVIEW_REFERENCES={},
        )
        self.work(
            RIRG_ATTEMPT_TOKEN=uuid4(),
            RIRG_CLAIMED_REVISION=2,
            RIRG_LEASE_EXPIRES_AT=self.now + timedelta(seconds=180),
        )
        data = self.detail()
        self.assertEqual(data["review_insight_regeneration"]["status"], "processing")
        self.assertFalse(data["review_insight_regeneration"]["content_available"])
        self.assertIsNone(data["review_insights"]["narrative"])

    def test_invalidated_supporting_evidence_remains_hidden(self):
        self.summary(
            BRSU_GENERATION_STATE="outdated",
            BRSU_NARRATIVE="",
            BRSU_GENERATED_AT=None,
            BRSU_SUPPORTING_REVIEW_REFERENCES={},
            BRSU_KEYWORD_TAGS=[],
        )
        self.work()
        data = self.detail()
        self.assertFalse(data["review_insight_regeneration"]["content_available"])
        self.assertIsNone(data["review_insights"]["narrative"])
        self.assertEqual(data["review_insights"]["frequent_mentions"], [])

    def test_retry_wait_preserves_safe_content_and_uses_effective_backoff_deadline(self):
        self.summary(BRSU_GENERATION_STATE="outdated")
        self.work(
            RIRG_RETRY_NOT_BEFORE=self.now + timedelta(seconds=240),
            RIRG_LAST_ERROR="provider_unavailable",
        )
        data = self.detail()
        progress = data["review_insight_regeneration"]
        self.assertEqual(progress["status"], "retry_wait")
        self.assertEqual(
            progress["run_after"],
            (self.now + timedelta(seconds=240)).isoformat().replace("+00:00", "Z"),
        )
        self.assertTrue(progress["content_available"])
        self.assertNotIn("provider_unavailable", str(data))

    def test_elapsed_retry_and_expired_ownership_are_scheduled_without_read_recovery(self):
        self.summary(BRSU_GENERATION_STATE="pending")
        self.work(
            RIRG_ATTEMPT_TOKEN=uuid4(),
            RIRG_CLAIMED_REVISION=2,
            RIRG_LEASE_EXPIRES_AT=self.now - timedelta(seconds=1),
            RIRG_RETRY_NOT_BEFORE=self.now - timedelta(seconds=1),
        )
        before = ReviewInsightRegeneration.objects.values().get()
        progress = self.detail()["review_insight_regeneration"]
        self.assertEqual(progress["status"], "scheduled")
        self.assertEqual(ReviewInsightRegeneration.objects.values().get(), before)

    def test_retry_deadline_cannot_shorten_the_quiet_period(self):
        self.work(RIRG_RETRY_NOT_BEFORE=self.now + timedelta(seconds=30))
        progress = self.detail()["review_insight_regeneration"]
        self.assertEqual(progress["status"], "retry_wait")
        self.assertEqual(
            progress["run_after"],
            (self.now + timedelta(seconds=60)).isoformat().replace("+00:00", "Z"),
        )

    def test_superseded_owner_does_not_report_newest_revision_as_processing(self):
        self.summary(BRSU_GENERATION_STATE="outdated")
        self.work(
            RIRG_REQUESTED_REVISION=3,
            RIRG_ATTEMPT_TOKEN=uuid4(),
            RIRG_CLAIMED_REVISION=2,
            RIRG_LEASE_EXPIRES_AT=self.now + timedelta(seconds=180),
        )
        progress = self.detail()["review_insight_regeneration"]
        self.assertEqual(progress["status"], "scheduled")
        self.assertIsNone(progress["run_after"])

    def test_unobserved_committed_request_has_no_invented_deadline(self):
        self.work(
            RIRG_OBSERVED_REVISION=1,
            RIRG_FIRST_CHANGED_AT=None,
            RIRG_LATEST_CHANGED_AT=None,
            RIRG_DUE_AT=None,
        )
        progress = self.detail()["review_insight_regeneration"]
        self.assertTrue(progress["is_outstanding"])
        self.assertEqual(progress["status"], "scheduled")
        self.assertIsNone(progress["run_after"])

    def test_completed_current_revision_preserves_generation_and_coverage_timestamps(self):
        summary = self.summary()
        self.completed_work()
        data = self.detail()
        progress = data["review_insight_regeneration"]
        self.assertEqual(progress["status"], "idle")
        self.assertFalse(progress["is_outstanding"])
        self.assertTrue(progress["content_is_current"])
        self.assertEqual(data["review_insights"]["regeneration"], progress)
        summary.refresh_from_db()
        self.assertEqual(summary.BRSU_GENERATED_AT, self.now - timedelta(minutes=5))
        self.assertEqual(summary.BRSU_COVERAGE_END, self.now - timedelta(minutes=5))

    def test_completed_insufficient_evaluation_is_idle_without_current_content(self):
        self.summary(
            BRSU_GENERATION_STATE="insufficient_reviews",
            BRSU_ELIGIBLE_REVIEW_COUNT=4,
        )
        self.completed_work()
        data = self.detail()
        progress = data["review_insight_regeneration"]
        self.assertEqual(progress["status"], "idle")
        self.assertEqual(progress["completed_revision"], 1)
        self.assertFalse(progress["content_available"])
        self.assertFalse(progress["content_is_current"])
        self.assertIsNone(data["review_insights"]["narrative"])

    def test_expired_evidence_is_unavailable_even_before_reconciliation_requests_work(self):
        self.summary()
        self.completed_work(RIRG_RECHECK_AT=self.now)
        data = self.detail()
        progress = data["review_insight_regeneration"]
        self.assertEqual(progress["status"], "idle")
        self.assertFalse(progress["content_is_current"])
        self.assertFalse(progress["content_available"])
        self.assertEqual(data["review_insights"]["state"], "outdated")
        self.assertIsNone(data["review_insights"]["narrative"])

    def test_matching_revision_without_matching_summary_fingerprint_is_not_current(self):
        self.summary(BRSU_KEYWORDS_FINGERPRINT="different-fingerprint")
        self.completed_work()
        progress = self.detail()["review_insight_regeneration"]
        self.assertTrue(progress["content_available"])
        self.assertFalse(progress["content_is_current"])

    def test_idle_zero_revisions_do_not_attribute_legacy_content_to_an_evaluation(self):
        self.summary()
        self.completed_work(
            RIRG_REQUESTED_REVISION=0,
            RIRG_OBSERVED_REVISION=0,
            RIRG_COMPLETED_REVISION=0,
        )
        progress = self.detail()["review_insight_regeneration"]
        self.assertTrue(progress["content_available"])
        self.assertFalse(progress["content_is_current"])
        self.assertEqual(progress["completed_revision"], 0)

    def test_incompatible_policy_keeps_legacy_availability_without_claiming_current_content(self):
        self.summary(BRSU_GENERATION_POLICY_VALUES={"old_policy": True})
        self.completed_work()
        data = self.detail()
        self.assertFalse(data["review_insight_regeneration"]["content_is_current"])
        self.assertEqual(data["review_insights"]["state"], "outdated")
        self.assertTrue(data["review_insights"]["content_available"])

    def test_metadata_is_sanitized_and_requests_do_not_publish_or_change_work(self):
        self.summary()
        self.work(RIRG_LAST_ERROR="private_failure")
        before = ReviewInsightRegeneration.objects.values().get()
        with (
            patch(
                "apps.reviews.tasks.process_review_insight_regeneration.apply_async",
            ) as dispatch,
            patch(
                "apps.reviews.services.review_keyword_service.ReviewKeywordService._generate",
            ) as provider,
        ):
            progress = self.detail()["review_insight_regeneration"]
        self.assertEqual(set(progress), {
            "status", "is_outstanding", "requested_revision", "completed_revision",
            "run_after", "content_available", "content_is_current",
        })
        self.assertEqual(ReviewInsightRegeneration.objects.values().get(), before)
        dispatch.assert_not_called()
        provider.assert_not_called()

    def test_explorer_and_admin_eager_loading_avoids_metadata_queries(self):
        self.summary()
        self.work()
        for service in (ExploreBusinessService, BusinessService):
            with self.subTest(service=service.__name__):
                if service is ExploreBusinessService:
                    business = service.get_business_detail(
                        self.business.pk,
                        self.business.USER_ID,
                    )
                else:
                    business = service.get_business_detail(self.business.pk)
                with policy_scope():
                    current_policy()
                    with self.assertNumQueries(0):
                        progress = ReviewInsightRegenerationSerializer(business).data
                        insights = BusinessReviewInsightsSerializer(
                            business.review_summary,
                        ).data
                self.assertEqual(progress, insights["regeneration"])
