from django.contrib.gis.geos import Point
from django.test import TestCase
from rest_framework.exceptions import NotFound, ValidationError

from apps.business.models import (
    Business,
    Category,
    Cluster,
    Location,
)
from apps.reviews.models import ReviewLike
from apps.reviews.services.review_like_service import ReviewLikeService
from apps.reviews.services.review_service import ReviewService
from apps.users.models import User


class ReviewLikeServiceTests(TestCase):
    """Tests for liking and unliking business reviews."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            email="explorer@example.com",
            password="StrongPassword123!",
            USER_FNAME="Explorer",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        cls.second_user = User.objects.create_user(
            email="explorer2@example.com",
            password="StrongPassword123!",
            USER_FNAME="Second",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        cls.business_owner = User.objects.create_user(
            email="business-owner@example.com",
            password="StrongPassword123!",
            USER_FNAME="Business",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        cls.cluster = Cluster.objects.create(
            CLUS_NAME="Food and Dining",
            CLUS_DESCRIPTION="Food businesses",
        )

        cls.category = Category.objects.create(
            CTGRY_NAME="Restaurants",
            CTGRY_DESCRIPTION="Places that serve meals",
            CLUS_ID=cls.cluster,
        )

        cls.location = Location.objects.create(
            LOCT_POINT=Point(
                123.8854,
                10.3157,
                srid=4326,
            ),
            LOCT_ADDRESS="Gorordo Avenue",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )

        cls.business = Business.objects.create(
            BUSN_NAME="Sugbo Bistro",
            BUSN_DESCRIPTION="A Cebu-based local restaurant.",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=cls.business_owner,
            CTGRY_ID=cls.category,
            LOCT_ID=cls.location,
        )

    def test_create_like(self):
        review = ReviewService.create_review(
            user=self.second_user,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        like = ReviewLikeService.create_like(
            user=self.user,
            review_id=review.REVW_ID,
        )

        self.assertEqual(
            like.REVW_ID_id,
            review.REVW_ID,
        )

        self.assertEqual(
            like.USER_ID_id,
            self.user.USER_ID,
        )

        self.assertTrue(
            ReviewLike.objects.filter(
                RLIK_ID=like.RLIK_ID,
            ).exists(),
        )

        review.refresh_from_db()

        self.assertEqual(
            review.REVW_LIKE_COUNT,
            1,
        )

    def test_merchant_cannot_like_review_on_own_business(self):
        self.business.USER_ID = self.user
        self.business.save(
            update_fields=["USER_ID"],
        )

        review_user = User.objects.create_user(
            email="reviewer@example.com",
            password="StrongPassword123!",
            USER_FNAME="Review",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        review = ReviewService.create_review(
            user=review_user,
            business_id=self.business.BUSN_ID,
            text="A review of the business.",
        )

        with self.assertRaisesMessage(
            ValidationError,
            "You cannot like reviews for your own business.",
        ):
            ReviewLikeService.create_like(
                user=self.user,
                review_id=review.REVW_ID,
            )

        self.assertFalse(
            ReviewLike.objects.filter(
                USER_ID=self.user,
                REVW_ID=review,
            ).exists(),
        )


    def test_create_like_rejects_duplicate(self):
        review = ReviewService.create_review(
            user=self.second_user,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        ReviewLikeService.create_like(
            user=self.user,
            review_id=review.REVW_ID,
        )

        with self.assertRaisesMessage(
            ValidationError,
            "You have already liked this review.",
        ):
            ReviewLikeService.create_like(
                user=self.user,
                review_id=review.REVW_ID,
            )

        self.assertEqual(
            ReviewLike.objects.filter(
                REVW_ID=review,
                USER_ID=self.user,
            ).count(),
            1,
        )

        review.refresh_from_db()

        self.assertEqual(
            review.REVW_LIKE_COUNT,
            1,
        )

    def test_create_like_rejects_nonexistent_review(self):
        with self.assertRaisesMessage(
            NotFound,
            "The review could not be found.",
        ):
            ReviewLikeService.create_like(
                user=self.user,
                review_id=999999,
            )

    def test_remove_like(self):
        review = ReviewService.create_review(
            user=self.second_user,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        like = ReviewLikeService.create_like(
            user=self.user,
            review_id=review.REVW_ID,
        )

        ReviewLikeService.remove_like(
            user=self.user,
            review_id=review.REVW_ID,
        )

        self.assertFalse(
            ReviewLike.objects.filter(
                RLIK_ID=like.RLIK_ID,
            ).exists(),
        )

        review.refresh_from_db()

        self.assertEqual(
            review.REVW_LIKE_COUNT,
            0,
        )

    def test_remove_like_rejects_nonexistent_like(self):
        review = ReviewService.create_review(
            user=self.second_user,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        with self.assertRaisesMessage(
            NotFound,
            "Your like could not be found.",
        ):
            ReviewLikeService.remove_like(
                user=self.user,
                review_id=review.REVW_ID,
            )

    def test_has_liked_returns_true_when_like_exists(self):
        review = ReviewService.create_review(
            user=self.second_user,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        ReviewLikeService.create_like(
            user=self.user,
            review_id=review.REVW_ID,
        )

        self.assertTrue(
            ReviewLikeService.has_liked(
                user=self.user,
                review_id=review.REVW_ID,
            ),
        )

    def test_has_liked_returns_false_when_like_does_not_exist(self):
        review = ReviewService.create_review(
            user=self.second_user,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        self.assertFalse(
            ReviewLikeService.has_liked(
                user=self.user,
                review_id=review.REVW_ID,
            ),
        )

    def test_different_users_can_like_same_review(self):
        review = ReviewService.create_review(
            user=self.second_user,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        first_like = ReviewLikeService.create_like(
            user=self.user,
            review_id=review.REVW_ID,
        )

        second_like = ReviewLikeService.create_like(
            user=self.second_user,
            review_id=review.REVW_ID,
        )

        self.assertNotEqual(
            first_like.RLIK_ID,
            second_like.RLIK_ID,
        )

        self.assertEqual(
            ReviewLike.objects.filter(
                REVW_ID=review,
            ).count(),
            2,
        )

        review.refresh_from_db()

        self.assertEqual(
            review.REVW_LIKE_COUNT,
            2,
        )