from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.notifications.services.tests.test_business_review_notifications import (
    BusinessReviewNotificationFixtures,
)
from apps.reviews.models import Review
from apps.users.models import User


class MerchantReviewFocusViewTests(BusinessReviewNotificationFixtures, APITestCase):
    """Verify owned review lookup, stable ordering, and unavailable targets."""

    def setUp(self):
        """Create an older target and authorize its business owner."""
        super().setUp()
        self.review = self.create_review()
        self.url = reverse(
            "merchant-review-focus",
            kwargs={
                "business_id": self.business.pk,
                "review_id": self.review.pk,
            },
        )
        self.client.force_authenticate(self.other)

    def test_locates_review_beyond_first_page_with_tied_timestamps(self):
        created_at = timezone.now()
        for index in range(11):
            author = self.make_user(f"author-{index}")
            Review.objects.create(
                USER_ID=author,
                BUSN_ID=self.business,
                REVW_TEXT="Another published review.",
            )
        Review.objects.filter(BUSN_ID=self.business).update(
            REVW_CREATED_AT=created_at,
        )
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["data"],
            {"review_id": self.review.pk, "page": 2, "page_size": 10},
        )

    def test_another_merchant_cannot_locate_the_review(self):
        stranger = self.make_user("stranger", User.UserRole.MERCHANT)
        self.client.force_authenticate(stranger)
        self.assertEqual(self.client.get(self.url).status_code, 404)

    def test_explorer_cannot_use_merchant_lookup(self):
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_unpublished_and_deleted_reviews_are_unavailable(self):
        self.review.REVW_STATUS = Review.ReviewStatus.UNDER_REVIEW
        self.review.save(update_fields=["REVW_STATUS"])
        self.assertEqual(self.client.get(self.url).status_code, 404)
        self.review.delete()
        self.assertEqual(self.client.get(self.url).status_code, 404)

    def test_invalid_page_size_is_rejected(self):
        self.assertEqual(
            self.client.get(self.url, {"page_size": 0}).status_code,
            400,
        )
