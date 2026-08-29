from io import BytesIO
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from PIL import Image
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.business.models import (
    Business,
    Category,
    Cluster,
    Location,
)
from apps.reviews.models import ReplyPhoto, ReviewReply
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

        cls.other_merchant = User.objects.create_user(
            email="other-merchant@example.com",
            password="StrongPassword123!",
            USER_FNAME="Other",
            USER_LNAME="Merchant",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        cls.other_location = Location.objects.create(
            LOCT_POINT=Point(123.9000, 10.3200, srid=4326),
            LOCT_ADDRESS="Other Street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )

        cls.other_business = Business.objects.create(
            BUSN_NAME="Other Bistro",
            BUSN_DESCRIPTION="A different restaurant.",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=cls.other_merchant,
            CTGRY_ID=cls.category,
            LOCT_ID=cls.other_location,
        )

    def create_test_image(self, filename):
        image = Image.new(
            "RGB",
            (100, 100),
            "white",
        )

        image_data = BytesIO()

        image.save(
            image_data,
            format="JPEG",
        )

        image_data.seek(0)

        return SimpleUploadedFile(
            filename,
            image_data.read(),
            content_type="image/jpeg",
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

    def test_create_reply_rejects_merchant_from_different_business(self):
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
                user=self.other_merchant,
                review_id=review.REVW_ID,
                text="I own a different business.",
            )

        self.assertFalse(
            ReviewReply.objects.filter(REVW_ID=review).exists(),
        )

    def test_update_reply_rejects_merchant_from_different_business(self):
        review = ReviewService.create_review(
            user=self.explorer,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        reply = ReviewReplyService.create_reply(
            user=self.merchant,
            review_id=review.REVW_ID,
            text="Original reply.",
        )

        with self.assertRaisesMessage(
            PermissionDenied,
            "You do not have permission to manage this review reply.",
        ):
            ReviewReplyService.update_reply(
                user=self.other_merchant,
                reply_id=reply.RPLY_ID,
                text="Tampered reply.",
            )

        reply.refresh_from_db()
        self.assertEqual(reply.RPLY_TEXT, "Original reply.")


    def test_delete_reply_rejects_merchant_from_different_business(self):
        review = ReviewService.create_review(
            user=self.explorer,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        reply = ReviewReplyService.create_reply(
            user=self.merchant,
            review_id=review.REVW_ID,
            text="Original reply.",
        )

        with self.assertRaisesMessage(
            PermissionDenied,
            "You do not have permission to manage this review reply.",
        ):
            ReviewReplyService.delete_reply(
                user=self.other_merchant,
                reply_id=reply.RPLY_ID,
            )

        self.assertTrue(
            ReviewReply.objects.filter(RPLY_ID=reply.RPLY_ID).exists(),
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

    @patch("apps.reviews.services.review_reply_service.CloudinaryService.delete_image")
    def test_delete_reply_cleans_up_reply_photos(self, mock_delete):
        review = ReviewService.create_review(user=self.explorer, business_id=self.business.BUSN_ID, text="Great food.")
        reply = ReviewReplyService.create_reply(user=self.merchant, review_id=review.REVW_ID, text="Thank you.")
        ReplyPhoto.objects.create(RPLY_ID=reply, RPHO_PHOTO_URL="https://example.com/a.jpg", RPHO_PHOTO_PUBLIC_ID="reply/a")

        ReviewReplyService.delete_reply(self.merchant, reply.RPLY_ID)

        self.assertFalse(ReviewReply.objects.filter(RPLY_ID=reply.RPLY_ID).exists())
        mock_delete.assert_called_once_with("reply/a")


    @patch("apps.reviews.services.review_reply_service.CloudinaryService.delete_image")
    @patch("apps.reviews.services.review_reply_service.CloudinaryService.upload_image")
    def test_create_reply_cleans_up_uploaded_photos_when_upload_fails(
        self,
        mock_upload,
        mock_delete,
    ):
        review = ReviewService.create_review(
            user=self.explorer,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        first_photo = self.create_test_image("reply-1.jpg")
        second_photo = self.create_test_image("reply-2.jpg")

        mock_upload.side_effect = [
            {
                "public_id": "sugbogo/review-replies/reply-1",
                "secure_url": "https://res.cloudinary.com/test/reply-1.jpg",
            },
            RuntimeError("Cloudinary upload failed."),
        ]

        with self.assertRaises(RuntimeError):
            ReviewReplyService.create_reply(
                user=self.merchant,
                review_id=review.REVW_ID,
                text="Thank you!",
                photos=[first_photo, second_photo],
            )

        mock_delete.assert_called_once_with(
            "sugbogo/review-replies/reply-1",
        )

        self.assertFalse(
            ReviewReply.objects.filter(REVW_ID=review).exists(),
        )

        self.assertFalse(
            ReplyPhoto.objects.exists(),
        )



class ReplyPhotoServiceTests(TestCase):
    """Tests for deleting individual reply photos."""

    @classmethod
    def setUpTestData(cls):
        cls.merchant = User.objects.create_user(
            email="reply-photo-merchant@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        cls.other_merchant = User.objects.create_user(
            email="reply-photo-other-merchant@example.com",
            password="StrongPassword123!",
            USER_FNAME="Other",
            USER_LNAME="Merchant",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        cls.explorer = User.objects.create_user(
            email="reply-photo-explorer@example.com",
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
            LOCT_POINT=Point(123.8854, 10.3157, srid=4326),
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

    def _create_reply_with_photo(self):
        review = ReviewService.create_review(
            user=self.explorer,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        reply = ReviewReplyService.create_reply(
            user=self.merchant,
            review_id=review.REVW_ID,
            text="Thank you!",
        )

        photo = ReplyPhoto.objects.create(
            RPLY_ID=reply,
            RPHO_PHOTO_URL="https://res.cloudinary.com/test/reply.jpg",
            RPHO_PHOTO_PUBLIC_ID="sugbogo/review-replies/reply",
        )

        return reply, photo

    @patch(
        "apps.reviews.services.review_reply_service.CloudinaryService.delete_image",
    )
    def test_delete_photo(self, mock_delete):
        _, photo = self._create_reply_with_photo()

        ReviewReplyService.delete_photo(
            user=self.merchant,
            photo_id=photo.RPHO_ID,
        )

        self.assertFalse(
            ReplyPhoto.objects.filter(RPHO_ID=photo.RPHO_ID).exists(),
        )

        mock_delete.assert_called_once_with(
            "sugbogo/review-replies/reply",
        )

    def test_delete_photo_rejects_nonexistent_photo(self):
        with self.assertRaisesMessage(
            NotFound,
            "The reply photo could not be found.",
        ):
            ReviewReplyService.delete_photo(
                user=self.merchant,
                photo_id=999999,
            )

    def test_delete_photo_rejects_non_owner(self):
        _, photo = self._create_reply_with_photo()

        with self.assertRaisesMessage(
            PermissionDenied,
            "You do not have permission to manage this review reply.",
        ):
            ReviewReplyService.delete_photo(
                user=self.other_merchant,
                photo_id=photo.RPHO_ID,
            )

        self.assertTrue(
            ReplyPhoto.objects.filter(RPHO_ID=photo.RPHO_ID).exists(),
        )