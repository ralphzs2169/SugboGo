from io import BytesIO
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from apps.business.models import (
    Business,
    Category,
    Cluster,
    Location,
)
from apps.reviews.models import ReviewReply
from apps.reviews.services.review_reply_service import ReviewReplyService
from apps.reviews.services.review_service import ReviewService
from apps.users.models import User


class ReviewReplyViewTests(APITestCase):
    """Tests for business-owner review reply API endpoints."""

    def setUp(self):
        self.merchant = User.objects.create_user(
            email="merchant-reply@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.explorer = User.objects.create_user(
            email="explorer-reply@example.com",
            password="StrongPassword123!",
            USER_FNAME="Explorer",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.client.force_authenticate(
            self.merchant,
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

        self.review = ReviewService.create_review(
            user=self.explorer,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        self.url = (
            f"/api/reviews/{self.review.REVW_ID}/reply/"
        )

    def test_create_reply_successfully(self):
        response = self.client.post(
            self.url,
            {
                "text": "Thank you for visiting Sugbo Bistro!",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        reply = ReviewReply.objects.get(
            RPLY_ID=response.data["data"]["id"],
        )

        self.assertEqual(
            reply.REVW_ID_id,
            self.review.REVW_ID,
        )
        self.assertEqual(
            reply.RPLY_TEXT,
            "Thank you for visiting Sugbo Bistro!",
        )

        self.assertEqual(
            response.data["data"]["review_id"],
            self.review.REVW_ID,
        )

        self.assertEqual(
            response.data["message"],
            "Review reply added successfully.",
        )

    def test_create_reply_rejects_missing_text(self):
        response = self.client.post(
            self.url,
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            response.data["code"],
            "VALIDATION_ERROR",
        )

        self.assertIn(
            "text",
            response.data["errors"],
        )

        self.assertFalse(
            ReviewReply.objects.filter(
                REVW_ID=self.review,
            ).exists(),
        )

    def test_create_reply_rejects_text_over_1000_characters(self):
        response = self.client.post(
            self.url,
            {
                "text": "a" * 1001,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            response.data["code"],
            "VALIDATION_ERROR",
        )

        self.assertIn(
            "text",
            response.data["errors"],
        )

        self.assertFalse(
            ReviewReply.objects.filter(
                REVW_ID=self.review,
            ).exists(),
        )

    def test_create_reply_rejects_non_owner(self):
        self.client.force_authenticate(
            self.explorer,
        )

        response = self.client.post(
            self.url,
            {
                "text": "I should not be able to reply.",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self.assertEqual(
            response.data["message"],
            "You do not have permission to perform this action.",
        )

        self.assertFalse(
            ReviewReply.objects.filter(
                REVW_ID=self.review,
            ).exists(),
        )

    def test_create_reply_rejects_duplicate(self):
        ReviewReply.objects.create(
            REVW_ID=self.review,
            RPLY_TEXT="Thank you for your feedback.",
        )

        response = self.client.post(
            self.url,
            {
                "text": "Another reply.",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            response.data["message"],
            "This review already has a reply.",
        )

        self.assertEqual(
            ReviewReply.objects.filter(
                REVW_ID=self.review,
            ).count(),
            1,
        )

    def test_create_reply_rejects_nonexistent_review(self):
        response = self.client.post(
            "/api/reviews/999999/reply/",
            {
                "text": "Thank you for your feedback.",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

        self.assertEqual(
            response.data["message"],
            "The review could not be found.",
        )

        self.assertFalse(
            ReviewReply.objects.exists(),
        )

    def test_create_reply_requires_authentication(self):
        self.client.force_authenticate(
            user=None,
        )

        response = self.client.post(
            self.url,
            {
                "text": "Thank you for your feedback.",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

        self.assertFalse(
            ReviewReply.objects.exists(),
        )

    # add to ReviewReplyViewTests

    @staticmethod
    def create_test_image(filename="reply.jpg", width=100, height=100):
        image = Image.new("RGB", (width, height))
        image_file = BytesIO()
        image.save(image_file, format="JPEG")
        image_file.seek(0)
        return SimpleUploadedFile(filename, image_file.read(), content_type="image/jpeg")

    @patch("apps.reviews.views.review_reply_views.ReviewReplyService.create_reply")
    def test_create_reply_with_photos(self, mock_create_reply):
        first_photo = self.create_test_image("reply-1.jpg")
        second_photo = self.create_test_image("reply-2.jpg")

        mock_reply = ReviewReply(
            RPLY_ID=1,
            REVW_ID=self.review,
            RPLY_TEXT="Thank you!",
        )

        mock_create_reply.return_value = mock_reply

        response = self.client.post(
            self.url,
            {
                "text": "Thank you!",
                "photos": [first_photo, second_photo],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        mock_create_reply.assert_called_once()

        call_kwargs = mock_create_reply.call_args.kwargs

        self.assertEqual(call_kwargs["user"], self.merchant)
        self.assertEqual(call_kwargs["review_id"], self.review.REVW_ID)
        self.assertEqual(call_kwargs["text"], "Thank you!")
        self.assertEqual(len(call_kwargs["photos"]), 2)
        self.assertEqual(call_kwargs["photos"][0].name, "reply-1.jpg")
        self.assertEqual(call_kwargs["photos"][1].name, "reply-2.jpg")

    def test_create_reply_rejects_more_than_three_photos(self):
        photos = [self.create_test_image(f"reply-{i}.jpg") for i in range(4)]

        response = self.client.post(
            self.url,
            {"text": "Too many photos.", "photos": photos},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("photos", response.data["errors"])
        self.assertFalse(ReviewReply.objects.filter(REVW_ID=self.review).exists())

# new test class in the reply views test file
class ReviewReplyDetailViewTests(APITestCase):
    """Tests for the review reply update/delete endpoint."""

    def setUp(self):
        self.merchant = User.objects.create_user(
            email="merchant-reply-detail@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.other_merchant = User.objects.create_user(
            email="other-merchant-reply-detail@example.com",
            password="StrongPassword123!",
            USER_FNAME="Other",
            USER_LNAME="Merchant",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.explorer = User.objects.create_user(
            email="explorer-reply-detail@example.com",
            password="StrongPassword123!",
            USER_FNAME="Explorer",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.client.force_authenticate(self.merchant)

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
            LOCT_POINT=Point(123.8854, 10.3157, srid=4326),
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

        self.review = ReviewService.create_review(
            user=self.explorer,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        self.reply = ReviewReplyService.create_reply(
            user=self.merchant,
            review_id=self.review.REVW_ID,
            text="Original reply.",
        )

        self.detail_url = f"/api/reviews/replies/{self.reply.RPLY_ID}/"

    def test_update_reply_returns_200_not_500(self):
        """Regression test mirroring the review-update bug: confirms the
        object returned by update_reply serializes cleanly through
        ReviewReplyResponseSerializer with no missing-field crash."""

        response = self.client.patch(
            self.detail_url,
            {"text": "Updated reply text."},
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

    def test_update_reply_response_contains_expected_fields(self):
        response = self.client.patch(
            self.detail_url,
            {"text": "Updated reply text."},
            format="multipart",
        )

        data = response.data["data"]

        self.assertEqual(data["text"], "Updated reply text.")
        self.assertIn("id", data)
        self.assertIn("created_at", data)
        self.assertIn("updated_at", data)
        self.assertIn("photos", data)

    def test_update_reply_rejects_non_owner_merchant(self):
        self.client.force_authenticate(self.other_merchant)

        response = self.client.patch(
            self.detail_url,
            {"text": "Should not be allowed."},
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self.reply.refresh_from_db()
        self.assertEqual(self.reply.RPLY_TEXT, "Original reply.")

    def test_delete_reply_removes_reply(self):
        response = self.client.delete(self.detail_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(
            ReviewReply.objects.filter(RPLY_ID=self.reply.RPLY_ID).exists(),
        )

    def test_delete_reply_rejects_non_owner_merchant(self):
        self.client.force_authenticate(self.other_merchant)

        response = self.client.delete(self.detail_url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(
            ReviewReply.objects.filter(RPLY_ID=self.reply.RPLY_ID).exists(),
        )