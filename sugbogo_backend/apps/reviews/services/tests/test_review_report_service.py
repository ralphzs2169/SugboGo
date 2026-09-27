from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.test import TestCase
from rest_framework.exceptions import NotFound, ValidationError

from apps.business.models import (
    Business,
    Category,
    Cluster,
    Location,
)
from apps.reviews.models import ReviewReport
from apps.reviews.services.review_report_service import ReviewReportService
from apps.reviews.services.review_service import ReviewService
from apps.users.models import User


class ReviewReportServiceTests(TestCase):
    """Tests for reporting business reviews."""

    def setUp(self):
        patcher = patch(
            "apps.reviews.services.review_sentiment_service.route_sentiment",
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

    def test_create_report(self):
        review = ReviewService.create_review(
            user=self.second_user,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        report = ReviewReportService.create_report(
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
            self.user.USER_ID,
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

    def test_create_report_without_device_id(self):
        review = ReviewService.create_review(
            user=self.second_user,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        report = ReviewReportService.create_report(
            user=self.user,
            review_id=review.REVW_ID,
            report_type=ReviewReport.ReportType.SPAM,
        )

        self.assertIsNone(
            report.RREP_DEVICE_ID,
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
            ReviewReportService.create_report(
                user=self.user,
                review_id=999999,
                report_type=ReviewReport.ReportType.SPAM,
                device_id="test-device-001",
            )

    def test_create_report_rejects_duplicate_report(self):
        review = ReviewService.create_review(
            user=self.second_user,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        ReviewReportService.create_report(
            user=self.user,
            review_id=review.REVW_ID,
            report_type=ReviewReport.ReportType.SPAM,
            device_id="test-device-001",
        )

        with self.assertRaisesMessage(
            ValidationError,
            "You have already reported this review.",
        ):
            ReviewReportService.create_report(
                user=self.user,
                review_id=review.REVW_ID,
                report_type=ReviewReport.ReportType.ABUSE,
                device_id="test-device-002",
            )

        self.assertEqual(
            ReviewReport.objects.filter(
                REVW_ID=review,
                USER_ID=self.user,
            ).count(),
            1,
        )

        review.refresh_from_db()

        self.assertEqual(
            review.REVW_REPORT_COUNT,
            1,
        )

    def test_different_users_can_report_same_review(self):
        review = ReviewService.create_review(
            user=self.second_user,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        first_report = ReviewReportService.create_report(
            user=self.user,
            review_id=review.REVW_ID,
            report_type=ReviewReport.ReportType.SPAM,
            device_id="test-device-001",
        )

        second_report = ReviewReportService.create_report(
            user=self.second_user,
            review_id=review.REVW_ID,
            report_type=ReviewReport.ReportType.MISINFORMATION,
            device_id="test-device-002",
        )

        self.assertNotEqual(
            first_report.RREP_ID,
            second_report.RREP_ID,
        )

        self.assertEqual(
            ReviewReport.objects.filter(
                REVW_ID=review,
            ).count(),
            2,
        )

        review.refresh_from_db()

        self.assertEqual(
            review.REVW_REPORT_COUNT,
            2,
        )

        self.assertFalse(review.REVW_IS_SPAM_FLAGGED)

    def test_third_report_flags_review_without_rejecting_it(self):
        review = ReviewService.create_review(
            self.second_user, self.business.pk, "A review receiving several reports.",
        )
        third_reporter = User.objects.create_user(
            email="third-reporter@example.com",
            password=None,
            USER_FNAME="Third",
            USER_LNAME="Reporter",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        for index, reporter in enumerate(
            (self.user, self.second_user, third_reporter), start=1,
        ):
            ReviewReportService.create_report(
                reporter, review.pk, ReviewReport.ReportType.SPAM,
            )
            review.refresh_from_db()
            self.assertEqual(review.REVW_REPORT_COUNT, index)
            self.assertIs(review.REVW_IS_SPAM_FLAGGED, index == 3)
            self.assertEqual(review.REVW_STATUS, review.ReviewStatus.PUBLISHED)
        self.assertEqual(review.reports.count(), 3)

    def test_existing_spam_flag_is_preserved_below_threshold(self):
        review = ReviewService.create_review(
            self.second_user, self.business.pk, "A previously flagged review.",
        )
        review.REVW_IS_SPAM_FLAGGED = True
        review.save(update_fields=["REVW_IS_SPAM_FLAGGED"])
        ReviewReportService.create_report(
            self.user, review.pk, ReviewReport.ReportType.ABUSE,
        )
        review.refresh_from_db()
        self.assertEqual(review.REVW_REPORT_COUNT, 1)
        self.assertTrue(review.REVW_IS_SPAM_FLAGGED)
        self.assertEqual(review.REVW_STATUS, review.ReviewStatus.PUBLISHED)

    def test_spam_flag_is_set_when_existing_count_is_already_above_threshold(self):
        review = ReviewService.create_review(
            self.second_user, self.business.pk, "A review with historical reports.",
        )
        review.REVW_REPORT_COUNT = 3
        review.save(update_fields=["REVW_REPORT_COUNT"])
        ReviewReportService.create_report(
            self.user, review.pk, ReviewReport.ReportType.OTHER,
        )
        review.refresh_from_db()
        self.assertEqual(review.REVW_REPORT_COUNT, 4)
        self.assertTrue(review.REVW_IS_SPAM_FLAGGED)
        ReviewReportService.create_report(
            self.second_user, review.pk, ReviewReport.ReportType.MISINFORMATION,
        )
        review.refresh_from_db()
        self.assertEqual(review.REVW_REPORT_COUNT, 5)
        self.assertTrue(review.REVW_IS_SPAM_FLAGGED)
