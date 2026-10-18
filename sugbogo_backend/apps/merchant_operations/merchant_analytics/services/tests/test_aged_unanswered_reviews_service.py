from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.exceptions import NotFound

from apps.reviews.models import Review
from apps.reviews.services.review_reply_service import ReviewReplyService

from ..aged_unanswered_reviews_service import AgedUnansweredReviewsService
from ..standard_analytics_service import StandardAnalyticsService
from .fixtures import MerchantAnalyticsFixtures


class AgedUnansweredReviewsServiceTests(MerchantAnalyticsFixtures, TestCase):
    def setUp(self):
        super().setUp()
        clock = patch(
            "apps.merchant_operations.merchant_analytics.services."
            "aged_unanswered_reviews_service.timezone.now",
            return_value=self.NOW,
        )
        self.clock = clock.start()
        self.addCleanup(clock.stop)

    def report(self):
        return AgedUnansweredReviewsService.get_report(self.merchant_a)

    def assert_counts(
        self,
        report,
        expected,
    ):
        counts = (
            report["under_3_days"],
            report["days_3_to_6"],
            report["days_7_plus"],
        )
        self.assertEqual(counts, expected)
        self.assertEqual(report["total_unanswered"], sum(counts))

    def test_zero_backlog_uses_one_server_reference_time(self):
        self.clock.reset_mock()
        report = self.report()
        self.assert_counts(report, (0, 0, 0))
        self.assertEqual(report["snapshot_as_of"], self.NOW.isoformat())
        self.clock.assert_called_once_with()

    @override_settings(TIME_ZONE="Asia/Manila")
    def test_exact_elapsed_hour_boundaries_and_original_creation_time(self):
        ages = (
            timedelta(0),
            timedelta(hours=72) - timedelta(microseconds=1),
            timedelta(hours=72),
            timedelta(hours=168) - timedelta(microseconds=1),
            timedelta(hours=168),
            timedelta(days=95),
        )
        for age in ages:
            self.review(self.NOW - age)
        # Editing a review today must not reset its original age.
        Review.objects.filter(REVW_CREATED_AT=self.NOW - timedelta(days=95)).update(
            REVW_EDITED_AT=self.NOW,
            REVW_UPDATED_AT=self.NOW,
        )
        self.assert_counts(self.report(), (2, 2, 2))

    def test_only_current_published_unanswered_reviews_are_actionable(self):
        self.review(self.NOW - timedelta(days=2))
        for status in (
            Review.ReviewStatus.UNDER_REVIEW,
            Review.ReviewStatus.FLAGGED,
            Review.ReviewStatus.REJECTED,
        ):
            self.review(self.NOW - timedelta(days=8), status=status)
        answered = self.review(self.NOW - timedelta(days=4))
        self.reply(answered, self.NOW)
        removed = self.review(self.NOW - timedelta(days=8))
        self.review(self.NOW + timedelta(microseconds=1))
        removed.delete()
        self.assert_counts(self.report(), (1, 0, 0))

    def test_advisory_flags_do_not_add_new_moderation_rules(self):
        review = self.review(self.NOW - timedelta(days=4))
        Review.objects.filter(pk=review.pk).update(
            REVW_IS_REPORT_FLAGGED=True,
            REVW_IS_DEVICE_ABUSE_FLAGGED=True,
            REVW_SHOW_IN_COMMUNITY=False,
        )
        self.assert_counts(self.report(), (0, 1, 0))

    def test_retained_anomalous_replies_block_another_reply_without_changing_standard(self):
        for reply_time in (
            self.NOW - timedelta(days=10),
            self.NOW + timedelta(days=1),
        ):
            review = self.review(self.NOW - timedelta(days=8))
            self.reply(review, reply_time)
        self.assert_counts(self.report(), (0, 0, 0))
        standard = StandardAnalyticsService.review_counts(
            self.business_a.pk,
            self.period,
        )
        self.assertEqual(standard["current_unanswered_published"], 2)
        self.assertEqual(standard["excluded_reply_timestamp_count"], 2)

    def test_reply_deletion_moderation_republication_and_removal_refresh_the_snapshot(self):
        review = self.review(self.NOW - timedelta(days=8))
        self.assert_counts(self.report(), (0, 0, 1))
        reply = ReviewReplyService.create_reply(
            user=self.merchant_a,
            review_id=review.pk,
            text="Thank you for your feedback.",
        )
        self.assert_counts(self.report(), (0, 0, 0))
        ReviewReplyService.delete_reply(
            user=self.merchant_a,
            reply_id=reply.pk,
        )
        self.assert_counts(self.report(), (0, 0, 1))
        Review.objects.filter(pk=review.pk).update(
            REVW_STATUS=Review.ReviewStatus.UNDER_REVIEW,
        )
        self.assert_counts(self.report(), (0, 0, 0))
        Review.objects.filter(pk=review.pk).update(
            REVW_STATUS=Review.ReviewStatus.PUBLISHED,
        )
        self.assert_counts(self.report(), (0, 0, 1))
        review.delete()
        self.assert_counts(self.report(), (0, 0, 0))

    def test_aggregate_is_one_query_after_ownership_resolution(self):
        for age in (1, 4, 8):
            self.review(self.NOW - timedelta(days=age))
        with patch(
            "apps.merchant_operations.merchant_analytics.services."
            "aged_unanswered_reviews_service.BusinessProfileService."
            "get_business_for_merchant",
            return_value=self.business_a,
        ):
            with self.assertNumQueries(1):
                report = self.report()
        self.assert_counts(report, (1, 1, 1))

    def test_missing_business_uses_the_existing_controlled_not_found(self):
        merchant = self.user("aged-missing", role="merchant")
        with self.assertRaises(NotFound):
            AgedUnansweredReviewsService.get_report(merchant)
