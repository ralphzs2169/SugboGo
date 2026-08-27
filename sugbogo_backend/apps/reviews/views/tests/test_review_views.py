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
from apps.reviews.models import Review
from apps.reviews.services.review_service import ReviewService
from apps.users.models import User


class ReviewViewTests(APITestCase):
    """Tests for business review API endpoints."""

    def setUp(self):
        self.merchant = User.objects.create_user(
            email="merchant-review@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.explorer = User.objects.create_user(
            email="explorer-review@example.com",
            password="StrongPassword123!",
            USER_FNAME="Explorer",
            USER_LNAME="User",
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

        self.preview_url = (
            f"/api/reviews/business/{self.business.BUSN_ID}/"
        )

        self.list_url = (
            f"/api/reviews/business/{self.business.BUSN_ID}/all/"
        )

    @staticmethod
    def create_test_image(
        filename="test-image.jpg",
        width=100,
        height=100,
    ):
        """Create a valid in-memory JPEG for upload tests."""

        image = Image.new(
            "RGB",
            (width, height),
        )

        image_file = BytesIO()

        image.save(
            image_file,
            format="JPEG",
        )

        image_file.seek(0)

        return SimpleUploadedFile(
            filename,
            image_file.read(),
            content_type="image/jpeg",
        )

    @staticmethod
    def create_large_test_image(
        filename="large-review.jpg",
    ):
        """Create a valid JPEG larger than 10 MB for upload validation."""

        image = Image.new(
            "RGB",
            (100, 100),
        )

        image_file = BytesIO()

        image.save(
            image_file,
            format="JPEG",
        )

        image_data = image_file.getvalue()

        image_data += b"\x00" * (
            10 * 1024 * 1024 + 1 - len(image_data)
        )

        return SimpleUploadedFile(
            filename,
            image_data,
            content_type="image/jpeg",
        )

    def test_create_review_successfully(self):
        payload = {
            "text": "Great food and excellent service.",
            "device_id": "test-device-001",
        }

        response = self.client.post(
            self.preview_url,
            payload,
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        review = Review.objects.get(
            REVW_ID=response.data["data"]["id"],
        )

        self.assertEqual(
            review.USER_ID_id,
            self.explorer.USER_ID,
        )

        self.assertEqual(
            review.BUSN_ID_id,
            self.business.BUSN_ID,
        )

        self.assertEqual(
            review.REVW_TEXT,
            "Great food and excellent service.",
        )

        self.assertEqual(
            review.REVW_DEVICE_ID,
            "test-device-001",
        )

        self.assertEqual(
            response.data["message"],
            "Review added successfully.",
        )

        self.assertEqual(
            response.data["data"]["business_id"],
            self.business.BUSN_ID,
        )

    def test_get_review_preview_returns_maximum_three_reviews(self):
        for index in range(5):
            user = self.explorer

            if index > 0:
                user = User.objects.create_user(
                    email=f"reviewer-{index}@example.com",
                    password="StrongPassword123!",
                    USER_FNAME=f"Reviewer{index}",
                    USER_LNAME="User",
                    USER_ROLE=User.UserRole.EXPLORER,
                    USER_STATUS=User.UserStatus.ACTIVE,
                )

            Review.objects.create(
                USER_ID=user,
                BUSN_ID=self.business,
                REVW_TEXT=f"Review {index + 1}.",
            )

        response = self.client.get(
            self.preview_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertTrue(
            response.data["success"],
        )

        self.assertEqual(
            response.data["message"],
            "Review preview retrieved successfully.",
        )

        self.assertEqual(
            len(response.data["data"]["reviews"]),
            3,
        )

    def test_get_all_reviews_returns_all_business_reviews(self):
        reviews = []

        for index in range(4):
            user = self.explorer

            if index > 0:
                user = User.objects.create_user(
                    email=f"all-reviewer-{index}@example.com",
                    password="StrongPassword123!",
                    USER_FNAME=f"Reviewer{index}",
                    USER_LNAME="User",
                    USER_ROLE=User.UserRole.EXPLORER,
                    USER_STATUS=User.UserStatus.ACTIVE,
                )

            reviews.append(
                Review.objects.create(
                    USER_ID=user,
                    BUSN_ID=self.business,
                    REVW_TEXT=f"Review {index + 1}.",
                ),
            )

        response = self.client.get(
            self.list_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertTrue(
            response.data["success"],
        )

        self.assertEqual(
            response.data["message"],
            "Reviews retrieved successfully.",
        )

        returned_reviews = response.data["data"]

        self.assertEqual(
            len(returned_reviews),
            4,
        )

        returned_ids = {
            review["id"]
            for review in returned_reviews
        }

        expected_ids = {
            review.REVW_ID
            for review in reviews
        }

        self.assertEqual(
            returned_ids,
            expected_ids,
        )

    @patch(
        "apps.reviews.views.review_views.ReviewService.create_review",
    )
    def test_create_review_with_photos(
        self,
        mock_create_review,
    ):
        first_photo = self.create_test_image(
            "review-1.jpg",
        )

        second_photo = self.create_test_image(
            "review-2.jpg",
        )

        mock_review = Review(
            REVW_ID=1,
            BUSN_ID=self.business,
            USER_ID=self.explorer,
        )

        mock_create_review.return_value = mock_review

        response = self.client.post(
            self.preview_url,
            {
                "text": "Great food.",
                "photos": [
                    first_photo,
                    second_photo,
                ],
            },
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        mock_create_review.assert_called_once()

        call_kwargs = mock_create_review.call_args.kwargs

        self.assertEqual(
            call_kwargs["user"],
            self.explorer,
        )

        self.assertEqual(
            call_kwargs["business_id"],
            self.business.BUSN_ID,
        )

        self.assertEqual(
            call_kwargs["text"],
            "Great food.",
        )

        self.assertEqual(
            len(call_kwargs["photos"]),
            2,
        )

        self.assertEqual(
            call_kwargs["photos"][0].name,
            "review-1.jpg",
        )

        self.assertEqual(
            call_kwargs["photos"][1].name,
            "review-2.jpg",
        )

        self.assertEqual(
            call_kwargs["photos"][0].content_type,
            "image/jpeg",
        )

        self.assertEqual(
            call_kwargs["photos"][1].content_type,
            "image/jpeg",
        )

    def test_create_review_rejects_more_than_three_photos(self):
        photos = [
            self.create_test_image(
                f"review-{index}.jpg",
            )
            for index in range(4)
        ]

        response = self.client.post(
            self.preview_url,
            {
                "text": "Too many photos.",
                "photos": photos,
            },
            format="multipart",
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
            "photos",
            response.data["errors"],
        )

        self.assertFalse(
            Review.objects.exists(),
        )

    def test_create_review_rejects_photo_over_10_mb(self):
        oversized_photo = self.create_large_test_image()

        self.assertGreater(
            oversized_photo.size,
            10 * 1024 * 1024,
        )

        response = self.client.post(
            self.preview_url,
            {
                "text": "Large photo.",
                "photos": [oversized_photo],
            },
            format="multipart",
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
            "photos",
            response.data["errors"],
        )

        self.assertFalse(
            Review.objects.exists(),
        )

    def test_create_review_rejects_invalid_photo_format(self):
        invalid_photo = SimpleUploadedFile(
            "review.txt",
            b"not an image",
            content_type="text/plain",
        )

        response = self.client.post(
            self.preview_url,
            {
                "text": "Invalid photo.",
                "photos": [invalid_photo],
            },
            format="multipart",
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
            "photos",
            response.data["errors"],
        )

        self.assertFalse(
            Review.objects.exists(),
        )

    def test_create_review_rejects_duplicate_review(self):
        ReviewService.create_review(
            user=self.explorer,
            business_id=self.business.BUSN_ID,
            text="First review.",
        )

        response = self.client.post(
            self.preview_url,
            {
                "text": "Second review.",
            },
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            response.data["message"],
            "You have already reviewed this business.",
        )

        self.assertEqual(
            Review.objects.filter(
                USER_ID=self.explorer,
                BUSN_ID=self.business,
            ).count(),
            1,
        )

    def test_create_review_rejects_missing_text(self):
        response = self.client.post(
            self.preview_url,
            {},
            format="multipart",
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

    def test_create_review_rejects_text_over_1000_characters(self):
        response = self.client.post(
            self.preview_url,
            {
                "text": "a" * 1001,
            },
            format="multipart",
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

    def test_create_review_rejects_invalid_business(self):
        response = self.client.post(
            "/api/reviews/business/999999/",
            {
                "text": "Great food.",
            },
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

        self.assertEqual(
            response.data["message"],
            "The business could not be found.",
        )

    def test_create_review_requires_authentication(self):
        self.client.force_authenticate(
            user=None,
        )

        response = self.client.post(
            self.preview_url,
            {
                "text": "Great food.",
            },
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

        self.assertFalse(
            Review.objects.exists(),
        )


class ReviewDetailViewTests(APITestCase):
    """Tests for the review update/delete endpoint."""

    def setUp(self):
        self.merchant = User.objects.create_user(
            email="merchant-detail@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.explorer = User.objects.create_user(
            email="explorer-detail@example.com",
            password="StrongPassword123!",
            USER_FNAME="Explorer",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.other_explorer = User.objects.create_user(
            email="other-explorer-detail@example.com",
            password="StrongPassword123!",
            USER_FNAME="Other",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.client.force_authenticate(self.explorer)

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
            text="Original review.",
        )

        self.detail_url = f"/api/reviews/{self.review.REVW_ID}/"

    def test_update_review_returns_200_not_500(self):
        """Regression test for the bug where PATCH threw an unhandled
        AttributeError because the object returned by update_review was
        missing is_own_review and vouched_specialties, which
        ReviewResponseSerializer requires."""

        response = self.client.patch(
            self.detail_url,
            {"text": "Updated review text."},
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

    def test_update_review_response_contains_all_required_fields(self):
        response = self.client.patch(
            self.detail_url,
            {"text": "Updated review text."},
            format="multipart",
        )

        data = response.data["data"]

        self.assertEqual(data["text"], "Updated review text.")
        self.assertIn("is_own_review", data)
        self.assertIn("is_liked", data)
        self.assertIn("vouched_specialties", data)
        self.assertTrue(data["is_own_review"])

    def test_update_review_persists_change(self):
        self.client.patch(
            self.detail_url,
            {"text": "Persisted update."},
            format="multipart",
        )

        self.review.refresh_from_db()

        self.assertEqual(
            self.review.REVW_TEXT,
            "Persisted update.",
        )

    def test_update_review_rejects_non_owner(self):
        self.client.force_authenticate(self.other_explorer)

        response = self.client.patch(
            self.detail_url,
            {"text": "Should not be allowed."},
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self.review.refresh_from_db()

        self.assertEqual(
            self.review.REVW_TEXT,
            "Original review.",
        )

    def test_update_review_rejects_nonexistent_review(self):
        response = self.client.patch(
            "/api/reviews/999999/",
            {"text": "Ghost review."},
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_delete_review_removes_review(self):
        response = self.client.delete(self.detail_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertFalse(
            Review.objects.filter(REVW_ID=self.review.REVW_ID).exists(),
        )

    def test_delete_review_rejects_non_owner(self):
        self.client.force_authenticate(self.other_explorer)

        response = self.client.delete(self.detail_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self.assertTrue(
            Review.objects.filter(REVW_ID=self.review.REVW_ID).exists(),
        )

    def test_update_review_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.patch(
            self.detail_url,
            {"text": "Unauthorized."},
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )