from unittest.mock import patch

from django.test import TestCase

from apps.reviews.models import BusinessReviewSummary
from apps.reviews.services.business_review_summary_service import (
    BusinessReviewSummaryService,
)
from apps.reviews.services.review_insight_scheduling_service import ReviewInsightSchedulingService
from apps.reviews.services.review_sentiment_service import ReviewSentimentService
from apps.reviews.services.review_summary_batch_service import ReviewSummaryBatchService
from apps.reviews.services.tests.test_business_review_summary_service import SummaryFixtureMixin
from apps.reviews.tasks import recompute_review_summaries


class ReviewSummaryBatchServiceTests(SummaryFixtureMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.first = cls.create_business(1)
        cls.second = cls.create_business(2)

    def test_daily_batch_updates_sentiment_and_reconciles_both_businesses(self):
        with (
            patch.object(
                ReviewSentimentService,
                "reconcile_business",
                return_value={
                    "attempted": 0,
                    "updated": 0,
                    "failed": 0,
                    "failed_review_ids": [],
                },
            ) as sentiment,
            patch.object(ReviewInsightSchedulingService, "reconcile") as narrative,
        ):
            result = ReviewSummaryBatchService.recompute()
        self.assertEqual(result["considered"], 2)
        self.assertEqual(result["sentiment_updated"], 2)
        self.assertEqual(result["keywords_skipped"], 2)
        self.assertEqual(sentiment.call_count, 2)
        self.assertEqual(narrative.call_count, 2)
        self.assertEqual(result["classification_failed"], 0)
        self.assertEqual(result["failed_business_ids"], [])
        self.assertTrue(all(
            report["aggregate_updated"]
            for report in result["sentiment_results"]
        ))

    def test_daily_task_reports_successful_classifications_and_aggregation(self):
        self.create_review(
            self.first,
            REVW_SENTIMENT_SCORE=None,
            REVW_SENTIMENT_LABEL=None,
        )
        with (
            patch(
                "apps.reviews.services.review_sentiment_service.route_sentiment",
                return_value=(0.7, "Positive", "vader"),
            ) as scorer,
            patch.object(
                ReviewInsightSchedulingService,
                "reconcile",
                return_value="unchanged",
            ),
        ):
            result = recompute_review_summaries.run()
        scorer.assert_called_once()
        self.assertEqual(result["failed"], 0)
        self.assertEqual(result["classification_failed"], 0)
        self.assertEqual(result["sentiment_updated"], 2)
        self.assertEqual(result["sentiment_results"][0], {
            "business_id": self.first.pk,
            "classification": {
                "business_id": self.first.pk,
                "attempted": 1,
                "updated": 1,
                "failed": 0,
                "failed_review_ids": [],
            },
            "aggregate_updated": True,
        })

    def test_partial_classification_failure_is_reported_despite_updated_aggregate(self):
        failed = self.create_review(
            self.first,
            REVW_SENTIMENT_SCORE=None,
            REVW_SENTIMENT_LABEL=None,
        )
        scored = self.create_review(
            self.first,
            1,
            REVW_SENTIMENT_SCORE=None,
            REVW_SENTIMENT_LABEL=None,
        )
        with (
            patch(
                "apps.reviews.services.review_sentiment_service.route_sentiment",
                side_effect=[
                    RuntimeError("classification unavailable"),
                    (0.7, "Positive", "vader"),
                ],
            ) as scorer,
            patch.object(
                ReviewInsightSchedulingService,
                "reconcile",
                return_value="unchanged",
            ) as narrative,
            patch.object(recompute_review_summaries, "retry") as retry,
        ):
            result = recompute_review_summaries.run()
        self.assertEqual(scorer.call_count, 2)
        self.assertEqual(narrative.call_count, 2)
        retry.assert_not_called()
        self.assertEqual(result["failed"], 1)
        self.assertEqual(result["failed_business_ids"], [self.first.pk])
        self.assertEqual(result["classification_failed"], 1)
        self.assertEqual(result["sentiment_updated"], 2)
        report = result["sentiment_results"][0]
        self.assertTrue(report["aggregate_updated"])
        self.assertEqual(report["classification"]["attempted"], 2)
        self.assertEqual(report["classification"]["updated"], 1)
        self.assertEqual(report["classification"]["failed_review_ids"], [failed.pk])
        summary = BusinessReviewSummary.objects.get(BUSN_ID=self.first)
        self.assertEqual(summary.BRSU_REVIEW_COUNT, 2)
        self.assertEqual(summary.BRSU_CLASSIFIED_REVIEW_COUNT, 1)
        failed.refresh_from_db()
        scored.refresh_from_db()
        self.assertIsNone(failed.REVW_SENTIMENT_LABEL)
        self.assertEqual(scored.REVW_SENTIMENT_LABEL, "positive")

    def test_aggregate_failure_retains_classification_results_without_duplicate_failures(self):
        failed = self.create_review(
            self.first,
            REVW_SENTIMENT_SCORE=None,
            REVW_SENTIMENT_LABEL=None,
        )
        aggregate = BusinessReviewSummaryService.recompute_sentiment

        def fail_first_aggregate(
            business_id,
            reference_time=None,
        ):
            if business_id == self.first.pk:
                raise RuntimeError("aggregate unavailable")
            return aggregate(
                business_id,
                reference_time=reference_time,
            )

        for inference_fails in (False, True):
            with self.subTest(inference_fails=inference_fails):
                classification_error = None
                if inference_fails:
                    classification_error = RuntimeError("classification unavailable")
                failed.REVW_SENTIMENT_LABEL = None
                failed.REVW_SENTIMENT_SCORE = None
                failed.save(
                    update_fields=[
                        "REVW_SENTIMENT_LABEL",
                        "REVW_SENTIMENT_SCORE",
                    ],
                )
                with (
                    patch(
                        "apps.reviews.services.review_sentiment_service.route_sentiment",
                        return_value=(0.7, "Positive", "vader"),
                        side_effect=classification_error,
                    ),
                    patch.object(
                        BusinessReviewSummaryService,
                        "recompute_sentiment",
                        side_effect=fail_first_aggregate,
                    ),
                    patch.object(
                        ReviewInsightSchedulingService,
                        "reconcile",
                        return_value="unchanged",
                    ) as narrative,
                ):
                    result = recompute_review_summaries.run()
                self.assertEqual(result["failed"], 1)
                self.assertEqual(result["failed_business_ids"], [self.first.pk])
                self.assertEqual(result["sentiment_updated"], 1)
                self.assertEqual(result["classification_failed"], int(inference_fails))
                report = result["sentiment_results"][0]
                self.assertFalse(report["aggregate_updated"])
                self.assertEqual(report["classification"]["failed"], int(inference_fails))
                self.assertTrue(result["sentiment_results"][1]["aggregate_updated"])
                self.assertEqual(narrative.call_count, 2)

    def test_sentiment_failure_does_not_block_narrative_or_later_business(self):
        with (
            patch.object(ReviewSentimentService, "reconcile_business", side_effect=RuntimeError()),
            patch.object(ReviewInsightSchedulingService, "reconcile") as narrative,
        ):
            result = ReviewSummaryBatchService.recompute()
        self.assertEqual(result["failed_business_ids"], [self.first.pk, self.second.pk])
        self.assertEqual(narrative.call_count, 2)
        self.assertEqual(result["sentiment_updated"], 0)
        self.assertIsNone(result["sentiment_results"][0]["classification"])
        self.assertFalse(result["sentiment_results"][0]["aggregate_updated"])

    def test_selected_legacy_retry_ids_reconcile_without_duplicate_sentiment(self):
        with (
            patch.object(ReviewSentimentService, "reconcile_business") as sentiment,
            patch.object(ReviewInsightSchedulingService, "reconcile") as narrative,
        ):
            result = ReviewSummaryBatchService.recompute(business_ids=[self.first.pk, self.first.pk])
        self.assertEqual(result["considered"], 1)
        self.assertEqual(result["sentiment_results"], [])
        sentiment.assert_not_called()
        narrative.assert_called_once_with(self.first.pk)

    def test_empty_selected_batch_does_not_restart_full_scan(self):
        self.assertEqual(ReviewSummaryBatchService.recompute(business_ids=[])["considered"], 0)

    def test_coordinator_failure_does_not_stop_later_business(self):
        with patch.object(ReviewInsightSchedulingService, "reconcile", side_effect=[RuntimeError(), "queued"]):
            result = ReviewSummaryBatchService.recompute()
        self.assertEqual(result["failed_business_ids"], [self.first.pk])
        self.assertEqual(result["keywords_skipped"], 1)
