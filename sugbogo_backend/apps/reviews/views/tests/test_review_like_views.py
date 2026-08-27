from django.contrib.gis.geos import Point
from rest_framework import status
from rest_framework.test import APITestCase

from apps.business.models import (
    Business,
    Category,
    Cluster,
    Location,
)
from apps.reviews.models import Review, ReviewLike
from apps.users.models import User


class ReviewLikeViewTests(APITestCase):
    """Tests for business review like API endpoints."""

    def setUp(self):
        self.merchant = User.objects.create_user(
            email="merchant-review-like@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.explorer = User.objects.create_user(
            email="explorer-review-like@example.com",
            password="StrongPassword123!",
            USER_FNAME="Explorer",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.second_explorer = User.objects.create_user(
            email="explorer-review-like-2@example.com",
            password="StrongPassword123!",
            USER_FNAME="Second",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.client.force_authenticate(
            self.explorer,
        )

        self.cluster = Cluster.objects.create(
            CLUS_NAME="Food & Dining",
            CLUS_DESCRIPTION="Food businesses.",
        )

        self.category = Category.objects.create(
            CTGRY_NAME="Restaurants",
            CTGRY_DESCRIPTION="Restaurants and dining establishments.",
            CLUS_ID=self.cluster,
        )

        self.location = Location.objects.create(
            LOCT_POINT=Point(
                123.8854,
                10.3157,
                srid=4326,
            ),
            LOCT_ADDRESS="Gorordo Avenue",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )

        self.business = Business.objects.create(
            BUSN_NAME="Sugbo Bistro",
            BUSN_DESCRIPTION="A Cebu-based local restaurant.",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=self.merchant,
            CTGRY_ID=self.category,
            LOCT_ID=self.location,
        )

        self.review = Review.objects.create(
            USER_ID=self.second_explorer,
            BUSN_ID=self.business,
            REVW_TEXT="Great food and excellent service.",
        )

        self.like_url = (
            f"/api/reviews/{self.review.REVW_ID}/like/"
        )

    def test_create_like_successfully(self):
        response = self.client.post(
            self.like_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["message"],
            "Review liked successfully.",
        )

        self.assertTrue(
            response.data["data"]["is_liked"],
        )

        self.assertEqual(
            response.data["data"]["review_id"],
            self.review.REVW_ID,
        )

        self.assertTrue(
            ReviewLike.objects.filter(
                REVW_ID=self.review,
                USER_ID=self.explorer,
            ).exists(),
        )

        self.review.refresh_from_db()

        self.assertEqual(
            self.review.REVW_LIKE_COUNT,
            1,
        )

    def test_create_like_rejects_duplicate_like(self):
        ReviewLike.objects.create(
            REVW_ID=self.review,
            USER_ID=self.explorer,
        )

        self.review.REVW_LIKE_COUNT = 1
        self.review.save(
            update_fields=[
                "REVW_LIKE_COUNT",
            ],
        )

        response = self.client.post(
            self.like_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            response.data["code"],
            "VALIDATION_ERROR",
        )

        self.assertEqual(
            response.data["message"],
            "You have already liked this review.",
        )

        self.assertEqual(
            ReviewLike.objects.filter(
                REVW_ID=self.review,
                USER_ID=self.explorer,
            ).count(),
            1,
        )

        self.review.refresh_from_db()

        self.assertEqual(
            self.review.REVW_LIKE_COUNT,
            1,
        )

    def test_create_like_rejects_nonexistent_review(self):
        url = "/api/reviews/999999/like/"

        response = self.client.post(
            url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

        self.assertEqual(
            response.data["message"],
            "The review could not be found.",
        )

    def test_remove_like_successfully(self):
        ReviewLike.objects.create(
            REVW_ID=self.review,
            USER_ID=self.explorer,
        )

        self.review.REVW_LIKE_COUNT = 1
        self.review.save(
            update_fields=[
                "REVW_LIKE_COUNT",
            ],
        )

        response = self.client.delete(
            self.like_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["message"],
            "Review like removed successfully.",
        )

        self.assertFalse(
            response.data["data"]["is_liked"],
        )

        self.assertFalse(
            ReviewLike.objects.filter(
                REVW_ID=self.review,
                USER_ID=self.explorer,
            ).exists(),
        )

        self.review.refresh_from_db()

        self.assertEqual(
            self.review.REVW_LIKE_COUNT,
            0,
        )

    def test_remove_like_rejects_nonexistent_like(self):
        response = self.client.delete(
            self.like_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

        self.assertEqual(
            response.data["message"],
            "Your like could not be found.",
        )

    def test_remove_like_does_not_decrease_counter_below_zero(self):
        response = self.client.delete(
            self.like_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

        self.review.refresh_from_db()

        self.assertEqual(
            self.review.REVW_LIKE_COUNT,
            0,
        )

    def test_authenticated_merchant_cannot_like_review_on_own_business(self):
        self.client.force_authenticate(
            self.merchant,
        )

        response = self.client.post(
            self.like_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertFalse(
            ReviewLike.objects.filter(
                REVW_ID=self.review,
                USER_ID=self.merchant,
            ).exists(),
        )

    def test_unauthenticated_user_cannot_like_review(self):
        self.client.force_authenticate(
            user=None,
        )

        response = self.client.post(
            self.like_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_unauthenticated_user_cannot_remove_like(self):
        self.client.force_authenticate(
            user=None,
        )

        response = self.client.delete(
            self.like_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )