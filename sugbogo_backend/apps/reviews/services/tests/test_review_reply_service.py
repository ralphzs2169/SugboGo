from django.contrib.gis.geos import Point
from django.test import TestCase
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.business.models import (
    Business,
    Category,
    Cluster,
    Location,
)
from apps.reviews.models import Review, ReviewReply
from apps.reviews.services.review_reply_service import ReviewReplyService
from apps.reviews.services.review_service import ReviewService
from apps.users.models import User


class ReviewReplyServiceTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.merchant = User.objects.create_user(
            email="merchant@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        cls.explorer = User.objects.create_user(
            email="explorer@example.com",
            password="StrongPassword123!",
            USER_FNAME="Explorer",
            USER_LNAME="User",
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
            USER_ID=cls.merchant,
            CTGRY_ID=cls.category,
            LOCT_ID=cls.location,
        )

    def test_create_reply(self):
        review = ReviewService.create_review(
            user=self.explorer,
            business_id=self.business.BUSN_ID,
            text="Great food and excellent service.",
        )

        reply = ReviewReplyService.create_reply(
            user=self.merchant,
            review_id=review.REVW_ID,
            text="Thank you for visiting Sugbo Bistro!",
        )

        self.assertEqual(
            reply.REVW_ID_id,
            review.REVW_ID,
        )
        self.assertEqual(
            reply.RPLY_TEXT,
            "Thank you for visiting Sugbo Bistro!",
        )

    def test_create_reply_rejects_nonexistent_review(self):
        with self.assertRaisesMessage(
            NotFound,
            "The review could not be found.",
        ):
            ReviewReplyService.create_reply(
                user=self.merchant,
                review_id=999999,
                text="Thank you for your feedback.",
            )

    def test_create_reply_rejects_non_business_owner(self):
        review = ReviewService.create_review(
            user=self.explorer,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        with self.assertRaisesMessage(
            PermissionDenied,
            "You do not have permission to reply to this review.",
        ):
            ReviewReplyService.create_reply(
                user=self.explorer,
                review_id=review.REVW_ID,
                text="I want to reply to this review.",
            )

    def test_create_reply_rejects_duplicate_reply(self):
        review = ReviewService.create_review(
            user=self.explorer,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        ReviewReplyService.create_reply(
            user=self.merchant,
            review_id=review.REVW_ID,
            text="Thank you for your feedback.",
        )

        with self.assertRaisesMessage(
            ValidationError,
            "This review already has a reply.",
        ):
            ReviewReplyService.create_reply(
                user=self.merchant,
                review_id=review.REVW_ID,
                text="Another reply.",
            )

        self.assertEqual(
            ReviewReply.objects.filter(
                REVW_ID=review,
            ).count(),
            1,
        )

    def test_create_reply_is_available_through_review_relation(self):
        review = ReviewService.create_review(
            user=self.explorer,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        reply = ReviewReplyService.create_reply(
            user=self.merchant,
            review_id=review.REVW_ID,
            text="Thank you for your feedback.",
        )

        self.assertEqual(
            review.reply.RPLY_ID,
            reply.RPLY_ID,
        )