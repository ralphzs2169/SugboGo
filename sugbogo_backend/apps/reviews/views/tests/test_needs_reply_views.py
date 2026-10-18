from datetime import timedelta
from unittest.mock import patch

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.merchant_operations.merchant_analytics.services.tests.fixtures import (
    MerchantAnalyticsFixtures,
)
from apps.reviews.models import Review, ReviewPhoto


class NeedsReplyListTests(MerchantAnalyticsFixtures, APITestCase):
    def setUp(self):
        super().setUp()
        self.url = reverse("review-list", args=[self.business_a.pk])
        self.summary_url = reverse("merchant-analytics-aged-unanswered-reviews")
        self.client.force_authenticate(user=self.merchant_a)
        clock = patch("django.utils.timezone.now", return_value=self.NOW)
        clock.start()
        self.addCleanup(clock.stop)

    def test_oldest_pagination_and_summary_share_actionable_eligibility(self):
        expected = []
        for age in (1, 8, 8, 20):
            expected.append(self.review(self.NOW - timedelta(days=age)))
        answered = self.review(self.NOW - timedelta(days=10))
        self.reply(answered, self.NOW)
        for timestamp in (
            self.NOW + timedelta(days=1),
            self.NOW - timedelta(days=30),
        ):
            malformed = self.review(self.NOW - timedelta(days=9))
            self.reply(malformed, timestamp)
        self.review(self.NOW + timedelta(seconds=1))
        self.review(
            self.NOW - timedelta(days=30),
            status=Review.ReviewStatus.UNDER_REVIEW,
        )
        self.review(
            self.NOW - timedelta(days=30),
            business=self.business_b,
        )
        expected.sort(key=lambda review: (review.REVW_CREATED_AT, review.pk))
        received = []
        for page in (1, 2):
            response = self.client.get(
                self.url,
                {
                    "needs_reply": "true",
                    "ordering": "oldest",
                    "page_size": 2,
                    "page": page,
                },
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["data"]["pagination"]["total_items"], 4)
            received.extend(
                item["id"]
                for item in response.data["data"]["items"]
            )
        self.assertEqual(
            received,
            [review.pk for review in expected],
        )
        self.assertEqual(
            self.client.get(self.summary_url).data["data"]["total_unanswered"],
            len(received),
        )

    def test_existing_filters_compose_without_duplicate_reviews(self):
        review = self.review(self.NOW - timedelta(days=8))
        Review.objects.filter(
            pk=review.pk,
        ).update(
            REVW_SENTIMENT_LABEL="negative",
        )
        for index in range(2):
            ReviewPhoto.objects.create(
                REVW_ID=review,
                RPHO_PHOTO_URL=f"https://example.com/review-{index}.jpg",
                RPHO_PHOTO_PUBLIC_ID=f"review-{index}",
            )
        self.review(self.NOW - timedelta(days=1))
        response = self.client.get(
            self.url,
            {
                "needs_reply": "true",
                "sentiment": "negative",
                "has_photos": "true",
                "ordering": "oldest",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [
                item["id"]
                for item in response.data["data"]["items"]
            ],
            [review.pk],
        )

    def test_false_parameters_keep_the_existing_unfiltered_public_behavior(self):
        self.review(self.NOW - timedelta(days=1))
        answered = self.review(self.NOW - timedelta(days=2))
        self.reply(answered, self.NOW)
        self.client.force_authenticate(user=self.supporter_a)
        for query in (
            {"merchant_replied": "false"},
            {"needs_reply": "false"},
        ):
            response = self.client.get(self.url, query)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["data"]["pagination"]["total_items"], 2)
        response = self.client.get(self.url, {"merchant_replied": "true"})
        self.assertEqual(
            [
                item["id"]
                for item in response.data["data"]["items"]
            ],
            [answered.pk],
        )

    def test_actionable_filter_is_owner_only_and_requires_authentication(self):
        for user in (self.merchant_b, self.supporter_a):
            self.client.force_authenticate(user=user)
            response = self.client.get(
                self.url,
                {"needs_reply": "true"},
            )
            self.assertEqual(response.status_code, 403)
        self.client.force_authenticate(user=None)
        response = self.client.get(
            self.url,
            {"needs_reply": "true"},
        )
        self.assertEqual(response.status_code, 401)

    def test_conflicting_or_invalid_filters_are_controlled_validation_errors(self):
        for query in (
            {"needs_reply": "true", "merchant_replied": "true"},
            {"needs_reply": "invalid"},
            {"needs_reply": "true", "ordering": "invalid"},
        ):
            response = self.client.get(self.url, query)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.data["code"], "VALIDATION_ERROR")

    def test_reply_creation_and_deletion_update_both_surfaces(self):
        review = self.review(self.NOW - timedelta(days=8))
        response = self.client.post(
            reverse("review-reply", args=[review.pk]),
            {"text": "Thank you for your feedback."},
        )
        self.assertEqual(response.status_code, 200)
        reply_id = response.data["data"]["id"]
        self.assertEqual(
            self.client.get(self.summary_url).data["data"]["total_unanswered"],
            0,
        )
        response = self.client.get(self.url, {"needs_reply": "true"})
        self.assertEqual(response.data["data"]["items"], [])
        self.assertEqual(
            self.client.delete(
                reverse(
                    "review-reply-detail",
                    args=[reply_id],
                ),
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client.get(self.summary_url).data["data"]["total_unanswered"],
            1,
        )
        response = self.client.get(self.url, {"needs_reply": "true"})
        self.assertEqual(
            [
                item["id"]
                for item in response.data["data"]["items"]
            ],
            [review.pk],
        )
