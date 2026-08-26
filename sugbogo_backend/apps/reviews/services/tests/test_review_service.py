from io import BytesIO
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from PIL import Image
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.business.models import (
    Business,
    BusinessVouch,
    Category,
    Cluster,
    Location,
    SpecialtyTag,
)
from apps.reviews.models import Review, ReviewPhoto
from apps.reviews.services.review_service import ReviewService
from apps.users.models import User


class ReviewServiceTests(TestCase):
    """Tests for creating, updating, and deleting business reviews."""

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
            USER_ID=cls.user,
            CTGRY_ID=cls.category,
            LOCT_ID=cls.location,
        )

    @staticmethod
    def create_test_image(
        filename="review.jpg",
        width=100,
        height=100,
    ):
        """Create a valid in-memory JPEG for review photo tests."""

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

    @patch(
        "apps.reviews.services.review_service.CloudinaryService.upload_image",
    )
    def test_create_review(self, mock_upload):
        review = ReviewService.create_review(
            user=self.user,
            business_id=self.business.BUSN_ID,
            text="Great food and excellent service.",
            device_id="test-device-001",
        )

        self.assertEqual(
            review.USER_ID_id,
            self.user.USER_ID,
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

        self.assertFalse(
            ReviewPhoto.objects.exists(),
        )

        self.business.refresh_from_db()

        self.assertEqual(
            self.business.BUSN_REVIEW_COUNT,
            1,
        )

        mock_upload.assert_not_called()

    @patch(
        "apps.reviews.services.review_service.CloudinaryService.upload_image",
    )
    def test_create_review_with_photos(self, mock_upload):
        first_photo = self.create_test_image(
            "review-1.jpg",
        )
        second_photo = self.create_test_image(
            "review-2.jpg",
        )

        mock_upload.side_effect = [
            {
                "public_id": "sugbogo/reviews/review-1",
                "secure_url": (
                    "https://res.cloudinary.com/test/review-1.jpg"
                ),
            },
            {
                "public_id": "sugbogo/reviews/review-2",
                "secure_url": (
                    "https://res.cloudinary.com/test/review-2.jpg"
                ),
            },
        ]

        review = ReviewService.create_review(
            user=self.user,
            business_id=self.business.BUSN_ID,
            text="Great food.",
            photos=[
                first_photo,
                second_photo,
            ],
        )

        photos = ReviewPhoto.objects.filter(
            REVW_ID=review,
        )

        self.assertEqual(
            photos.count(),
            2,
        )

        self.assertTrue(
            photos.filter(
                RPHO_PHOTO_PUBLIC_ID="sugbogo/reviews/review-1",
                RPHO_PHOTO_URL=(
                    "https://res.cloudinary.com/test/review-1.jpg"
                ),
            ).exists(),
        )

        self.assertTrue(
            photos.filter(
                RPHO_PHOTO_PUBLIC_ID="sugbogo/reviews/review-2",
                RPHO_PHOTO_URL=(
                    "https://res.cloudinary.com/test/review-2.jpg"
                ),
            ).exists(),
        )

        self.assertEqual(
            mock_upload.call_count,
            2,
        )

        for call in mock_upload.call_args_list:
            self.assertEqual(
                call.kwargs["folder"],
                "sugbogo/reviews",
            )

        self.business.refresh_from_db()

        self.assertEqual(
            self.business.BUSN_REVIEW_COUNT,
            1,
        )

    @patch(
        "apps.reviews.services.review_service.CloudinaryService.delete_image",
    )
    @patch(
        "apps.reviews.services.review_service.CloudinaryService.upload_image",
    )
    def test_create_review_cleans_up_uploaded_photos_when_upload_fails(
        self,
        mock_upload,
        mock_delete,
    ):
        first_photo = self.create_test_image(
            "review-1.jpg",
        )
        second_photo = self.create_test_image(
            "review-2.jpg",
        )

        mock_upload.side_effect = [
            {
                "public_id": "sugbogo/reviews/review-1",
                "secure_url": (
                    "https://res.cloudinary.com/test/review-1.jpg"
                ),
            },
            RuntimeError("Cloudinary upload failed."),
        ]

        with self.assertRaises(
            RuntimeError,
        ):
            ReviewService.create_review(
                user=self.user,
                business_id=self.business.BUSN_ID,
                text="Great food.",
                photos=[
                    first_photo,
                    second_photo,
                ],
            )

        mock_delete.assert_called_once_with(
            "sugbogo/reviews/review-1",
        )

        self.assertFalse(
            Review.objects.exists(),
        )

        self.assertFalse(
            ReviewPhoto.objects.exists(),
        )

        self.business.refresh_from_db()

        self.assertEqual(
            self.business.BUSN_REVIEW_COUNT,
            0,
        )

    def test_create_review_rejects_nonexistent_business(self):
        with self.assertRaisesMessage(
            NotFound,
            "The business could not be found.",
        ):
            ReviewService.create_review(
                user=self.user,
                business_id=999999,
                text="Great food.",
            )

    def test_create_review_rejects_duplicate_review(self):
        ReviewService.create_review(
            user=self.user,
            business_id=self.business.BUSN_ID,
            text="First review.",
        )

        with self.assertRaisesMessage(
            ValidationError,
            "You have already reviewed this business.",
        ):
            ReviewService.create_review(
                user=self.user,
                business_id=self.business.BUSN_ID,
                text="Second review.",
            )

        self.assertEqual(
            Review.objects.filter(
                USER_ID=self.user,
                BUSN_ID=self.business,
            ).count(),
            1,
        )

        self.business.refresh_from_db()

        self.assertEqual(
            self.business.BUSN_REVIEW_COUNT,
            1,
        )

    def test_get_review_preview_includes_author_vouched_specialties(self):
        review = ReviewService.create_review(
            user=self.user,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        tag = SpecialtyTag.objects.create(
            TAG_NAME="Authentic Cebuano Food",
        )

        BusinessVouch.objects.create(
            BUSN_ID=self.business,
            USER_ID=self.user,
            TAG_ID=tag,
        )

        reviews = ReviewService.get_review_preview(
            business_id=self.business.BUSN_ID,
            user=self.second_user,
        )

        self.assertEqual(
            len(reviews),
            1,
        )

        self.assertEqual(
            reviews[0].REVW_ID,
            review.REVW_ID,
        )

        self.assertEqual(
            len(reviews[0].vouched_specialties),
            1,
        )

        self.assertEqual(
            reviews[0].vouched_specialties[0].TAG_ID_id,
            tag.TAG_ID,
        )

    def test_get_review_preview_limits_results_to_three_reviews(self):
        review_users = [
            self.user,
            self.second_user,
        ]

        for index in range(3):
            if index >= len(review_users):
                user = User.objects.create_user(
                    email=f"preview-user-{index}@example.com",
                    password="StrongPassword123!",
                    USER_FNAME=f"Preview{index}",
                    USER_LNAME="User",
                    USER_ROLE=User.UserRole.EXPLORER,
                    USER_STATUS=User.UserStatus.ACTIVE,
                )

                review_users.append(user)

            ReviewService.create_review(
                user=review_users[index],
                business_id=self.business.BUSN_ID,
                text=f"Review {index + 1}.",
            )

        reviews = ReviewService.get_review_preview(
            business_id=self.business.BUSN_ID,
            user=self.user,
        )

        self.assertEqual(
            len(reviews),
            3,
        )

    def test_list_reviews_includes_author_vouched_specialties(self):
        review = ReviewService.create_review(
            user=self.user,
            business_id=self.business.BUSN_ID,
            text="Great local restaurant.",
        )

        first_tag = SpecialtyTag.objects.create(
            TAG_NAME="Local Favorite",
        )

        second_tag = SpecialtyTag.objects.create(
            TAG_NAME="Authentic Food",
        )

        BusinessVouch.objects.create(
            BUSN_ID=self.business,
            USER_ID=self.user,
            TAG_ID=first_tag,
        )

        BusinessVouch.objects.create(
            BUSN_ID=self.business,
            USER_ID=self.user,
            TAG_ID=second_tag,
        )

        reviews = ReviewService.list_reviews(
            business_id=self.business.BUSN_ID,
            user=self.second_user,
        )

        self.assertEqual(
            len(reviews),
            1,
        )

        self.assertEqual(
            reviews[0].REVW_ID,
            review.REVW_ID,
        )

        vouched_specialties = reviews[0].vouched_specialties

        self.assertEqual(
            len(vouched_specialties),
            2,
        )

        self.assertSetEqual(
            {
                vouch.TAG_ID_id
                for vouch in vouched_specialties
            },
            {
                first_tag.TAG_ID,
                second_tag.TAG_ID,
            },
        )

    def test_list_reviews_excludes_vouches_from_other_businesses(self):
        review = ReviewService.create_review(
            user=self.user,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        other_location = Location.objects.create(
            LOCT_POINT=Point(
                123.9000,
                10.3200,
                srid=4326,
            ),
            LOCT_ADDRESS="Other Street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )

        other_business = Business.objects.create(
            BUSN_NAME="Other Bistro",
            BUSN_DESCRIPTION="Another local restaurant.",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=self.second_user,
            CTGRY_ID=self.category,
            LOCT_ID=other_location,
        )

        tag = SpecialtyTag.objects.create(
            TAG_NAME="Hidden Specialty",
        )

        BusinessVouch.objects.create(
            BUSN_ID=other_business,
            USER_ID=self.user,
            TAG_ID=tag,
        )

        reviews = ReviewService.list_reviews(
            business_id=self.business.BUSN_ID,
            user=self.second_user,
        )

        self.assertEqual(
            len(reviews),
            1,
        )

        self.assertEqual(
            reviews[0].REVW_ID,
            review.REVW_ID,
        )

        self.assertEqual(
            reviews[0].vouched_specialties,
            [],
        )

    def test_list_reviews_returns_empty_vouched_specialties_when_author_has_none(
        self,
    ):
        ReviewService.create_review(
            user=self.user,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        reviews = ReviewService.list_reviews(
            business_id=self.business.BUSN_ID,
            user=self.second_user,
        )

        self.assertEqual(
            len(reviews),
            1,
        )

        self.assertEqual(
            reviews[0].vouched_specialties,
            [],
        )

    def test_update_review_text(self):
        review = ReviewService.create_review(
            user=self.user,
            business_id=self.business.BUSN_ID,
            text="Original review.",
        )

        updated_review = ReviewService.update_review(
            user=self.user,
            review_id=review.REVW_ID,
            text="Updated review.",
        )

        self.assertEqual(
            updated_review.REVW_TEXT,
            "Updated review.",
        )

        review.refresh_from_db()

        self.assertEqual(
            review.REVW_TEXT,
            "Updated review.",
        )

    def test_update_review_rejects_non_owner(self):
        review = ReviewService.create_review(
            user=self.user,
            business_id=self.business.BUSN_ID,
            text="Original review.",
        )

        with self.assertRaisesMessage(
            PermissionDenied,
            "You do not have permission to update this review.",
        ):
            ReviewService.update_review(
                user=self.second_user,
                review_id=review.REVW_ID,
                text="Unauthorized update.",
            )

        review.refresh_from_db()

        self.assertEqual(
            review.REVW_TEXT,
            "Original review.",
        )

    def test_update_review_rejects_nonexistent_photo_id(self):
        review = ReviewService.create_review(
            user=self.user,
            business_id=self.business.BUSN_ID,
            text="Original review.",
        )

        with self.assertRaisesMessage(
            ValidationError,
            "One or more review photos could not be found.",
        ):
            ReviewService.update_review(
                user=self.user,
                review_id=review.REVW_ID,
                keep_photo_ids=[999999],
            )

    @patch(
        "apps.reviews.services.review_service.CloudinaryService.upload_image",
    )
    def test_update_review_adds_photos(self, mock_upload):
        review = ReviewService.create_review(
            user=self.user,
            business_id=self.business.BUSN_ID,
            text="Original review.",
        )

        first_photo = self.create_test_image(
            "review-1.jpg",
        )

        mock_upload.return_value = {
            "public_id": "sugbogo/reviews/review-1",
            "secure_url": (
                "https://res.cloudinary.com/test/review-1.jpg"
            ),
        }

        ReviewService.update_review(
            user=self.user,
            review_id=review.REVW_ID,
            photos=[
                first_photo,
            ],
        )

        self.assertEqual(
            ReviewPhoto.objects.filter(
                REVW_ID=review,
            ).count(),
            1,
        )

        mock_upload.assert_called_once_with(
            first_photo,
            folder="sugbogo/reviews",
        )

    @patch(
        "apps.reviews.services.review_service.CloudinaryService.delete_image",
    )
    @patch(
        "apps.reviews.services.review_service.CloudinaryService.upload_image",
    )
    def test_update_review_keeps_selected_photos_and_removes_others(
        self,
        mock_upload,
        mock_delete,
    ):
        review = ReviewService.create_review(
            user=self.user,
            business_id=self.business.BUSN_ID,
            text="Original review.",
        )

        first_photo = ReviewPhoto.objects.create(
            REVW_ID=review,
            RPHO_PHOTO_URL=(
                "https://res.cloudinary.com/test/first.jpg"
            ),
            RPHO_PHOTO_PUBLIC_ID=(
                "sugbogo/reviews/first"
            ),
        )

        second_photo = ReviewPhoto.objects.create(
            REVW_ID=review,
            RPHO_PHOTO_URL=(
                "https://res.cloudinary.com/test/second.jpg"
            ),
            RPHO_PHOTO_PUBLIC_ID=(
                "sugbogo/reviews/second"
            ),
        )

        ReviewService.update_review(
            user=self.user,
            review_id=review.REVW_ID,
            keep_photo_ids=[
                first_photo.RPHO_ID,
            ],
        )

        self.assertTrue(
            ReviewPhoto.objects.filter(
                RPHO_ID=first_photo.RPHO_ID,
            ).exists(),
        )

        self.assertFalse(
            ReviewPhoto.objects.filter(
                RPHO_ID=second_photo.RPHO_ID,
            ).exists(),
        )

        mock_delete.assert_called_once_with(
            "sugbogo/reviews/second",
        )

    def test_update_review_rejects_more_than_three_photos(self):
        review = ReviewService.create_review(
            user=self.user,
            business_id=self.business.BUSN_ID,
            text="Original review.",
        )

        first_photo = ReviewPhoto.objects.create(
            REVW_ID=review,
            RPHO_PHOTO_URL=(
                "https://res.cloudinary.com/test/first.jpg"
            ),
            RPHO_PHOTO_PUBLIC_ID=(
                "sugbogo/reviews/first"
            ),
        )

        second_photo = ReviewPhoto.objects.create(
            REVW_ID=review,
            RPHO_PHOTO_URL=(
                "https://res.cloudinary.com/test/second.jpg"
            ),
            RPHO_PHOTO_PUBLIC_ID=(
                "sugbogo/reviews/second"
            ),
        )

        third_photo = ReviewPhoto.objects.create(
            REVW_ID=review,
            RPHO_PHOTO_URL=(
                "https://res.cloudinary.com/test/third.jpg"
            ),
            RPHO_PHOTO_PUBLIC_ID=(
                "sugbogo/reviews/third"
            ),
        )

        fourth_photo = self.create_test_image(
            "review-4.jpg",
        )

        with self.assertRaisesMessage(
            ValidationError,
            "You can only upload a maximum of 3 photos.",
        ):
            ReviewService.update_review(
                user=self.user,
                review_id=review.REVW_ID,
                keep_photo_ids=[
                    first_photo.RPHO_ID,
                    second_photo.RPHO_ID,
                    third_photo.RPHO_ID,
                ],
                photos=[
                    fourth_photo,
                ],
            )

    @patch(
        "apps.reviews.services.review_service.CloudinaryService.delete_image",
    )
    def test_delete_review(self, mock_delete):
        review = ReviewService.create_review(
            user=self.user,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        ReviewPhoto.objects.create(
            REVW_ID=review,
            RPHO_PHOTO_URL=(
                "https://res.cloudinary.com/test/review.jpg"
            ),
            RPHO_PHOTO_PUBLIC_ID=(
                "sugbogo/reviews/review"
            ),
        )

        ReviewService.delete_review(
            user=self.user,
            review_id=review.REVW_ID,
        )

        self.assertFalse(
            Review.objects.filter(
                REVW_ID=review.REVW_ID,
            ).exists(),
        )

        self.assertFalse(
            ReviewPhoto.objects.filter(
                REVW_ID=review.REVW_ID,
            ).exists(),
        )

        mock_delete.assert_called_once_with(
            "sugbogo/reviews/review",
        )

        self.business.refresh_from_db()

        self.assertEqual(
            self.business.BUSN_REVIEW_COUNT,
            0,
        )

    def test_delete_review_rejects_non_owner(self):
        review = ReviewService.create_review(
            user=self.user,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        with self.assertRaisesMessage(
            PermissionDenied,
            "You do not have permission to delete this review.",
        ):
            ReviewService.delete_review(
                user=self.second_user,
                review_id=review.REVW_ID,
            )

        self.assertTrue(
            Review.objects.filter(
                REVW_ID=review.REVW_ID,
            ).exists(),
        )

    def test_delete_review_rejects_nonexistent_review(self):
        with self.assertRaisesMessage(
            NotFound,
            "The review could not be found.",
        ):
            ReviewService.delete_review(
                user=self.user,
                review_id=999999,
            )

    @patch(
        "apps.reviews.services.review_service.CloudinaryService.delete_image",
    )
    def test_delete_photo(self, mock_delete):
        review = ReviewService.create_review(
            user=self.user,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        photo = ReviewPhoto.objects.create(
            REVW_ID=review,
            RPHO_PHOTO_URL=(
                "https://res.cloudinary.com/test/review.jpg"
            ),
            RPHO_PHOTO_PUBLIC_ID=(
                "sugbogo/reviews/review"
            ),
        )

        ReviewService.delete_photo(
            user=self.user,
            photo_id=photo.RPHO_ID,
        )

        self.assertFalse(
            ReviewPhoto.objects.filter(
                RPHO_ID=photo.RPHO_ID,
            ).exists(),
        )

        mock_delete.assert_called_once_with(
            "sugbogo/reviews/review",
        )

    def test_delete_photo_rejects_nonexistent_photo(self):
        with self.assertRaisesMessage(
            NotFound,
            "The review photo could not be found.",
        ):
            ReviewService.delete_photo(
                user=self.user,
                photo_id=999999,
            )

    def test_delete_photo_rejects_non_owner(self):
        review = ReviewService.create_review(
            user=self.user,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        photo = ReviewPhoto.objects.create(
            REVW_ID=review,
            RPHO_PHOTO_URL=(
                "https://res.cloudinary.com/test/review.jpg"
            ),
            RPHO_PHOTO_PUBLIC_ID=(
                "sugbogo/reviews/review"
            ),
        )

        with self.assertRaisesMessage(
            PermissionDenied,
            "You do not have permission to delete this review photo.",
        ):
            ReviewService.delete_photo(
                user=self.second_user,
                photo_id=photo.RPHO_ID,
            )

        self.assertTrue(
            ReviewPhoto.objects.filter(
                RPHO_ID=photo.RPHO_ID,
            ).exists(),
        )

    def test_get_review_preview_prioritizes_current_users_review(self):
        ReviewService.create_review(
            user=self.user,
            business_id=self.business.BUSN_ID,
            text="My review.",
        )

        other_users = []

        for index in range(3):
            user = User.objects.create_user(
                email=f"preview-other-{index}@example.com",
                password="StrongPassword123!",
                USER_FNAME=f"Other{index}",
                USER_LNAME="User",
                USER_ROLE=User.UserRole.EXPLORER,
                USER_STATUS=User.UserStatus.ACTIVE,
            )

            other_users.append(user)

            ReviewService.create_review(
                user=user,
                business_id=self.business.BUSN_ID,
                text=f"Other review {index}.",
            )

        reviews = ReviewService.get_review_preview(
            business_id=self.business.BUSN_ID,
            user=self.user,
        )

        self.assertEqual(
            len(reviews),
            3,
        )

        self.assertEqual(
            reviews[0].USER_ID_id,
            self.user.USER_ID,
        )

        self.assertTrue(
            reviews[0].is_own_review,
        )

        self.assertFalse(
            reviews[1].is_own_review,
        )

        self.assertFalse(
            reviews[2].is_own_review,
        )


    def test_list_reviews_marks_current_users_review(self):
        own_review = ReviewService.create_review(
            user=self.user,
            business_id=self.business.BUSN_ID,
            text="My review.",
        )

        other_user = User.objects.create_user(
            email="other-reviewer@example.com",
            password="StrongPassword123!",
            USER_FNAME="Other",
            USER_LNAME="Reviewer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        ReviewService.create_review(
            user=other_user,
            business_id=self.business.BUSN_ID,
            text="Someone else's review.",
        )

        reviews = list(
            ReviewService.list_reviews(
                business_id=self.business.BUSN_ID,
                user=self.user,
            )
        )

        own_review_result = next(
            review
            for review in reviews
            if review.REVW_ID == own_review.REVW_ID
        )

        other_review_result = next(
            review
            for review in reviews
            if review.USER_ID_id == other_user.USER_ID
        )

        self.assertTrue(
            own_review_result.is_own_review,
        )

        self.assertFalse(
            other_review_result.is_own_review,
        )