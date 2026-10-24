from unittest.mock import patch

from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APITestCase

from apps.admin_operations.system_configuration.models import (
    AnalyticsPolicyConfiguration,
)
from apps.reviews.models import BusinessReviewSummary, Review
from apps.reviews.services.business_review_summary_service import (
    BusinessReviewSummaryService,
)
from apps.reviews.services.review_insight_scheduling_service import (
    ReviewInsightSchedulingService,
)
from apps.reviews.services.review_service import ReviewService
from apps.reviews.services.review_sentiment_service import ReviewSentimentService
from apps.reviews.services.tests.test_business_review_summary_service import (
    SummaryFixtureMixin,
)


class SentimentCompletionViewTests(SummaryFixtureMixin, APITestCase):
    """Expose authoritative inclusion only to the review author without read effects."""

    def setUp(self):
        AnalyticsPolicyConfiguration.objects.get_or_create(pk=1)
        self.business = self.create_business()
        self.review = self.create_review(self.business)
        self.author = self.review.USER_ID
        self.client.force_authenticate(self.author)
        self.url = f"/api/reviews/business/{self.business.pk}/"

    def test_failed_aggregation_is_pending_until_redelivery_repairs_it(self):
        Review.objects.filter(pk=self.review.pk).update(
            REVW_SENTIMENT_SCORE=None,
            REVW_SENTIMENT_LABEL=None,
        )
        BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        with patch(
            "apps.reviews.services.review_sentiment_service.route_sentiment",
            return_value=(0.7, "Positive", "vader"),
        ) as scorer:
            with patch.object(
                BusinessReviewSummaryService,
                "recompute_sentiment",
                side_effect=RuntimeError("aggregate unavailable"),
            ):
                with self.assertRaises(RuntimeError):
                    ReviewSentimentService.process_review(self.review.pk)
            pending = self.client.get(self.url).data["data"]["user_review"]
            self.assertEqual(pending["sentiment_label"], "positive")
            self.assertFalse(pending["sentiment_aggregate_included"])
            ReviewSentimentService.process_review(self.review.pk)
            completed = self.client.get(self.url).data["data"]["user_review"]
            self.assertTrue(completed["sentiment_aggregate_included"])
        scorer.assert_called_once()

    def test_inclusion_is_independent_of_sentiment_sufficiency(self):
        BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        data = response.data["data"]
        self.assertTrue(data["user_review"]["sentiment_aggregate_included"])
        self.assertTrue(data["reviews"][0]["sentiment_aggregate_included"])
        insights = self.client.get(
            f"/api/explorer/explore/businesses/{self.business.pk}/",
        ).data["data"]["review_insights"]
        self.assertFalse(insights["has_sufficient_sentiment_data"])
        self.assertIsNone(insights["overall_vibe"])
        self.assertNotIn("sentiment_sources", insights)
        self.assertNotIn("BRSU_SENTIMENT_SOURCES", insights)

    def test_missing_and_legacy_summaries_are_unverified_without_read_writes(self):
        for legacy in (False, True):
            with self.subTest(legacy=legacy):
                if legacy:
                    BusinessReviewSummary.objects.create(BUSN_ID=self.business)
                with (
                    patch(
                        "apps.reviews.services.review_sentiment_service.route_sentiment",
                    ) as infer,
                    patch.object(
                        BusinessReviewSummaryService,
                        "recompute_sentiment",
                    ) as aggregate,
                    patch.object(ReviewInsightSchedulingService, "reconcile") as schedule,
                    patch(
                        "google.genai.models.Models.generate_content",
                    ) as generate,
                    CaptureQueriesContext(connection) as queries,
                ):
                    response = self.client.get(self.url)
                self.assertEqual(response.status_code, 200)
                self.assertFalse(
                    response.data["data"]["user_review"]["sentiment_aggregate_included"],
                )
                infer.assert_not_called()
                aggregate.assert_not_called()
                schedule.assert_not_called()
                generate.assert_not_called()
                for query in queries.captured_queries:
                    self.assertTrue(query["sql"].lstrip().upper().startswith("SELECT"))
                self.assertEqual(BusinessReviewSummary.objects.count(), int(legacy))

    def test_completion_signal_and_source_are_private_to_the_author(self):
        BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        self.client.force_authenticate(self.business.USER_ID)
        response = self.client.get(self.url)
        self.assertIsNone(response.data["data"]["user_review"])
        review = response.data["data"]["reviews"][0]
        self.assertNotIn("sentiment_aggregate_included", review)
        self.assertNotIn("sentiment_aggregate_source", review)
        self.assertNotIn("BRSU_SENTIMENT_SOURCES", review)
        current = ReviewService._annotated_review_queryset(
            self.business.USER_ID,
        ).get(pk=self.review.pk)
        self.assertIsNone(current.sentiment_aggregate_source)

    def test_stale_classification_rejection_and_deletion_are_not_complete(self):
        BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        Review.objects.filter(pk=self.review.pk).update(REVW_SENTIMENT_SCORE=0.9)
        response = self.client.get(self.url)
        self.assertFalse(
            response.data["data"]["user_review"]["sentiment_aggregate_included"],
        )
        Review.objects.filter(pk=self.review.pk).update(
            REVW_SENTIMENT_SCORE=0.75,
            REVW_STATUS=Review.ReviewStatus.REJECTED,
        )
        response = self.client.get(self.url)
        self.assertEqual(response.data["data"]["reviews"], [])
        self.assertFalse(
            response.data["data"]["user_review"]["sentiment_aggregate_included"],
        )
        self.review.delete()
        response = self.client.get(self.url)
        self.assertIsNone(response.data["data"]["user_review"])

    def test_lists_use_constant_query_count_and_history_inherits_the_signal(self):
        BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        url = f"{self.url}all/"
        with CaptureQueriesContext(connection) as first_queries:
            first = self.client.get(url)
        self.assertTrue(
            first.data["data"]["items"][0]["sentiment_aggregate_included"],
        )
        for index in range(1, 7):
            self.create_review(self.business, index)
        with CaptureQueriesContext(connection) as many_queries:
            response = self.client.get(url)
        self.assertEqual(len(first_queries), len(many_queries))
        for review in response.data["data"]["items"]:
            if review["id"] != self.review.pk:
                self.assertNotIn("sentiment_aggregate_included", review)
        history = self.client.get("/api/reviews/mine/")
        self.assertTrue(
            history.data["data"]["items"][0]["sentiment_aggregate_included"],
        )
