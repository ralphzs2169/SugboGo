import hashlib
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
        cls.first = cls.create_review(cls.business, 1)
        cls.second = cls.create_review(cls.business, 2)
        cls.summary = BusinessReviewSummary.objects.create(BUSN_ID=cls.business)

    def setUp(self):
        self.provider = patch.object(
            ReviewKeywordService,
            "_generate",
            return_value=self.response(),
        ).start()
        self.addCleanup(patch.stopall)

    def response(self):
        return json.dumps({"tags": [{
            "text": "friendly service",
            "count": 2,
            "review_ids": [self.first.pk, self.second.pk],
        }]})

    def refresh(self):
        return ReviewKeywordService.refresh(self.business.pk)

    def allow_next_day(self):
        BusinessReviewSummary.objects.filter(pk=self.summary.pk).update(
            BRSU_KEYWORDS_ATTEMPTED_AT=timezone.now() - timedelta(days=1),
        )

    def test_success_stores_counts_fingerprint_and_timestamp(self):
        self.assertEqual(self.refresh(), "updated")
        self.summary.refresh_from_db()
        self.assertEqual(self.summary.BRSU_KEYWORD_TAGS, [{
            "text": "friendly service",
            "count": 2,
            "review_ids": [self.first.pk, self.second.pk],
        }])
        self.assertEqual(len(self.summary.BRSU_KEYWORDS_FINGERPRINT), 64)
        self.assertIsNotNone(self.summary.BRSU_KEYWORDS_PROCESSED_AT)
        self.assertIsNotNone(self.summary.BRSU_KEYWORDS_ATTEMPTED_AT)
        self.assertIsNone(self.summary.BRSU_SENTIMENT_COMPUTED_AT)
        self.provider.assert_called_once()

    def test_unchanged_snapshot_skips_provider_even_next_day(self):
        self.refresh()
        self.allow_next_day()
        self.assertEqual(self.refresh(), "unchanged")
        self.provider.assert_called_once()

    def test_legacy_keyword_fingerprint_regenerates_evidence_once(self):
        reviews = ReviewKeywordService._snapshot(self.business.pk)
        legacy_payload = json.dumps(
            [
                "test-model",
                ReviewKeywordService.MIN_REVIEW_COUNT,
                ReviewKeywordService.MAX_TAGS,
                reviews,
            ],
            ensure_ascii=False,
            separators=(",", ":"),
        )
        legacy_fingerprint = hashlib.sha256(
            legacy_payload.encode("utf-8"),
        ).hexdigest()
        BusinessReviewSummary.objects.filter(pk=self.summary.pk).update(
            BRSU_KEYWORD_TAGS=[{"text": "friendly service", "count": 2}],
            BRSU_KEYWORDS_FINGERPRINT=legacy_fingerprint,
            BRSU_KEYWORDS_ATTEMPTED_AT=timezone.now() - timedelta(days=1),
        )

        self.assertEqual(self.refresh(), "updated")
        self.summary.refresh_from_db()
        self.assertEqual(self.summary.BRSU_KEYWORD_TAGS[0]["review_ids"], [
            self.first.pk,
            self.second.pk,
        ])
        self.assertNotEqual(
            self.summary.BRSU_KEYWORDS_FINGERPRINT,
            legacy_fingerprint,
        )
        self.assertEqual(self.refresh(), "unchanged")
        self.provider.assert_called_once()

    def test_changed_snapshot_waits_until_next_day(self):
        self.refresh()
        Review.objects.filter(pk=self.first.pk).update(REVW_TEXT="Friendly staff and nice food.")
        self.assertEqual(self.refresh(), "already_attempted")
        self.allow_next_day()
        self.assertEqual(self.refresh(), "updated")
        self.assertEqual(self.provider.call_count, 2)

    def test_added_review_is_sent_in_full_snapshot(self):
        self.refresh()
        third = self.create_review(self.business, 3)
        self.allow_next_day()
        self.refresh()
        sent = self.provider.call_args.args[0]
        self.assertEqual({item[0] for item in sent}, {self.first.pk, self.second.pk, third.pk})

    def test_deletion_changes_snapshot(self):
        self.refresh()
        self.first.delete()
        self.allow_next_day()
        self.provider.return_value = '{"tags": []}'
        self.assertEqual(self.refresh(), "cleared")
        self.summary.refresh_from_db()
        self.assertEqual(self.summary.BRSU_KEYWORD_TAGS, [])

    def test_empty_eligible_set_clears_without_provider(self):
        self.refresh()
        Review.objects.filter(BUSN_ID=self.business).update(REVW_IS_SPAM_FLAGGED=True)
        self.assertEqual(self.refresh(), "cleared")
        self.provider.assert_called_once()
        self.summary.refresh_from_db()
        self.assertEqual(self.summary.BRSU_KEYWORD_TAGS, [])

    def test_initial_empty_set_never_calls_provider(self):
        Review.objects.filter(BUSN_ID=self.business).delete()
        self.assertEqual(self.refresh(), "cleared")
        self.provider.assert_not_called()

    def test_eligibility_excludes_moderation_flags_but_keeps_outliers(self):
        self.create_review(self.business, 3, REVW_STATUS=Review.ReviewStatus.REJECTED)
        self.create_review(self.business, 4, REVW_STATUS=Review.ReviewStatus.FLAGGED)
        self.create_review(self.business, 5, REVW_IS_SPAM_FLAGGED=True)
        self.create_review(self.business, 6, REVW_IS_DEVICE_ABUSE_FLAGGED=True)
        Review.objects.filter(pk=self.first.pk).update(REVW_IS_OUTLIER_SENTIMENT=True)
        self.refresh()
        self.assertEqual({item[0] for item in self.provider.call_args.args[0]}, {self.first.pk, self.second.pk})

    def test_malformed_response_preserves_successful_state_and_stops_daily_retry(self):
        self.refresh()
        self.summary.refresh_from_db()
        original_hash = self.summary.BRSU_KEYWORDS_FINGERPRINT
        original_time = self.summary.BRSU_KEYWORDS_PROCESSED_AT
        Review.objects.filter(pk=self.first.pk).update(REVW_TEXT="Changed text")
        self.allow_next_day()
        self.provider.return_value = "not json"
        with self.assertLogs("apps.reviews.services.review_keyword_service", level="WARNING"):
            self.assertEqual(self.refresh(), "failed")
        self.summary.refresh_from_db()
        self.assertEqual(self.summary.BRSU_KEYWORDS_FINGERPRINT, original_hash)
        self.assertEqual(self.summary.BRSU_KEYWORDS_PROCESSED_AT, original_time)
        self.assertEqual(self.summary.BRSU_KEYWORD_TAGS, [{
            "text": "friendly service",
            "count": 2,
            "review_ids": [self.first.pk, self.second.pk],
        }])
        self.assertEqual(self.refresh(), "already_attempted")

    def test_empty_response_is_failure_but_valid_empty_tags_are_success(self):
        self.provider.return_value = None
        self.assertEqual(self.refresh(), "failed")
        self.allow_next_day()
        self.provider.return_value = '{"tags": []}'
        self.assertEqual(self.refresh(), "cleared")
        self.summary.refresh_from_db()
        self.assertTrue(self.summary.BRSU_KEYWORDS_FINGERPRINT)

    def test_transient_failure_can_retry_same_day(self):
        self.provider.side_effect = RetryableKeywordError("unavailable")
        with self.assertRaises(RetryableKeywordError):
            self.refresh()
        self.summary.refresh_from_db()
        self.assertTrue(self.summary.BRSU_KEYWORDS_RETRYABLE)
        self.assertIsNone(self.summary.BRSU_KEYWORDS_PROCESSED_AT)
        self.provider.side_effect = None
        self.assertEqual(self.refresh(), "updated")
        self.summary.refresh_from_db()
        self.assertFalse(self.summary.BRSU_KEYWORDS_RETRYABLE)

    def test_permanent_failure_does_not_log_provider_message(self):
        self.provider.side_effect = ValueError("secret provider payload")
        with self.assertLogs("apps.reviews.services.review_keyword_service", level="WARNING") as logs:
            self.assertEqual(self.refresh(), "failed")
        self.assertNotIn("secret provider payload", " ".join(logs.output))

    def test_stale_response_does_not_replace_keywords(self):
        def generate_then_edit(reviews):
            Review.objects.filter(pk=self.first.pk).update(REVW_IS_DEVICE_ABUSE_FLAGGED=True)
            return self.response()
        self.provider.side_effect = generate_then_edit
        self.assertEqual(self.refresh(), "stale")
        self.summary.refresh_from_db()
        self.assertEqual(self.summary.BRSU_KEYWORDS_FINGERPRINT, "")
        self.assertIsNone(self.summary.BRSU_KEYWORDS_PROCESSED_AT)

    @override_settings(GEMINI_API_KEY="")
    def test_missing_key_skips_without_consuming_attempt(self):
        self.assertEqual(self.refresh(), "unconfigured")
        self.provider.assert_not_called()
        self.summary.refresh_from_db()
        self.assertIsNone(self.summary.BRSU_KEYWORDS_ATTEMPTED_AT)

    def test_busy_business_skips_without_provider(self):
        with patch("apps.reviews.services.review_keyword_service.connection.cursor") as cursor:
            cursor.return_value.__enter__.return_value.fetchone.return_value = (False,)
            self.assertEqual(self.refresh(), "busy")
        self.provider.assert_not_called()

    def test_other_business_content_does_not_change_fingerprint(self):
        self.refresh()
        self.create_review(self.create_business(2))
        self.assertEqual(self.refresh(), "unchanged")

    def test_parser_rejects_invalid_evidence_and_counts(self):
        reviews = [(self.first.pk, "one"), (self.second.pk, "two")]
        valid = json.loads(self.response())["tags"][0]
        invalid = [
            {**valid, "text": " "},
            {**valid, "count": True},
            {**valid, "count": 1},
            {**valid, "review_ids": [self.first.pk, self.first.pk]},
            {**valid, "review_ids": [self.first.pk, -1]},
            {**valid, "review_ids": [self.first.pk, "2"]},
        ]
        for tag in invalid:
            with self.subTest(tag=tag), self.assertRaises(InvalidKeywordResponse):
                ReviewKeywordService._parse(json.dumps({"tags": [tag]}), reviews)
        for payload in [{"tags": [valid, valid]}, {"tags": [valid] * 21}, [], {"tags": None}]:
            with self.subTest(payload=payload), self.assertRaises(InvalidKeywordResponse):
                ReviewKeywordService._parse(json.dumps(payload), reviews)
