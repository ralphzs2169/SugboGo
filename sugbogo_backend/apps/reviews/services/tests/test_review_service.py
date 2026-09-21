from datetime import timedelta
from io import BytesIO
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
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
from apps.reviews.models import Review, ReviewLike, ReviewPhoto
from apps.reviews.serializers.review_serializers import ReviewResponseSerializer
from apps.reviews.services.review_service import ReviewService
from apps.users.models import User


class ReviewServiceTests(TestCase):
    """Tests for creating, updating, and deleting business reviews."""

    def setUp(self):
        # Existing service tests stay offline and independent of provisioned models.
        patcher = patch(
            "apps.reviews.services.review_service.route_sentiment",
            return_value=(0.75, "Positive", "vader"),
        )
        self.score_review = patcher.start()
        self.addCleanup(patcher.stop)

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
            VOUCH_REPUTATION_SNAPSHOT=self.user.USER_REPUTATION,
        )

        preview = ReviewService.get_review_preview(
            business_id=self.business.BUSN_ID,
            user=self.second_user,
        )

        reviews = preview["reviews"]

        self.assertEqual(len(reviews), 1)
        self.assertEqual(reviews[0].REVW_ID, review.REVW_ID)
        self.assertEqual(len(reviews[0].vouched_specialties), 1)
        self.assertEqual(reviews[0].vouched_specialties[0].TAG_ID_id, tag.TAG_ID)


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

        preview = ReviewService.get_review_preview(
            business_id=self.business.BUSN_ID,
            user=self.user,
        )

        reviews = preview["reviews"]

        self.assertEqual(len(reviews), 3)

    def test_list_reviews_excludes_non_published_reviews(self):
        published_review = ReviewService.create_review(
            user=self.user,
            business_id=self.business.BUSN_ID,
            text="Published review.",
        )

        flagged_user = User.objects.create_user(
            email="flagged-review@example.com",
            password="StrongPassword123!",
            USER_FNAME="Flagged",
            USER_LNAME="Reviewer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        rejected_user = User.objects.create_user(
            email="rejected-review@example.com",
            password="StrongPassword123!",
            USER_FNAME="Rejected",
            USER_LNAME="Reviewer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        flagged_review = ReviewService.create_review(
            user=flagged_user,
            business_id=self.business.BUSN_ID,
            text="Flagged review.",
        )

        rejected_review = ReviewService.create_review(
            user=rejected_user,
            business_id=self.business.BUSN_ID,
            text="Rejected review.",
        )

        flagged_review.REVW_STATUS = Review.ReviewStatus.FLAGGED
        flagged_review.save(
            update_fields=["REVW_STATUS"],
        )

        rejected_review.REVW_STATUS = Review.ReviewStatus.REJECTED
        rejected_review.save(
            update_fields=["REVW_STATUS"],
        )

        reviews = ReviewService.list_reviews(
            business_id=self.business.BUSN_ID,
            user=self.user,
        )

        review_ids = {
            review.REVW_ID
            for review in reviews
        }

        self.assertIn(
            published_review.REVW_ID,
            review_ids,
        )

        self.assertNotIn(
            flagged_review.REVW_ID,
            review_ids,
        )

        self.assertNotIn(
            rejected_review.REVW_ID,
            review_ids,
        )

    def test_get_review_preview_excludes_non_published_reviews(self):
        published_review = ReviewService.create_review(
            user=self.user,
            business_id=self.business.BUSN_ID,
            text="Published review.",
        )

        flagged_user = User.objects.create_user(
            email="preview-flagged@example.com",
            password="StrongPassword123!",
            USER_FNAME="Flagged",
            USER_LNAME="Reviewer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        rejected_user = User.objects.create_user(
            email="preview-rejected@example.com",
            password="StrongPassword123!",
            USER_FNAME="Rejected",
            USER_LNAME="Reviewer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        flagged_review = ReviewService.create_review(
            user=flagged_user,
            business_id=self.business.BUSN_ID,
            text="Flagged review.",
        )

        rejected_review = ReviewService.create_review(
            user=rejected_user,
            business_id=self.business.BUSN_ID,
            text="Rejected review.",
        )

        flagged_review.REVW_STATUS = Review.ReviewStatus.FLAGGED
        flagged_review.save(
            update_fields=["REVW_STATUS"],
        )

        rejected_review.REVW_STATUS = Review.ReviewStatus.REJECTED
        rejected_review.save(
            update_fields=["REVW_STATUS"],
        )

        preview = ReviewService.get_review_preview(
            business_id=self.business.BUSN_ID,
            user=self.user,
        )

        review_ids = {
            review.REVW_ID
            for review in preview["reviews"]
        }

        self.assertIn(
            published_review.REVW_ID,
            review_ids,
        )

        self.assertNotIn(
            flagged_review.REVW_ID,
            review_ids,
        )

        self.assertNotIn(
            rejected_review.REVW_ID,
            review_ids,
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
            VOUCH_REPUTATION_SNAPSHOT=self.user.USER_REPUTATION,
        )

        BusinessVouch.objects.create(
            BUSN_ID=self.business,
            USER_ID=self.user,
            TAG_ID=second_tag,
            VOUCH_REPUTATION_SNAPSHOT=self.user.USER_REPUTATION,
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

    def test_merchant_cannot_review_own_business(self):
        self.business.USER_ID = self.user
        self.business.save(
            update_fields=["USER_ID"],
        )

        with self.assertRaisesMessage(
            ValidationError,
            "You cannot review your own business.",
        ):
            ReviewService.create_review(
                user=self.user,
                business_id=self.business.BUSN_ID,
                text="I am reviewing my own business.",
            )

        self.assertFalse(
            Review.objects.filter(
                USER_ID=self.user,
                BUSN_ID=self.business,
            ).exists(),
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
            VOUCH_REPUTATION_SNAPSHOT=self.user.USER_REPUTATION,
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

    def test_get_review_preview_returns_three_most_recent_reviews(self):
        reviews = []

        for index in range(4):
            user = User.objects.create_user(
                email=f"preview-other-{index}@example.com",
                password="StrongPassword123!",
                USER_FNAME=f"Other{index}",
                USER_LNAME="User",
                USER_ROLE=User.UserRole.EXPLORER,
                USER_STATUS=User.UserStatus.ACTIVE,
            )

            reviews.append(
                ReviewService.create_review(
                    user=user,
                    business_id=self.business.BUSN_ID,
                    text=f"Review {index}.",
                )
            )

        preview = ReviewService.get_review_preview(
            business_id=self.business.BUSN_ID,
            user=self.user,
        )

        preview_reviews = preview["reviews"]

        self.assertEqual(len(preview_reviews), 3)

        # The preview should contain the three most recent reviews.
        self.assertEqual(
            [review.REVW_ID for review in preview_reviews],
            [review.REVW_ID for review in reviews[-3:][::-1]],
        )

        # Ownership is metadata, not a sorting priority.
        self.assertTrue(
            all(not review.is_own_review for review in preview_reviews)
        )


    def test_get_review_preview_does_not_prioritize_current_users_review(self):
        ReviewService.create_review(
            user=self.user,
            business_id=self.business.BUSN_ID,
            text="My older review.",
        )

        recent_reviews = []

        for index in range(3):
            user = User.objects.create_user(
                email=f"preview-recent-{index}@example.com",
                password="StrongPassword123!",
                USER_FNAME=f"Recent{index}",
                USER_LNAME="User",
                USER_ROLE=User.UserRole.EXPLORER,
                USER_STATUS=User.UserStatus.ACTIVE,
            )

            recent_reviews.append(
                ReviewService.create_review(
                    user=user,
                    business_id=self.business.BUSN_ID,
                    text=f"Recent review {index}.",
                )
            )

        preview = ReviewService.get_review_preview(
            business_id=self.business.BUSN_ID,
            user=self.user,
        )

        reviews = preview["reviews"]

        self.assertEqual(len(reviews), 3)
        self.assertTrue(
            all(not review.is_own_review for review in reviews)
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


    def test_get_review_detail_returns_full_response_fields(self):
        review = ReviewService.create_review(
            user=self.user,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        tag = SpecialtyTag.objects.create(
            TAG_NAME="Local Favorite",
        )

        BusinessVouch.objects.create(
            BUSN_ID=self.business,
            USER_ID=self.user,
            TAG_ID=tag,
            VOUCH_REPUTATION_SNAPSHOT=self.user.USER_REPUTATION,
        )

        result = ReviewService.get_review_detail(
            review_id=review.REVW_ID,
            user=self.user,
        )

        self.assertEqual(
            result.REVW_ID,
            review.REVW_ID,
        )

        # These are the exact three attributes that were missing and
        # caused the original AttributeError when this method didn't exist.
        self.assertTrue(
            result.is_own_review,
        )

        self.assertFalse(
            result.is_liked,
        )

        self.assertEqual(
            len(result.vouched_specialties),
            1,
        )

        self.assertEqual(
            result.vouched_specialties[0].TAG_ID_id,
            tag.TAG_ID,
        )

    def test_get_review_detail_reflects_is_liked_for_viewer(self):
        review = ReviewService.create_review(
            user=self.user,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        ReviewLike.objects.create(
            REVW_ID=review,
            USER_ID=self.second_user,
        )

        result = ReviewService.get_review_detail(
            review_id=review.REVW_ID,
            user=self.second_user,
        )

        self.assertTrue(
            result.is_liked,
        )

        self.assertFalse(
            result.is_own_review,
        )

    def test_get_review_detail_rejects_nonexistent_review(self):
        with self.assertRaisesMessage(
            NotFound,
            "The review could not be found.",
        ):
            ReviewService.get_review_detail(
                review_id=999999,
                user=self.user,
            )


    def test_update_review_then_get_detail_matches_view_flow(self):
        """Regression test: PATCH previously 500'd because update_review's
        return value was missing is_own_review/vouched_specialties, which
        ReviewResponseSerializer requires. This mirrors the exact call
        sequence ReviewDetailView.patch performs."""

        review = ReviewService.create_review(
            user=self.user,
            business_id=self.business.BUSN_ID,
            text="Original review.",
        )

        ReviewService.update_review(
            user=self.user,
            review_id=review.REVW_ID,
            text="Updated review.",
        )

        result = ReviewService.get_review_detail(
            review_id=review.REVW_ID,
            user=self.user,
        )

        self.assertEqual(
            result.REVW_TEXT,
            "Updated review.",
        )

        # Serializing this should not raise AttributeError.
        from apps.reviews.serializers.review_serializers import (
            ReviewResponseSerializer,
        )

        data = ReviewResponseSerializer(result).data

        self.assertEqual(
            data["text"],
            "Updated review.",
        )

        self.assertIn(
            "is_own_review",
            data,
        )

        self.assertIn(
            "vouched_specialties",
            data,
        )

    def test_sentiment_creation_and_text_edit(self):
        review = ReviewService.create_review(
            self.user, self.business.BUSN_ID, "Wonderful food and excellent service.",
        )
        review.refresh_from_db()
        self.assertEqual(review.REVW_SENTIMENT_SCORE, 0.75)
        self.assertEqual(review.REVW_SENTIMENT_LABEL, "positive")
        self.score_review.return_value = (-0.6, "Negative", "tagalog")
        ReviewService.update_review(self.user, review.REVW_ID, text="Bad")
        review.refresh_from_db()
        self.assertEqual(review.REVW_TEXT, "Bad")
        self.assertEqual(review.REVW_SENTIMENT_SCORE, -0.6)
        self.assertEqual(review.REVW_SENTIMENT_LABEL, "negative")
        self.score_review.assert_called_with("Bad")

    def test_photo_only_edit_preserves_sentiment_and_flags(self):
        review = Review.objects.create(
            USER_ID=self.user, BUSN_ID=self.business, REVW_TEXT="Existing review.",
            REVW_SENTIMENT_SCORE=-0.6, REVW_SENTIMENT_LABEL="negative",
            REVW_IS_SPAM_FLAGGED=True, REVW_IS_OUTLIER_SENTIMENT=True,
        )
        photo = ReviewPhoto.objects.create(
            REVW_ID=review, RPHO_PHOTO_URL="https://example.com/photo.jpg",
            RPHO_PHOTO_PUBLIC_ID="existing-photo",
        )
        with patch("apps.reviews.services.review_service.CloudinaryService.delete_image"):
            ReviewService.update_review(self.user, review.REVW_ID, keep_photo_ids=[])
        review.refresh_from_db()
        self.score_review.assert_not_called()
        self.assertFalse(ReviewPhoto.objects.filter(pk=photo.pk).exists())
        self.assertEqual(review.REVW_SENTIMENT_SCORE, -0.6)
        self.assertEqual(review.REVW_SENTIMENT_LABEL, "negative")
        self.assertTrue(review.REVW_IS_SPAM_FLAGGED)
        self.assertTrue(review.REVW_IS_OUTLIER_SENTIMENT)

    def test_blank_direct_service_calls_are_validation_errors(self):
        for text in ["", " \n\t"]:
            with self.subTest(text=text), self.assertRaises(ValidationError):
                ReviewService.create_review(self.user, self.business.BUSN_ID, text)
        review = Review.objects.create(
            USER_ID=self.user, BUSN_ID=self.business, REVW_TEXT="Original text.",
        )
        with self.assertRaises(ValidationError):
            ReviewService.update_review(self.user, review.REVW_ID, text=" ")
        self.score_review.assert_not_called()

    def test_inference_failure_aborts_creation_and_text_edit(self):
        count_before = Review.objects.count()
        self.business.refresh_from_db()
        business_count_before = self.business.BUSN_REVIEW_COUNT
        self.score_review.side_effect = RuntimeError("Model unavailable")
        with self.assertRaisesRegex(RuntimeError, "Model unavailable"):
            ReviewService.create_review(self.user, self.business.BUSN_ID, "Valid review text.")
        self.assertEqual(Review.objects.count(), count_before)
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, business_count_before)
        review = Review.objects.create(
            USER_ID=self.user, BUSN_ID=self.business, REVW_TEXT="Original text.",
            REVW_SENTIMENT_SCORE=0.2, REVW_SENTIMENT_LABEL="positive",
        )
        with self.assertRaisesRegex(RuntimeError, "Model unavailable"):
            ReviewService.update_review(self.user, review.REVW_ID, text="New text.")
        review.refresh_from_db()
        self.assertEqual(review.REVW_TEXT, "Original text.")
        self.assertEqual(review.REVW_SENTIMENT_SCORE, 0.2)
        self.assertEqual(review.REVW_SENTIMENT_LABEL, "positive")

    def test_failure_after_scored_save_rolls_back_creation_and_edit(self):
        with patch("apps.reviews.services.review_service.CloudinaryService.upload_image",
                   side_effect=RuntimeError("Upload failed")):
            with self.assertRaisesRegex(RuntimeError, "Upload failed"):
                ReviewService.create_review(
                    self.user, self.business.BUSN_ID, "Valid text.", photos=[object()],
                )
            self.assertFalse(Review.objects.filter(USER_ID=self.user).exists())
            review = Review.objects.create(
                USER_ID=self.user, BUSN_ID=self.business, REVW_TEXT="Original text.",
                REVW_SENTIMENT_SCORE=-0.4, REVW_SENTIMENT_LABEL="negative",
            )
            with self.assertRaisesRegex(RuntimeError, "Upload failed"):
                ReviewService.update_review(
                    self.user, review.REVW_ID, text="Changed text.", photos=[object()],
                )
        review.refresh_from_db()
        self.assertEqual(review.REVW_TEXT, "Original text.")
        self.assertEqual(review.REVW_SENTIMENT_SCORE, -0.4)
        self.assertEqual(review.REVW_SENTIMENT_LABEL, "negative")

    def _create_signal_review(
        self,
        score=0.75,
        device_id=None,
        business=None,
        user=None,
        status=Review.ReviewStatus.PUBLISHED,
    ):
        if user is None:
            user = User.objects.create_user(
                email=f"signal-{User.objects.count()}@example.com",
                password=None,
                USER_FNAME="Signal",
                USER_LNAME="Reviewer",
                USER_ROLE=User.UserRole.EXPLORER,
                USER_STATUS=User.UserStatus.ACTIVE,
            )
        return Review.objects.create(
            USER_ID=user,
            BUSN_ID=business or self.business,
            REVW_TEXT="A review used to check moderation signals.",
            REVW_SENTIMENT_SCORE=score,
            REVW_SENTIMENT_LABEL="positive" if score is not None else None,
            REVW_DEVICE_ID=device_id,
            REVW_STATUS=status,
        )

    def _create_signal_business(self):
        owner = User.objects.create_user(
            email=f"signal-owner-{User.objects.count()}@example.com",
            password=None,
            USER_FNAME="Signal",
            USER_LNAME="Merchant",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        location = Location.objects.create(
            LOCT_POINT=Point(123.8854, 10.3157, srid=4326),
            LOCT_ADDRESS="Signal Street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        return Business.objects.create(
            BUSN_NAME=f"Signal Business {Business.objects.count()}",
            BUSN_DESCRIPTION="A business for device isolation tests.",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=owner,
            CTGRY_ID=self.category,
            LOCT_ID=location,
        )

    def _create_bulk_history(self, count, device_id, created_at=None):
        reviews = [
            self._create_signal_review(
                business=self._create_signal_business(),
                user=self.second_user,
                device_id=device_id,
            )
            for _ in range(count)
        ]
        if created_at is not None:
            Review.objects.filter(
                pk__in=[review.pk for review in reviews],
            ).update(REVW_CREATED_AT=created_at)
        return reviews

    def test_response_serializes_all_five_moderation_fields(self):
        review = self._create_signal_review(score=-0.75)
        review.REVW_SENTIMENT_LABEL = "negative"
        for flagged in (True, False):
            with self.subTest(flagged=flagged):
                review.REVW_IS_OUTLIER_SENTIMENT = flagged
                review.REVW_IS_SPAM_FLAGGED = flagged
                review.REVW_IS_DEVICE_ABUSE_FLAGGED = flagged
                data = ReviewResponseSerializer(review).data
                self.assertEqual(data["sentiment_score"], -0.75)
                self.assertEqual(data["sentiment_label"], "negative")
                self.assertIs(data["is_outlier_sentiment"], flagged)
                self.assertIs(data["is_spam_flagged"], flagged)
                self.assertIs(data["is_device_abuse_flagged"], flagged)

    def test_response_serializes_null_sentiment_and_false_flags(self):
        review = self._create_signal_review(score=None)
        data = ReviewResponseSerializer(review).data
        self.assertIsNone(data["sentiment_score"])
        self.assertIsNone(data["sentiment_label"])
        self.assertIs(data["is_outlier_sentiment"], False)
        self.assertIs(data["is_spam_flagged"], False)
        self.assertIs(data["is_device_abuse_flagged"], False)

    def test_response_moderation_fields_are_read_only(self):
        fields = {
            "sentiment_score": -0.9,
            "sentiment_label": "negative",
            "is_outlier_sentiment": True,
            "is_spam_flagged": True,
            "is_device_abuse_flagged": True,
        }
        serializer = ReviewResponseSerializer(data=fields)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data, {})
        for name in fields:
            self.assertTrue(serializer.fields[name].read_only)

    def test_outlier_method_flags_both_directions_and_accepts_in_range(self):
        for _ in range(5):
            self._create_signal_review(score=0.0)
        review = self._create_signal_review(user=self.user)
        for score, expected in ((-0.9, True), (0.9, True), (0.3, False)):
            with self.subTest(score=score):
                review.REVW_SENTIMENT_SCORE = score
                self.assertIs(ReviewService._is_outlier_sentiment(review), expected)

    def test_outlier_method_does_not_flag_at_exact_deviation_threshold(self):
        for _ in range(5):
            self._create_signal_review(score=0.0)
        review = self._create_signal_review(score=0.8, user=self.user)
        self.assertFalse(ReviewService._is_outlier_sentiment(review))

    def test_outlier_method_cold_start_and_exactly_five_prior_reviews(self):
        review = self._create_signal_review(score=-0.9, user=self.user)
        self.assertFalse(ReviewService._is_outlier_sentiment(review))
        for _ in range(4):
            self._create_signal_review(score=0.75)
        self.assertFalse(ReviewService._is_outlier_sentiment(review))
        self._create_signal_review(score=0.75)
        self.assertTrue(ReviewService._is_outlier_sentiment(review))

    def test_outlier_method_excludes_itself_from_average(self):
        for _ in range(5):
            self._create_signal_review(score=0.0)
        review = self._create_signal_review(score=0.9, user=self.user)
        # Including the target would reduce the deviation to 0.75.
        self.assertTrue(ReviewService._is_outlier_sentiment(review))

    def test_outlier_baseline_uses_only_scored_published_reviews_of_business(self):
        for _ in range(4):
            self._create_signal_review(score=0.0)
        self._create_signal_review(score=None)
        for status in (Review.ReviewStatus.FLAGGED, Review.ReviewStatus.REJECTED):
            self._create_signal_review(score=-1.0, status=status)
        other_business = self._create_signal_business()
        self._create_signal_review(score=-1.0, business=other_business)
        review = self._create_signal_review(score=0.9, user=self.user)
        self.assertFalse(ReviewService._is_outlier_sentiment(review))
        self._create_signal_review(score=0.0)
        self.assertTrue(ReviewService._is_outlier_sentiment(review))

    def test_null_sentiment_never_triggers_outlier_query(self):
        review = self._create_signal_review(score=None)
        with self.assertNumQueries(0):
            self.assertFalse(ReviewService._is_outlier_sentiment(review))

    def test_creation_persists_outlier_without_changing_published_status(self):
        for _ in range(5):
            self._create_signal_review(score=0.75)
        self.score_review.return_value = (-0.9, "Negative", "vader")
        review = ReviewService.create_review(
            self.user, self.business.pk, "A very disappointing experience.",
        )
        self.assertTrue(review.REVW_IS_OUTLIER_SENTIMENT)
        review.refresh_from_db()
        self.assertTrue(review.REVW_IS_OUTLIER_SENTIMENT)
        self.assertEqual(review.REVW_STATUS, Review.ReviewStatus.PUBLISHED)
        self.score_review.assert_called_once_with("A very disappointing experience.")

    def test_text_edit_sets_and_clears_outlier_but_preserves_other_flags(self):
        for _ in range(5):
            self._create_signal_review(score=0.75)
        review = self._create_signal_review(user=self.user)
        Review.objects.filter(pk=review.pk).update(
            REVW_IS_SPAM_FLAGGED=True,
            REVW_IS_DEVICE_ABUSE_FLAGGED=True,
        )
        self.score_review.return_value = (-0.9, "Negative", "vader")
        ReviewService.update_review(self.user, review.pk, text="Disappointing service.")
        review.refresh_from_db()
        self.assertTrue(review.REVW_IS_OUTLIER_SENTIMENT)
        self.score_review.return_value = (0.6, "Positive", "vader")
        ReviewService.update_review(self.user, review.pk, text="Much better service.")
        review.refresh_from_db()
        self.assertFalse(review.REVW_IS_OUTLIER_SENTIMENT)
        self.assertTrue(review.REVW_IS_SPAM_FLAGGED)
        self.assertTrue(review.REVW_IS_DEVICE_ABUSE_FLAGGED)
        self.assertEqual(self.score_review.call_count, 2)

    def test_unchanged_text_preserves_sentiment_and_all_flags_without_recompute(self):
        review = self._create_signal_review(user=self.user)
        Review.objects.filter(pk=review.pk).update(
            REVW_IS_OUTLIER_SENTIMENT=True,
            REVW_IS_SPAM_FLAGGED=True,
            REVW_IS_DEVICE_ABUSE_FLAGGED=True,
        )
        with patch.object(ReviewService, "_is_outlier_sentiment") as check_outlier:
            ReviewService.update_review(self.user, review.pk, text=review.REVW_TEXT)
        self.score_review.assert_not_called()
        check_outlier.assert_not_called()
        review.refresh_from_db()
        self.assertEqual(review.REVW_SENTIMENT_SCORE, 0.75)
        self.assertTrue(review.REVW_IS_OUTLIER_SENTIMENT)
        self.assertTrue(review.REVW_IS_SPAM_FLAGGED)
        self.assertTrue(review.REVW_IS_DEVICE_ABUSE_FLAGGED)

    def test_fourth_distinct_user_on_device_flags_only_new_review(self):
        prior_reviews = [
            self._create_signal_review(device_id="shared-device")
            for _ in range(3)
        ]
        review = ReviewService.create_review(
            self.user, self.business.pk, "A new review from a shared device.",
            device_id="shared-device",
        )
        self.assertTrue(review.REVW_IS_DEVICE_ABUSE_FLAGGED)
        review.refresh_from_db()
        self.assertTrue(review.REVW_IS_DEVICE_ABUSE_FLAGGED)
        self.assertEqual(review.REVW_STATUS, Review.ReviewStatus.PUBLISHED)
        for prior in prior_reviews:
            prior.refresh_from_db()
            self.assertFalse(prior.REVW_IS_DEVICE_ABUSE_FLAGGED)

    def test_third_distinct_user_on_device_is_not_flagged(self):
        for _ in range(2):
            self._create_signal_review(device_id="shared-device")
        review = ReviewService.create_review(
            self.user, self.business.pk, "A third user sharing one device.",
            device_id="shared-device",
        )
        review.refresh_from_db()
        self.assertFalse(review.REVW_IS_DEVICE_ABUSE_FLAGGED)

    def test_sockpuppet_detection_counts_rejected_and_flagged_reviews(self):
        for status in Review.ReviewStatus.values:
            self._create_signal_review(device_id="shared-device", status=status)
        review = ReviewService.create_review(
            self.user, self.business.pk, "Another review on the same device.",
            device_id="shared-device",
        )
        review.refresh_from_db()
        self.assertTrue(review.REVW_IS_DEVICE_ABUSE_FLAGGED)

    def test_sockpuppet_detection_does_not_combine_businesses(self):
        other_business = self._create_signal_business()
        for _ in range(3):
            self._create_signal_review(device_id="shared-device", business=other_business)
        review = ReviewService.create_review(
            self.user, self.business.pk, "A review of a different business.",
            device_id="shared-device",
        )
        review.refresh_from_db()
        self.assertFalse(review.REVW_IS_DEVICE_ABUSE_FLAGGED)

    def test_missing_device_ids_never_query_or_flag_shared_blank_history(self):
        for device_id in (None, "", " \t"):
            with self.subTest(device_id=device_id):
                for _ in range(11):
                    self._create_signal_review(device_id=device_id)
                author = self._create_signal_review(
                    business=self._create_signal_business(),
                ).USER_ID
                review = ReviewService.create_review(
                    author, self.business.pk, "A review without a usable device ID.",
                    device_id=device_id,
                )
                review.refresh_from_db()
                self.assertFalse(review.REVW_IS_DEVICE_ABUSE_FLAGGED)
                with self.assertNumQueries(0):
                    self.assertFalse(ReviewService._is_device_abuse(review))

    def test_bulk_spam_flags_eleventh_review_across_businesses(self):
        self._create_bulk_history(10, "bulk-device")
        review = ReviewService.create_review(
            self.second_user, self.business.pk, "An eleventh review across businesses.",
            device_id="bulk-device",
        )
        review.refresh_from_db()
        self.assertTrue(review.REVW_IS_DEVICE_ABUSE_FLAGGED)
        self.assertEqual(review.REVW_STATUS, Review.ReviewStatus.PUBLISHED)

    def test_bulk_spam_does_not_flag_tenth_review(self):
        self._create_bulk_history(9, "bulk-device")
        review = ReviewService.create_review(
            self.second_user, self.business.pk, "A tenth review across businesses.",
            device_id="bulk-device",
        )
        review.refresh_from_db()
        self.assertFalse(review.REVW_IS_DEVICE_ABUSE_FLAGGED)

    def test_bulk_spam_includes_exact_window_start_but_excludes_older_reviews(self):
        now = timezone.now()
        history = self._create_bulk_history(
            10, "bulk-device", created_at=now - timedelta(hours=24),
        )
        with patch("apps.reviews.services.review_service.timezone.now", return_value=now):
            review = ReviewService.create_review(
                self.second_user, self.business.pk, "A review at the window boundary.",
                device_id="bulk-device",
            )
            review.refresh_from_db()
            self.assertTrue(review.REVW_IS_DEVICE_ABUSE_FLAGGED)
            Review.objects.filter(pk=history[0].pk).update(
                REVW_CREATED_AT=now - timedelta(hours=24, microseconds=1),
            )
            self.assertFalse(ReviewService._is_device_abuse(review))

    def test_bulk_spam_does_not_count_reviews_outside_window(self):
        self._create_bulk_history(
            10, "bulk-device", created_at=timezone.now() - timedelta(hours=25),
        )
        review = ReviewService.create_review(
            self.second_user, self.business.pk, "A review after old activity expired.",
            device_id="bulk-device",
        )
        review.refresh_from_db()
        self.assertFalse(review.REVW_IS_DEVICE_ABUSE_FLAGGED)

    def test_two_devices_do_not_combine_for_bulk_threshold(self):
        self._create_bulk_history(5, "device-a")
        self._create_bulk_history(5, "device-b")
        review = ReviewService.create_review(
            self.user, self.business.pk, "Another review from only one device.",
            device_id="device-a",
        )
        review.refresh_from_db()
        self.assertFalse(review.REVW_IS_DEVICE_ABUSE_FLAGGED)

    def test_two_devices_do_not_combine_for_sockpuppet_threshold(self):
        for device_id in ("device-a", "device-b"):
            for _ in range(2):
                self._create_signal_review(device_id=device_id)
        review = ReviewService.create_review(
            self.user, self.business.pk, "A third user on the first device.",
            device_id="device-a",
        )
        review.refresh_from_db()
        self.assertFalse(review.REVW_IS_DEVICE_ABUSE_FLAGGED)

    def test_failed_creation_rolls_back_both_moderation_flags(self):
        for _ in range(5):
            self._create_signal_review(score=0.75, device_id="shared-device")
        self.score_review.return_value = (-0.9, "Negative", "vader")
        with patch(
            "apps.reviews.services.review_service.CloudinaryService.upload_image",
            side_effect=RuntimeError("Upload failed"),
        ), self.assertRaisesRegex(RuntimeError, "Upload failed"):
            ReviewService.create_review(
                self.user, self.business.pk, "A flagged review that fails to save.",
                device_id="shared-device", photos=[object()],
            )
        self.assertFalse(Review.objects.filter(USER_ID=self.user).exists())
        self.assertFalse(Review.objects.filter(REVW_IS_OUTLIER_SENTIMENT=True).exists())
        self.assertFalse(Review.objects.filter(REVW_IS_DEVICE_ABUSE_FLAGGED=True).exists())

    def test_failed_text_edit_rolls_back_outlier_change(self):
        for _ in range(5):
            self._create_signal_review(score=0.75)
        review = self._create_signal_review(user=self.user)
        self.score_review.return_value = (-0.9, "Negative", "vader")
        with patch(
            "apps.reviews.services.review_service.CloudinaryService.upload_image",
            side_effect=RuntimeError("Upload failed"),
        ), self.assertRaisesRegex(RuntimeError, "Upload failed"):
            ReviewService.update_review(
                self.user, review.pk, text="A very disappointing experience.",
                photos=[object()],
            )
        review.refresh_from_db()
        self.assertFalse(review.REVW_IS_OUTLIER_SENTIMENT)
        self.assertEqual(review.REVW_SENTIMENT_SCORE, 0.75)
