from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone
from rest_framework.test import APITestCase

from apps.explorer_operations.explore_businesses.services.explore_business_service import (
    ExploreBusinessService,
)
from apps.explorer_operations.explore_businesses.services.new_businesses_service import (
    NewBusinessesService,
)
from apps.explorer_operations.explore_businesses.serializers.explore_business_serializer import (
    ExploreBusinessSerializer,
)
from apps.reviews.models import BusinessReviewSummary, Review
from apps.reviews.services.business_review_summary_service import (
    BusinessReviewSummaryService,
)
from apps.reviews.services.tests.test_business_review_summary_service import (
    SummaryFixtureMixin,
)


class BusinessDetailInsightsTests(SummaryFixtureMixin, APITestCase):
    INSIGHT_FIELDS = {
        "state",
        "state_message",
        "content_available",
        "narrative",
        "review_count",
        "eligible_review_count",
        "analyzed_review_count",
        "classified_review_count",
        "has_sufficient_sentiment_data",
        "overall_vibe",
        "is_sampled",
        "sentiment",
        "frequent_mentions",
        "coverage_start",
        "coverage_end",
        "generated_at",
        "sentiment_computed_at",
        "updated_at",
    }

    def setUp(self):
        self.business = self.create_business()
        self.client.force_authenticate(self.business.USER_ID)
        self.url = f"/api/explorer/explore/businesses/{self.business.pk}/"

    def test_serializes_only_public_stored_insights_without_processing(self):
        generated_at = timezone.now()
        coverage_start = generated_at - timedelta(days=30)
        self.business.BUSN_REVIEW_COUNT = 12
        self.business.save(
            update_fields=[
                "BUSN_REVIEW_COUNT",
                "BUSN_UPDATED_AT",
            ],
        )
        summary = BusinessReviewSummary.objects.create(
            BUSN_ID=self.business,
            BRSU_REVIEW_COUNT=9,
            BRSU_ELIGIBLE_REVIEW_COUNT=8,
            BRSU_ANALYZED_REVIEW_COUNT=8,
            BRSU_CLASSIFIED_REVIEW_COUNT=6,
            BRSU_POSITIVE_COUNT=4,
            BRSU_NEUTRAL_COUNT=1,
            BRSU_NEGATIVE_COUNT=1,
            BRSU_NARRATIVE="Visitors often praise the friendly service.",
            BRSU_KEYWORD_TAGS=[{
                "text": "friendly service",
                "count": 3,
                "review_ids": [1, 2, 3],
            }],
            BRSU_COVERAGE_START=coverage_start,
            BRSU_COVERAGE_END=generated_at,
            BRSU_GENERATION_STATE=BusinessReviewSummary.GenerationState.READY,
            BRSU_GENERATED_AT=generated_at,
            BRSU_SENTIMENT_COMPUTED_AT=generated_at,
            BRSU_SUPPORTING_REVIEW_REFERENCES={
                "narrative_review_ids": [1, 2, 3],
                "themes": [{
                    "text": "friendly service",
                    "review_ids": [1, 2, 3],
                }],
            },
            BRSU_KEYWORDS_FINGERPRINT="private",
            BRSU_KEYWORDS_RETRYABLE=True,
        )
        for index in range(9):
            self.create_review(self.business, index)
        with (
            patch.object(
                BusinessReviewSummaryService,
                "recompute_sentiment",
            ) as recompute,
            patch(
                "apps.reviews.services.review_keyword_service."
                "ReviewKeywordService.refresh",
            ) as keywords,
            patch(
                "apps.reviews.services.review_keyword_service."
                "ReviewKeywordService._generate",
            ) as generate,
            patch(
                "apps.reviews.tasks.recompute_review_summaries.delay",
            ) as schedule,
        ):
            response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        insights = response.data["data"]["review_insights"]
        self.assertEqual(set(insights), self.INSIGHT_FIELDS)
        self.assertEqual(insights["state"], "ready")
        self.assertEqual(insights["state_message"], "Review insights are ready.")
        self.assertTrue(insights["content_available"])
        self.assertEqual(
            insights["narrative"],
            "Visitors often praise the friendly service.",
        )
        self.assertEqual(insights["review_count"], 9)
        self.assertEqual(insights["eligible_review_count"], 8)
        self.assertEqual(insights["analyzed_review_count"], 8)
        self.assertEqual(insights["classified_review_count"], 6)
        self.assertTrue(insights["has_sufficient_sentiment_data"])
        self.assertEqual(insights["overall_vibe"], "mostly_positive")
        self.assertFalse(insights["is_sampled"])
        self.assertEqual(response.data["data"]["review_count"], 9)
        self.assertEqual(
            response.data["data"]["overall_vibe"],
            "mostly_positive",
        )
        self.assertEqual(
            insights["frequent_mentions"],
            [{"label": "friendly service", "count": 3}],
        )
        self.assertEqual(
            insights["generated_at"],
            generated_at.isoformat().replace("+00:00", "Z"),
        )
        self.assertEqual(
            insights["sentiment_computed_at"],
            generated_at.isoformat().replace("+00:00", "Z"),
        )
        self.assertIsNotNone(insights["updated_at"])
        self.assertNotIn("supporting_review_references", insights)
        self.assertNotIn("keywords_fingerprint", insights)
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

    def test_root_count_is_all_published_while_insights_count_is_recent(self):
        reviews = []
        for index in range(5):
            reviews.append(self.create_review(self.business, index))
        reference_time = timezone.now()
        Review.objects.filter(pk=reviews[0].pk).update(
            REVW_CREATED_AT=reference_time - timedelta(days=31),
        )
        self.create_review(
            self.business,
            6,
            REVW_STATUS=Review.ReviewStatus.REJECTED,
        )
        self.create_review(
            self.business,
            7,
            REVW_STATUS=Review.ReviewStatus.FLAGGED,
        )
        BusinessReviewSummaryService.recompute_sentiment(
            self.business.pk,
            reference_time=reference_time,
        )
        summary = BusinessReviewSummary.objects.get(BUSN_ID=self.business)
        summary.BRSU_ELIGIBLE_REVIEW_COUNT = 4
        summary.save(update_fields=["BRSU_ELIGIBLE_REVIEW_COUNT"])

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["review_count"], 5)
        insights = response.data["data"]["review_insights"]
        self.assertEqual(insights["review_count"], 4)
        self.assertEqual(insights["eligible_review_count"], 4)
        self.assertEqual(insights["classified_review_count"], 4)

        list_business = NewBusinessesService.list_new_businesses(
            self.business.USER_ID,
        ).get(pk=self.business.pk)
        list_data = ExploreBusinessSerializer(list_business).data
        self.assertEqual(list_data["review_count"], 5)

    def test_list_count_does_not_require_a_review_insights_summary(self):
        self.create_review(self.business, 0)
        self.create_review(self.business, 1)

        list_business = NewBusinessesService.list_new_businesses(
            self.business.USER_ID,
        ).get(pk=self.business.pk)
        list_data = ExploreBusinessSerializer(list_business).data

        self.assertEqual(list_data["review_count"], 2)
        self.assertIsNone(list_data["overall_vibe"])

    def test_pending_and_insufficient_states_hide_generated_content(self):
        summary = BusinessReviewSummary.objects.create(
            BUSN_ID=self.business,
            BRSU_NARRATIVE="Content from an earlier run.",
            BRSU_KEYWORD_TAGS=[{"text": "old tag", "count": 2}],
        )
        cases = (
            (
                BusinessReviewSummary.GenerationState.PENDING,
                "Review insights are being generated.",
            ),
            (
                BusinessReviewSummary.GenerationState.INSUFFICIENT_REVIEWS,
                "At least five eligible recent reviews are required.",
            ),
        )

        for state, message in cases:
            with self.subTest(state=state):
                summary.BRSU_GENERATION_STATE = state
                summary.save(update_fields=["BRSU_GENERATION_STATE"])
                response = self.client.get(self.url)
                insights = response.data["data"]["review_insights"]
                self.assertEqual(insights["state"], state)
                self.assertEqual(insights["state_message"], message)
                self.assertFalse(insights["content_available"])
                self.assertIsNone(insights["narrative"])
                self.assertEqual(insights["frequent_mentions"], [])

    def test_generated_content_unavailable_while_sentiment_is_sufficient(self):
        BusinessReviewSummary.objects.create(
            BUSN_ID=self.business,
            BRSU_GENERATION_STATE=(
                BusinessReviewSummary.GenerationState.INSUFFICIENT_REVIEWS
            ),
            BRSU_REVIEW_COUNT=5,
            BRSU_CLASSIFIED_REVIEW_COUNT=5,
            BRSU_POSITIVE_COUNT=5,
        )

        insights = self.client.get(self.url).data["data"]["review_insights"]

        self.assertFalse(insights["content_available"])
        self.assertIsNone(insights["narrative"])
        self.assertEqual(insights["frequent_mentions"], [])
        self.assertTrue(insights["has_sufficient_sentiment_data"])
        self.assertEqual(insights["overall_vibe"], "mostly_positive")

    def test_generated_content_ready_while_sentiment_is_insufficient(self):
        BusinessReviewSummary.objects.create(
            BUSN_ID=self.business,
            BRSU_GENERATION_STATE=BusinessReviewSummary.GenerationState.READY,
            BRSU_NARRATIVE="Visitors consistently praise the service.",
            BRSU_KEYWORD_TAGS=[{
                "text": "friendly service",
                "count": 2,
                "review_ids": [1, 2],
            }],
            BRSU_REVIEW_COUNT=5,
            BRSU_ELIGIBLE_REVIEW_COUNT=5,
            BRSU_ANALYZED_REVIEW_COUNT=5,
            BRSU_CLASSIFIED_REVIEW_COUNT=4,
            BRSU_POSITIVE_COUNT=4,
        )

        insights = self.client.get(self.url).data["data"]["review_insights"]

        self.assertTrue(insights["content_available"])
        self.assertEqual(
            insights["narrative"],
            "Visitors consistently praise the service.",
        )
        self.assertEqual(
            insights["frequent_mentions"],
            [{"label": "friendly service", "count": 2}],
        )
        self.assertFalse(insights["has_sufficient_sentiment_data"])
        self.assertIsNone(insights["overall_vibe"])

    def test_outdated_state_distinguishes_retained_and_invalidated_content(self):
        summary = BusinessReviewSummary.objects.create(
            BUSN_ID=self.business,
            BRSU_GENERATION_STATE=BusinessReviewSummary.GenerationState.OUTDATED,
            BRSU_NARRATIVE="Visitors praised the service in the prior window.",
            BRSU_KEYWORD_TAGS=[{"text": "friendly service", "count": 3}],
        )

        insights = self.client.get(self.url).data["data"]["review_insights"]
        self.assertTrue(insights["content_available"])
        self.assertEqual(
            insights["state_message"],
            "Review insights are outdated and awaiting refresh.",
        )
        self.assertEqual(
            insights["frequent_mentions"][0]["label"],
            "friendly service",
        )

        summary.BRSU_NARRATIVE = ""
        summary.BRSU_KEYWORD_TAGS = []
        summary.save(update_fields=["BRSU_NARRATIVE", "BRSU_KEYWORD_TAGS"])
        insights = self.client.get(self.url).data["data"]["review_insights"]
        self.assertFalse(insights["content_available"])
        self.assertIsNone(insights["narrative"])
        self.assertEqual(insights["frequent_mentions"], [])
        self.assertEqual(
            insights["state_message"],
            "Review insights are unavailable because supporting reviews changed.",
        )

    def test_sampling_disclosure_compares_analyzed_with_eligible_reviews(self):
        summary = BusinessReviewSummary.objects.create(
            BUSN_ID=self.business,
            BRSU_GENERATION_STATE=BusinessReviewSummary.GenerationState.READY,
            BRSU_NARRATIVE="A current summary.",
            BRSU_ELIGIBLE_REVIEW_COUNT=240,
            BRSU_ANALYZED_REVIEW_COUNT=100,
        )
        insights = self.client.get(self.url).data["data"]["review_insights"]
        self.assertTrue(insights["is_sampled"])

        summary.BRSU_ANALYZED_REVIEW_COUNT = 240
        summary.save(update_fields=["BRSU_ANALYZED_REVIEW_COUNT"])
        insights = self.client.get(self.url).data["data"]["review_insights"]
        self.assertFalse(insights["is_sampled"])

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
                self.assertIsNone(insights["overall_vibe"])
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
        self.assertEqual(
            insights["sentiment"]["positive"],
            {"count": 1, "percentage": 50.0},
        )
        self.assertEqual(
            insights["sentiment"]["neutral"],
            {"count": 1, "percentage": 50.0},
        )

    def test_summary_relation_is_eager_loaded_including_missing_summary(self):
        for exists in [False, True]:
            with self.subTest(exists=exists):
                if exists:
                    BusinessReviewSummary.objects.create(BUSN_ID=self.business)
                business = ExploreBusinessService.get_business_detail(
                    self.business.pk,
                    self.business.USER_ID,
                )
                with self.assertNumQueries(0):
                    self.assertEqual(
                        getattr(business, "review_summary", None) is not None,
                        exists,
                    )
