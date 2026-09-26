import json
from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone

from apps.reviews.models import BusinessReviewSummary, Review
from apps.reviews.services.review_keyword_service import (
    InvalidKeywordResponse,
    RetryableKeywordError,
    ReviewKeywordService,
)
from apps.reviews.services.tests.test_business_review_summary_service import (
    SummaryFixtureMixin,
)


@override_settings(GEMINI_API_KEY="test-only-key", GEMINI_KEYWORD_MODEL="test-model")
class ReviewKeywordServiceTests(SummaryFixtureMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.business = cls.create_business()
        cls.reviews = [cls.create_review(cls.business, index) for index in range(5)]
        cls.summary = BusinessReviewSummary.objects.create(BUSN_ID=cls.business)

    def setUp(self):
        self.reference_time = timezone.now()
        self.provider = patch.object(
            ReviewKeywordService,
            "_generate",
            return_value=self.response(),
        ).start()
        self.addCleanup(patch.stopall)

    def response(self):
        return json.dumps({
            "narrative": "Visitors consistently mention friendly service.",
            "narrative_review_ids": [self.reviews[0].pk, self.reviews[1].pk],
            "tags": [{
                "text": "friendly service",
                "count": 2,
                "review_ids": [self.reviews[0].pk, self.reviews[1].pk],
            }],
        })

    def refresh(self):
        return ReviewKeywordService.refresh(
            self.business.pk,
            reference_time=self.reference_time,
        )

    def allow_next_day(self):
        BusinessReviewSummary.objects.filter(pk=self.summary.pk).update(
            BRSU_KEYWORDS_ATTEMPTED_AT=timezone.now() - timedelta(days=1),
        )

    def test_success_publishes_narrative_keywords_evidence_and_counts_together(self):
        self.assertEqual(self.refresh(), "updated")
        self.summary.refresh_from_db()
        self.assertEqual(
            self.summary.BRSU_NARRATIVE,
            "Visitors consistently mention friendly service.",
        )
        self.assertEqual(
            self.summary.BRSU_KEYWORD_TAGS,
            [{"text": "friendly service", "count": 2}],
        )
        self.assertEqual(self.summary.BRSU_ELIGIBLE_REVIEW_COUNT, 5)
        self.assertEqual(self.summary.BRSU_ANALYZED_REVIEW_COUNT, 5)
        self.assertEqual(
            self.summary.BRSU_GENERATION_STATE,
            BusinessReviewSummary.GenerationState.READY,
        )
        self.assertEqual(
            self.summary.BRSU_SUPPORTING_REVIEW_REFERENCES["narrative_review_ids"],
            [self.reviews[0].pk, self.reviews[1].pk],
        )
        self.assertEqual(
            self.summary.BRSU_COVERAGE_START,
            self.reference_time - timedelta(days=30),
        )
        self.assertEqual(self.summary.BRSU_COVERAGE_END, self.reference_time)
        self.assertIsNotNone(self.summary.BRSU_GENERATED_AT)
        self.assertEqual(len(self.summary.BRSU_KEYWORDS_FINGERPRINT), 64)

    def test_unchanged_snapshot_skips_provider(self):
        self.refresh()
        self.assertEqual(self.refresh(), "unchanged")
        self.provider.assert_called_once()

    def test_below_five_nonblank_reviews_stores_insufficient_state(self):
        self.reviews[-1].delete()
        self.assertEqual(self.refresh(), "insufficient_reviews")
        self.summary.refresh_from_db()
        self.assertEqual(
            self.summary.BRSU_GENERATION_STATE,
            BusinessReviewSummary.GenerationState.INSUFFICIENT_REVIEWS,
        )
        self.assertEqual(self.summary.BRSU_ELIGIBLE_REVIEW_COUNT, 4)
        self.assertEqual(self.summary.BRSU_ANALYZED_REVIEW_COUNT, 0)
        self.assertEqual(self.summary.BRSU_NARRATIVE, "")
        self.assertEqual(self.summary.BRSU_KEYWORD_TAGS, [])
        self.provider.assert_not_called()

    def test_blank_review_does_not_satisfy_minimum(self):
        Review.objects.filter(pk=self.reviews[-1].pk).update(REVW_TEXT="   ")
        self.assertEqual(self.refresh(), "insufficient_reviews")
        self.provider.assert_not_called()

    def test_window_excludes_reviews_older_than_thirty_days(self):
        Review.objects.filter(pk=self.reviews[-1].pk).update(
            REVW_CREATED_AT=self.reference_time - timedelta(days=30, seconds=1),
        )
        self.assertEqual(self.refresh(), "insufficient_reviews")
        self.provider.assert_not_called()

    def test_outliers_are_included_but_moderation_flags_are_excluded(self):
        Review.objects.filter(pk=self.reviews[0].pk).update(
            REVW_IS_OUTLIER_SENTIMENT=True,
        )
        Review.objects.filter(pk=self.reviews[1].pk).update(
            REVW_IS_SPAM_FLAGGED=True,
        )
        self.assertEqual(self.refresh(), "insufficient_reviews")
        snapshot_ids = {
            review_id
            for review_id, _ in ReviewKeywordService._snapshot(
                self.business.pk,
                self.reference_time,
            )
        }
        self.assertIn(self.reviews[0].pk, snapshot_ids)
        self.assertNotIn(self.reviews[1].pk, snapshot_ids)

    def test_selection_is_deterministic_and_spread_across_one_business(self):
        reviews = [(index, f"review {index}") for index in range(240)]
        first = ReviewKeywordService._select_reviews(reviews)
        second = ReviewKeywordService._select_reviews(reviews)
        self.assertEqual(first, second)
        self.assertEqual(len(first), 100)
        self.assertEqual(first[0], reviews[0])
        self.assertEqual(first[-1], reviews[-1])
        self.assertEqual(len({review_id for review_id, _ in first}), 100)

    def test_parser_rejects_unsupported_or_weak_evidence(self):
        selected = [(review.pk, review.REVW_TEXT) for review in self.reviews]
        payload = json.loads(self.response())
        invalid = [
            {**payload, "narrative_review_ids": [-1]},
            {**payload, "narrative_review_ids": []},
            {
                **payload,
                "tags": [{
                    "text": "friendly service",
                    "count": 1,
                    "review_ids": [self.reviews[0].pk],
                }],
            },
            {**payload, "narrative": "One. Two. Three."},
            {**payload, "narrative": " ".join(["word"] * 61)},
        ]
        for value in invalid:
            with self.subTest(value=value), self.assertRaises(InvalidKeywordResponse):
                ReviewKeywordService._parse(json.dumps(value), selected)

    def test_transient_failure_is_marked_retryable_and_propagated(self):
        self.provider.side_effect = RetryableKeywordError("unavailable")
        with self.assertRaises(RetryableKeywordError):
            self.refresh()
        self.summary.refresh_from_db()
        self.assertTrue(self.summary.BRSU_KEYWORDS_RETRYABLE)
        self.assertEqual(
            self.summary.BRSU_GENERATION_STATE,
            BusinessReviewSummary.GenerationState.OUTDATED,
        )

    def test_safe_previous_result_is_retained_and_marked_outdated_on_failure(self):
        self.refresh()
        self.summary.refresh_from_db()
        generated_at = self.summary.BRSU_GENERATED_AT
        Review.objects.filter(pk=self.reviews[-1].pk).update(
            REVW_TEXT="The visit was still pleasant.",
        )
        self.allow_next_day()
        self.provider.return_value = "not json"
        self.assertEqual(self.refresh(), "failed")
        self.summary.refresh_from_db()
        self.assertEqual(
            self.summary.BRSU_GENERATION_STATE,
            BusinessReviewSummary.GenerationState.OUTDATED,
        )
        self.assertEqual(
            self.summary.BRSU_NARRATIVE,
            "Visitors consistently mention friendly service.",
        )
        self.assertEqual(self.summary.BRSU_GENERATED_AT, generated_at)

    def test_invalidated_support_clears_previous_result_on_failure(self):
        self.create_review(self.business, 6)
        self.reference_time = timezone.now()
        self.refresh()
        Review.objects.filter(pk=self.reviews[0].pk).update(
            REVW_IS_DEVICE_ABUSE_FLAGGED=True,
        )
        self.allow_next_day()
        self.provider.return_value = "not json"
        self.assertEqual(self.refresh(), "failed")
        self.summary.refresh_from_db()
        self.assertEqual(self.summary.BRSU_NARRATIVE, "")
        self.assertEqual(self.summary.BRSU_KEYWORD_TAGS, [])
        self.assertIsNone(self.summary.BRSU_GENERATED_AT)

    def test_concurrent_source_change_discards_generated_result(self):
        def generate_then_change(_reviews):
            Review.objects.filter(pk=self.reviews[0].pk).update(
                REVW_IS_DEVICE_ABUSE_FLAGGED=True,
            )
            return self.response()

        self.provider.side_effect = generate_then_change
        self.assertEqual(self.refresh(), "stale")
        self.summary.refresh_from_db()
        self.assertNotEqual(
            self.summary.BRSU_GENERATION_STATE,
            BusinessReviewSummary.GenerationState.READY,
        )
        self.assertEqual(self.summary.BRSU_NARRATIVE, "")

    @override_settings(GEMINI_API_KEY="")
    def test_missing_key_does_not_consume_daily_attempt(self):
        self.assertEqual(self.refresh(), "unconfigured")
        self.provider.assert_not_called()
        self.summary.refresh_from_db()
        self.assertIsNone(self.summary.BRSU_KEYWORDS_ATTEMPTED_AT)

    @override_settings(GEMINI_API_KEY="")
    def test_unsafe_previous_result_is_unavailable_even_without_provider(self):
        with self.settings(GEMINI_API_KEY="test-only-key"):
            self.refresh()
        Review.objects.filter(pk=self.reviews[0].pk).update(
            REVW_IS_DEVICE_ABUSE_FLAGGED=True,
        )
        self.create_review(self.business, 7)
        self.reference_time = timezone.now()
        self.allow_next_day()

        self.assertEqual(self.refresh(), "unconfigured")

        self.summary.refresh_from_db()
        self.assertEqual(
            self.summary.BRSU_GENERATION_STATE,
            BusinessReviewSummary.GenerationState.OUTDATED,
        )
        self.assertEqual(self.summary.BRSU_NARRATIVE, "")
        self.assertEqual(self.summary.BRSU_KEYWORD_TAGS, [])

    def test_busy_business_skips_provider(self):
        with patch(
            "apps.reviews.services.review_keyword_service.connection.cursor",
        ) as cursor:
            cursor.return_value.__enter__.return_value.fetchone.return_value = (False,)
            self.assertEqual(self.refresh(), "busy")
        self.provider.assert_not_called()
