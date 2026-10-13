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
from apps.reviews.models import BusinessReviewSummary, Review, ReviewReport
from apps.reviews.services.business_review_summary_service import (
    BusinessReviewSummaryService,
)
from apps.reviews.services.review_report_service import (
    AlreadyReported,
    ReviewReportService,
)
from apps.reviews.services.review_service import ReviewService
from apps.reviews.services.tests.review_moderation_test_mixin import (
    SafeReviewModerationMixin,
)
from apps.users.models import User


class ReviewReportServiceTests(SafeReviewModerationMixin, TestCase):
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
            installation_id="test-device-001",
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
            report.RREP_INSTALLATION_ID,
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

    def test_create_report_without_installation_id(self):
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
            report.RREP_INSTALLATION_ID,
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
                installation_id="test-device-001",
            )

    def test_author_cannot_report_own_review(self):
        """Self-reporting is rejected before a report or count is written."""
        review = ReviewService.create_review(
            self.second_user,
            self.business.pk,
            "A review by the would-be reporter.",
        )
        with self.assertRaisesMessage(
            ValidationError,
            "You cannot report your own review.",
        ):
            ReviewReportService.create_report(
                self.second_user,
                review.pk,
                ReviewReport.ReportType.SPAM,
            )
        self.assertFalse(ReviewReport.objects.exists())
        review.refresh_from_db()
        self.assertEqual(review.REVW_REPORT_COUNT, 0)

    def test_only_published_reviews_can_be_reported(self):
        """Community reports concern content that is already public."""
        for status in (
            Review.ReviewStatus.UNDER_REVIEW,
            Review.ReviewStatus.REJECTED,
        ):
            with self.subTest(status=status):
                review = Review.objects.create(
                    USER_ID=self.second_user,
                    BUSN_ID=self.business,
                    REVW_TEXT="Not currently public.",
                    REVW_STATUS=status,
                )
                with self.assertRaisesMessage(
                    ValidationError,
                    "Only published reviews can be reported.",
                ):
                    ReviewReportService.create_report(
                        self.user,
                        review.pk,
                        ReviewReport.ReportType.OTHER,
                    )
                review.delete()

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
            installation_id="test-device-001",
        )

        with self.assertRaisesMessage(
            AlreadyReported,
            "You have already reported this review.",
        ):
            ReviewReportService.create_report(
                user=self.user,
                review_id=review.REVW_ID,
                report_type=ReviewReport.ReportType.ABUSE,
                installation_id="test-device-002",
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
            installation_id="test-device-001",
        )

        other_reporter = User.objects.create_user(
            email="another-reporter@example.com",
            password=None,
            USER_FNAME="Another",
            USER_LNAME="Reporter",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        second_report = ReviewReportService.create_report(
            user=other_reporter,
            review_id=review.REVW_ID,
            report_type=ReviewReport.ReportType.MISINFORMATION,
            installation_id="test-device-002",
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

        self.assertFalse(review.REVW_IS_REPORT_FLAGGED)

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
        fourth_reporter = User.objects.create_user(
            email="fourth-reporter@example.com",
            password=None,
            USER_FNAME="Fourth",
            USER_LNAME="Reporter",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        for index, reporter in enumerate(
            (self.user, third_reporter, fourth_reporter),
            start=1,
        ):
            ReviewReportService.create_report(
                reporter,
                review.pk,
                ReviewReport.ReportType.OTHER,
            )
            review.refresh_from_db()
            self.assertEqual(review.REVW_REPORT_COUNT, index)
            self.assertIs(review.REVW_IS_REPORT_FLAGGED, index == 3)
            self.assertEqual(review.REVW_STATUS, review.ReviewStatus.PUBLISHED)
        self.assertEqual(review.reports.count(), 3)
        self.assertTrue(
            BusinessReviewSummaryService.eligible_reviews(
                self.business.pk,
            ).filter(pk=review.pk).exists()
        )
        self.assertEqual(
            [item.pk for item in ReviewService.list_reviews(
                self.business.pk,
                self.user,
            )],
            [review.pk],
        )

    def test_threshold_does_not_invalidate_published_insights(self):
        review = Review.objects.create(
            USER_ID=self.second_user, BUSN_ID=self.business,
            REVW_TEXT="Friendly staff", REVW_REPORT_COUNT=2,
            REVW_SENTIMENT_SCORE=0.75, REVW_SENTIMENT_LABEL="positive",
        )
        summary = BusinessReviewSummary.objects.create(
            BUSN_ID=self.business, BRSU_POSITIVE_COUNT=1,
            BRSU_REVIEW_COUNT=1, BRSU_CLASSIFIED_REVIEW_COUNT=1,
            BRSU_NARRATIVE="Visitors mention friendly staff.",
            BRSU_SUPPORTING_REVIEW_REFERENCES={"narrative_review_ids": [review.pk]},
            BRSU_GENERATION_STATE=BusinessReviewSummary.GenerationState.READY,
        )
        for index in range(2):
            reporter = User.objects.create_user(
                email=f"prior-report-{index}@example.com",
                password=None,
                USER_FNAME="Prior",
                USER_LNAME="Reporter",
                USER_ROLE=User.UserRole.EXPLORER,
                USER_STATUS=User.UserStatus.ACTIVE,
            )
            ReviewReport.objects.create(
                REVW_ID=review,
                USER_ID=reporter,
                RREP_TYPE=ReviewReport.ReportType.OTHER,
            )
        with patch("apps.reviews.tasks.refresh_business_review_insights.delay") as enqueue:
            with self.captureOnCommitCallbacks(execute=True):
                ReviewReportService.create_report(self.user, review.pk, "spam")
                enqueue.assert_not_called()
            enqueue.assert_not_called()
        review.refresh_from_db()
        summary.refresh_from_db()
        self.assertTrue(review.REVW_IS_REPORT_FLAGGED)
        self.assertEqual(summary.BRSU_POSITIVE_COUNT, 1)
        self.assertEqual(summary.BRSU_CLASSIFIED_REVIEW_COUNT, 1)
        self.assertEqual(summary.BRSU_NARRATIVE, "Visitors mention friendly staff.")
        self.assertEqual(summary.BRSU_GENERATION_STATE, "ready")

    def test_stale_report_flag_is_cleared_below_pending_threshold(self):
        review = ReviewService.create_review(
            self.second_user, self.business.pk, "A previously flagged review.",
        )
        review.REVW_IS_REPORT_FLAGGED = True
        review.save(update_fields=["REVW_IS_REPORT_FLAGGED"])
        ReviewReportService.create_report(
            self.user, review.pk, ReviewReport.ReportType.ABUSE,
        )
        review.refresh_from_db()
        self.assertEqual(review.REVW_REPORT_COUNT, 1)
        self.assertFalse(review.REVW_IS_REPORT_FLAGGED)
        self.assertEqual(review.REVW_STATUS, review.ReviewStatus.PUBLISHED)

    def test_historical_total_count_does_not_trigger_attention(self):
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
        self.assertFalse(review.REVW_IS_REPORT_FLAGGED)

    def test_rejected_and_withdrawn_reports_do_not_count_as_active(self):
        """Only pending rows contribute to the Admin attention threshold."""
        review = ReviewService.create_review(
            self.second_user,
            self.business.pk,
            "A review with resolved report history.",
        )
        for index, status in enumerate(
            (
                ReviewReport.ReportStatus.REJECTED,
                ReviewReport.ReportStatus.WITHDRAWN,
            )
        ):
            reporter = User.objects.create_user(
                email=f"resolved-reporter-{index}@example.com",
                password=None,
                USER_FNAME="Resolved",
                USER_LNAME="Reporter",
                USER_ROLE=User.UserRole.EXPLORER,
                USER_STATUS=User.UserStatus.ACTIVE,
            )
            ReviewReport.objects.create(
                REVW_ID=review,
                USER_ID=reporter,
                RREP_TYPE=ReviewReport.ReportType.OTHER,
                RREP_STATUS=status,
            )

        Review.objects.filter(pk=review.pk).update(REVW_REPORT_COUNT=2)
        ReviewReportService.create_report(
            self.user,
            review.pk,
            ReviewReport.ReportType.ABUSE,
        )
        review.refresh_from_db()
        self.assertFalse(review.REVW_IS_REPORT_FLAGGED)
