from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.exceptions import NotFound, ValidationError

from apps.business.models import (
    Business,
    Category,
    Cluster,
    Location,
)
from apps.reviews.models import (
    Review,
    ReviewLike,
    ReviewPhoto,
    ReviewReport,
)
from apps.reviews.services.review_service import ReviewService
from apps.users.models import User


class ReviewServiceTests(TestCase):
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

    def test_create_review(self):
        review = ReviewService.create_review(
            user=self.user,
            business_id=self.business.BUSN_ID,
            text="Great food and service.",
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
            "Great food and service.",
        )
        self.assertIsNone(
            review.REVW_DEVICE_ID,
        )

        self.business.refresh_from_db()

        self.assertEqual(
            self.business.BUSN_REVIEW_COUNT,
            1,
        )


    @patch(
    "apps.reviews.services.review_service.CloudinaryService.upload_image",
    )  
    def test_create_review_with_photos(self, mock_upload):
        first_photo = SimpleUploadedFile(
            "review-1.jpg",
            b"fake-image-content-1",
            content_type="image/jpeg",
        )
        second_photo = SimpleUploadedFile(
            "review-2.jpg",
            b"fake-image-content-2",
            content_type="image/jpeg",
        )

        mock_upload.side_effect = [
            {
                "secure_url": "https://res.cloudinary.com/test/review-1.jpg",
                "public_id": "sugbogo/reviews/review-1",
            },
            {
                "secure_url": "https://res.cloudinary.com/test/review-2.jpg",
                "public_id": "sugbogo/reviews/review-2",
            },
        ]

        review = ReviewService.create_review(
            user=self.user,
            business_id=self.business.BUSN_ID,
            text="Great food and service.",
            photos=[
                first_photo,
                second_photo,
            ],
            device_id="test-device-001",
        )

        photos = ReviewPhoto.objects.filter(
            REVW_ID=review,
        ).order_by("RPHO_ID")

        self.assertEqual(
            photos.count(),
            2,
        )

        self.assertEqual(
            photos[0].RPHO_PHOTO_URL,
            "https://res.cloudinary.com/test/review-1.jpg",
        )
        self.assertEqual(
            photos[0].RPHO_PHOTO_PUBLIC_ID,
            "sugbogo/reviews/review-1",
        )

        self.assertEqual(
            photos[1].RPHO_PHOTO_URL,
            "https://res.cloudinary.com/test/review-2.jpg",
        )
        self.assertEqual(
            photos[1].RPHO_PHOTO_PUBLIC_ID,
            "sugbogo/reviews/review-2",
        )

        self.assertEqual(
            mock_upload.call_count,
            2,
        )

        mock_upload.assert_any_call(
            first_photo,
            folder="sugbogo/reviews",
        )
        mock_upload.assert_any_call(
            second_photo,
            folder="sugbogo/reviews",
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
        first_photo = SimpleUploadedFile(
            "review-1.jpg",
            b"fake-image-content-1",
            content_type="image/jpeg",
        )
        second_photo = SimpleUploadedFile(
            "review-2.jpg",
            b"fake-image-content-2",
            content_type="image/jpeg",
        )

        mock_upload.side_effect = [
            {
                "secure_url": "https://res.cloudinary.com/test/review-1.jpg",
                "public_id": "sugbogo/reviews/review-1",
            },
            Exception("Cloudinary upload failed."),
        ]

        with self.assertRaisesMessage(
            Exception,
            "Cloudinary upload failed.",
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
            Review.objects.filter(
                USER_ID=self.user,
                BUSN_ID=self.business,
            ).exists(),
        )

        self.assertFalse(
            ReviewPhoto.objects.filter(
                REVW_ID__USER_ID=self.user,
                REVW_ID__BUSN_ID=self.business,
            ).exists(),
        )

        self.business.refresh_from_db()

        self.assertEqual(
            self.business.BUSN_REVIEW_COUNT,
            0,
        )


    def test_create_review_increments_business_review_count(self):
        self.assertEqual(
            self.business.BUSN_REVIEW_COUNT,
            0,
        )

        ReviewService.create_review(
            user=self.second_user,
            business_id=self.business.BUSN_ID,
            text="Great experience.",
        )

        self.business.refresh_from_db()

        self.assertEqual(
            self.business.BUSN_REVIEW_COUNT,
            1,
        )

    def test_create_review_rejects_nonexistent_business(self):
        with self.assertRaisesMessage(
            NotFound,
            "The business could not be found.",
        ):
            ReviewService.create_review(
                user=self.second_user,
                business_id=999999,
                text="Great experience.",
            )

    def test_create_like(self):
        review = ReviewService.create_review(
            user=self.second_user,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        like = ReviewService.create_like(
            user=self.user,
            review_id=review.REVW_ID,
        )

        self.assertEqual(
            like.REVW_ID_id,
            review.REVW_ID,
        )
        self.assertEqual(
            like.USER_ID_id,
            self.user.pk,
        )

        review.refresh_from_db()

        self.assertEqual(
            review.REVW_LIKE_COUNT,
            1,
        )

    def test_create_like_rejects_duplicate(self):
        review = ReviewService.create_review(
            user=self.second_user,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        ReviewService.create_like(
            user=self.user,
            review_id=review.REVW_ID,
        )

        with self.assertRaisesMessage(
            ValidationError,
            "You have already liked this review.",
        ):
            ReviewService.create_like(
                user=self.user,
                review_id=review.REVW_ID,
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
            ReviewService.create_like(
                user=self.user,
                review_id=999999,
            )

    def test_remove_like(self):
        review = ReviewService.create_review(
            user=self.second_user,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        like = ReviewService.create_like(
            user=self.user,
            review_id=review.REVW_ID,
        )

        ReviewService.remove_like(
            user=self.user,
            review_id=review.REVW_ID,
        )

        self.assertFalse(
            ReviewLike.objects.filter(
                RLIK_ID=like.RLIK_ID,
            ).exists()
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
            ReviewService.remove_like(
                user=self.user,
                review_id=review.REVW_ID,
            )

    def test_has_liked_returns_true_when_like_exists(self):
        review = ReviewService.create_review(
            user=self.second_user,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        ReviewService.create_like(
            user=self.user,
            review_id=review.REVW_ID,
        )

        self.assertTrue(
            ReviewService.has_liked(
                user=self.user,
                review_id=review.REVW_ID,
            )
        )

    def test_has_liked_returns_false_when_like_does_not_exist(self):
        review = ReviewService.create_review(
            user=self.second_user,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        self.assertFalse(
            ReviewService.has_liked(
                user=self.user,
                review_id=review.REVW_ID,
            )
        )

    def test_different_users_can_like_same_review(self):
        review = ReviewService.create_review(
            user=self.second_user,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        first_like = ReviewService.create_like(
            user=self.user,
            review_id=review.REVW_ID,
        )

        second_like = ReviewService.create_like(
            user=self.second_user,
            review_id=review.REVW_ID,
        )

        self.assertNotEqual(
            first_like.RLIK_ID,
            second_like.RLIK_ID,
        )

        review.refresh_from_db()

        self.assertEqual(
            review.REVW_LIKE_COUNT,
            2,
        )

    def test_create_report(self):
        review = ReviewService.create_review(
            user=self.second_user,
            business_id=self.business.BUSN_ID,
            text="Suspicious review.",
        )

        report = ReviewService.create_report(
            user=self.user,
            review_id=review.REVW_ID,
            report_type=ReviewReport.ReportType.SPAM,
            device_id="test-device-001",
        )

        self.assertEqual(
            report.REVW_ID_id,
            review.REVW_ID,
        )
        self.assertEqual(
            report.USER_ID_id,
            self.user.pk,
        )
        self.assertEqual(
            report.RREP_TYPE,
            ReviewReport.ReportType.SPAM,
        )
        self.assertEqual(
            report.RREP_DEVICE_ID,
            "test-device-001",
        )
        self.assertEqual(
            report.RREP_STATUS,
            ReviewReport.ReportStatus.PENDING,
        )

        review.refresh_from_db()

        self.assertEqual(
            review.REVW_REPORT_COUNT,
            1,
        )

    def test_create_report_rejects_nonexistent_review(self):
        with self.assertRaisesMessage(
            NotFound,
            "The review could not be found.",
        ):
            ReviewService.create_report(
                user=self.user,
                review_id=999999,
                report_type=ReviewReport.ReportType.SPAM,
                device_id="test-device-001",
            )

    def test_different_users_can_report_same_review(self):
        review = ReviewService.create_review(
            user=self.second_user,
            business_id=self.business.BUSN_ID,
            text="Suspicious review.",
        )

        first_report = ReviewService.create_report(
            user=self.user,
            review_id=review.REVW_ID,
            report_type=ReviewReport.ReportType.SPAM,
            device_id="test-device-001",
        )

        second_report = ReviewService.create_report(
            user=self.second_user,
            review_id=review.REVW_ID,
            report_type=ReviewReport.ReportType.ABUSE,
            device_id="test-device-002",
        )

        self.assertNotEqual(
            first_report.RREP_ID,
            second_report.RREP_ID,
        )

        review.refresh_from_db()

        self.assertEqual(
            review.REVW_REPORT_COUNT,
            2,
        )

    def test_create_review_rejects_duplicate_review_for_same_business(self):
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
