from unittest.mock import patch

from rest_framework.test import APITestCase

from apps.explorer_operations.explore_businesses.services.explore_business_service import (
    ExploreBusinessService,
)
from apps.reviews.models import BusinessReviewSummary
from apps.reviews.services.business_review_summary_service import BusinessReviewSummaryService
from apps.reviews.services.tests.test_business_review_summary_service import SummaryFixtureMixin


class BusinessDetailInsightsTests(SummaryFixtureMixin, APITestCase):
    def setUp(self):
        self.business = self.create_business()
        self.client.force_authenticate(self.business.USER_ID)
        self.url = f"/api/explorer/explore/businesses/{self.business.pk}/"

    def test_serializes_only_public_stored_insights_without_processing(self):
        summary = BusinessReviewSummary.objects.create(
            BUSN_ID=self.business,
            BRSU_REVIEW_COUNT=9,
            BRSU_CLASSIFIED_REVIEW_COUNT=6,
            BRSU_POSITIVE_COUNT=4,
            BRSU_NEUTRAL_COUNT=1,
            BRSU_NEGATIVE_COUNT=1,
            BRSU_KEYWORD_TAGS=[{"text": "friendly service", "count": 3, "review_ids": [1, 2, 3]}],
            BRSU_KEYWORDS_FINGERPRINT="private",
            BRSU_KEYWORDS_RETRYABLE=True,
        )
        with (
            patch.object(BusinessReviewSummaryService, "recompute_sentiment") as recompute,
            patch("apps.reviews.services.review_keyword_service.ReviewKeywordService.refresh") as keywords,
            patch("apps.reviews.services.review_keyword_service.ReviewKeywordService._generate") as generate,
            patch("apps.reviews.tasks.recompute_review_summaries.delay") as schedule,
        ):
            response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        insights = response.data["data"]["review_insights"]
        self.assertEqual(
            set(insights),
            {
                "review_count",
                "has_sufficient_sentiment_data",
                "sentiment",
                "frequent_mentions",
                "updated_at",
            },
        )
        self.assertEqual(insights["review_count"], 9)
        self.assertTrue(insights["has_sufficient_sentiment_data"])
        self.assertEqual(
            insights["frequent_mentions"],
            [{"label": "friendly service", "count": 3}],
        )
        self.assertIsNotNone(insights["updated_at"])
        for label, count in [("positive", 4), ("neutral", 1), ("negative", 1)]:
            self.assertEqual(insights["sentiment"][label], {
                "count": count,
                "percentage": summary.sentiment_percentages[label],
            })
        recompute.assert_not_called()
        keywords.assert_not_called()
        generate.assert_not_called()
        schedule.assert_not_called()
        summary.refresh_from_db()
        self.assertEqual(summary.BRSU_KEYWORDS_FINGERPRINT, "private")

    def test_missing_summary_is_null_and_is_not_created(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["data"]["review_insights"])
        self.assertFalse(BusinessReviewSummary.objects.exists())

    def test_zero_classified_and_zero_eligible_summaries(self):
        summary = BusinessReviewSummary.objects.create(BUSN_ID=self.business)
        for review_count in [0, 3]:
            with self.subTest(review_count=review_count):
                summary.BRSU_REVIEW_COUNT = review_count
                summary.save()
                response = self.client.get(self.url)
                self.assertEqual(response.status_code, 200)
                insights = response.data["data"]["review_insights"]
                self.assertEqual(insights["review_count"], review_count)
                self.assertFalse(insights["has_sufficient_sentiment_data"])
                self.assertEqual(insights["frequent_mentions"], [])
                for value in insights["sentiment"].values():
                    self.assertEqual(value, {"count": 0, "percentage": 0.0})

    def test_sentiment_sufficiency_uses_existing_classified_threshold(self):
        summary = BusinessReviewSummary.objects.create(
            BUSN_ID=self.business,
            BRSU_REVIEW_COUNT=5,
            BRSU_CLASSIFIED_REVIEW_COUNT=4,
            BRSU_POSITIVE_COUNT=4,
        )

        below = self.client.get(self.url)
        self.assertFalse(
            below.data["data"]["review_insights"][
                "has_sufficient_sentiment_data"
            ],
        )

        summary.BRSU_CLASSIFIED_REVIEW_COUNT = 5
        summary.BRSU_POSITIVE_COUNT = 5
        summary.save(
            update_fields=[
                "BRSU_CLASSIFIED_REVIEW_COUNT",
                "BRSU_POSITIVE_COUNT",
                "BRSU_UPDATED_AT",
            ],
        )

        at_threshold = self.client.get(self.url)
        self.assertTrue(
            at_threshold.data["data"]["review_insights"][
                "has_sufficient_sentiment_data"
            ],
        )

    def test_null_and_unknown_labels_do_not_change_classified_denominator(self):
        for index, label in enumerate(["positive", "neutral", None, "unknown"]):
            self.create_review(self.business, index, REVW_SENTIMENT_LABEL=label)
        BusinessReviewSummaryService.recompute_sentiment(self.business.pk)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        insights = response.data["data"]["review_insights"]
        self.assertEqual(insights["review_count"], 4)
        self.assertEqual(insights["sentiment"]["positive"], {"count": 1, "percentage": 50.0})
        self.assertEqual(insights["sentiment"]["neutral"], {"count": 1, "percentage": 50.0})

    def test_summary_relation_is_eager_loaded_including_missing_summary(self):
        for exists in [False, True]:
            with self.subTest(exists=exists):
                if exists:
                    BusinessReviewSummary.objects.create(BUSN_ID=self.business)
                business = ExploreBusinessService.get_business_detail(self.business.pk, self.business.USER_ID)
                with self.assertNumQueries(0):
                    self.assertEqual(getattr(business, "review_summary", None) is not None, exists)
