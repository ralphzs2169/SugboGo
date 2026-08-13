from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from apps.admin_operations.analytics.services.merchant_application_analytics_service import (
    MerchantApplicationAnalyticsService,
)
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationReview,
    MerchantApplicationSubmission,
)
from apps.users.models import User
from apps.merchant_application.constants import APPLICATION_REVIEW_SLA_BUSINESS_DAYS

class MerchantApplicationAnalyticsServiceTests(TestCase):
    def test_sla_compliance_rate_returns_none_when_no_reviews_exist(self):
        result = (
            MerchantApplicationAnalyticsService
            .get_sla_compliance_rate()
        )

        self.assertIsNone(result)

    def test_sla_compliance_rate_returns_100_for_review_within_sla(self):
        merchant = User.objects.create_user(
            email="merchant-analytics@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Analytics",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        application = MerchantApplication.objects.create(
            USER_ID=merchant,
            MAPP_STATUS=MerchantApplication.ApplicationStatus.SUBMITTED,
            MAPP_SUBMISSION_COUNT=1,
        )

        submitted_at = timezone.now() - timedelta(
            days=APPLICATION_REVIEW_SLA_BUSINESS_DAYS - 1,
        )

        submission = MerchantApplicationSubmission.objects.create(
            MAPP_ID=application,
            MASUB_SUBMISSION_NUMBER=1,
            MASUB_SUBMITTED_AT=submitted_at,
        )

        MerchantApplicationReview.objects.create(
            MAPP_ID=application,
            MASUB_ID=submission,
            USER_ID=merchant,
            MAREV_DECISION=MerchantApplicationReview.Decision.APPROVED,
            MAREV_REVIEWED_AT=timezone.now(),
        )

        result = (
            MerchantApplicationAnalyticsService
            .get_sla_compliance_rate()
        )

        self.assertEqual(result, 100.0)


    def test_sla_compliance_rate_returns_0_for_review_outside_sla(self):
        merchant = User.objects.create_user(
            email="merchant-analytics@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Analytics",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        application = MerchantApplication.objects.create(
            USER_ID=merchant,
            MAPP_STATUS=MerchantApplication.ApplicationStatus.SUBMITTED,
            MAPP_SUBMISSION_COUNT=1,
        )

        submitted_at = timezone.now() - timedelta(
            days=(APPLICATION_REVIEW_SLA_BUSINESS_DAYS * 2) + 2,
        )

        submission = MerchantApplicationSubmission.objects.create(
            MAPP_ID=application,
            MASUB_SUBMISSION_NUMBER=1,
            MASUB_SUBMITTED_AT=submitted_at,
        )

        MerchantApplicationReview.objects.create(
            MAPP_ID=application,
            MASUB_ID=submission,
            USER_ID=merchant,
            MAREV_DECISION=MerchantApplicationReview.Decision.REJECTED,
            MAREV_REVIEWED_AT=timezone.now(),
        )

        result = (
            MerchantApplicationAnalyticsService
            .get_sla_compliance_rate()
        )

        self.assertEqual(result, 0.0)

    def test_sla_compliance_rate_calculates_across_multiple_review_events(self):
        merchant = User.objects.create_user(
            email="merchant-analytics@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Analytics",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        application = MerchantApplication.objects.create(
            USER_ID=merchant,
            MAPP_STATUS=MerchantApplication.ApplicationStatus.SUBMITTED,
            MAPP_SUBMISSION_COUNT=2,
        )

        first_submitted_at = timezone.now() - timedelta(
            days=APPLICATION_REVIEW_SLA_BUSINESS_DAYS - 1,
        )

        first_submission = MerchantApplicationSubmission.objects.create(
            MAPP_ID=application,
            MASUB_SUBMISSION_NUMBER=1,
            MASUB_SUBMITTED_AT=first_submitted_at,
        )

        MerchantApplicationReview.objects.create(
            MAPP_ID=application,
            MASUB_ID=first_submission,
            USER_ID=merchant,
            MAREV_DECISION=MerchantApplicationReview.Decision.REJECTED,
            MAREV_REVIEWED_AT=timezone.now(),
        )

        second_submitted_at = timezone.now() - timedelta(
            days=(APPLICATION_REVIEW_SLA_BUSINESS_DAYS * 2) + 2,
        )

        second_submission = MerchantApplicationSubmission.objects.create(
            MAPP_ID=application,
            MASUB_SUBMISSION_NUMBER=2,
            MASUB_SUBMITTED_AT=second_submitted_at,
        )

        MerchantApplicationReview.objects.create(
            MAPP_ID=application,
            MASUB_ID=second_submission,
            USER_ID=merchant,
            MAREV_DECISION=MerchantApplicationReview.Decision.APPROVED,
            MAREV_REVIEWED_AT=timezone.now(),
        )

        result = (
            MerchantApplicationAnalyticsService
            .get_sla_compliance_rate()
        )

        self.assertEqual(result, 50.0)

    def test_sla_compliance_rate_counts_each_review_event_for_resubmissions(self):
        merchant = User.objects.create_user(
            email="merchant-resubmission@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Resubmission",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        application = MerchantApplication.objects.create(
            USER_ID=merchant,
            MAPP_STATUS=MerchantApplication.ApplicationStatus.APPROVED,
            MAPP_SUBMISSION_COUNT=3,
        )

        now = timezone.now()

        # Submission #1 — within SLA
        submission_one = MerchantApplicationSubmission.objects.create(
            MAPP_ID=application,
            MASUB_SUBMISSION_NUMBER=1,
            MASUB_SUBMITTED_AT=now - timedelta(
                days=APPLICATION_REVIEW_SLA_BUSINESS_DAYS - 1,
            ),
        )

        MerchantApplicationReview.objects.create(
            MAPP_ID=application,
            MASUB_ID=submission_one,
            USER_ID=merchant,
            MAREV_DECISION=MerchantApplicationReview.Decision.REJECTED,
            MAREV_REVIEWED_AT=now,
        )

        # Submission #2 — outside SLA
        submission_two = MerchantApplicationSubmission.objects.create(
            MAPP_ID=application,
            MASUB_SUBMISSION_NUMBER=2,
            MASUB_SUBMITTED_AT=now - timedelta(
                days=(APPLICATION_REVIEW_SLA_BUSINESS_DAYS * 2) + 2,
            ),
        )

        MerchantApplicationReview.objects.create(
            MAPP_ID=application,
            MASUB_ID=submission_two,
            USER_ID=merchant,
            MAREV_DECISION=MerchantApplicationReview.Decision.REJECTED,
            MAREV_REVIEWED_AT=now,
        )

        # Submission #3 — within SLA
        submission_three = MerchantApplicationSubmission.objects.create(
            MAPP_ID=application,
            MASUB_SUBMISSION_NUMBER=3,
            MASUB_SUBMITTED_AT=now - timedelta(
                days=APPLICATION_REVIEW_SLA_BUSINESS_DAYS - 1,
            ),
        )

        MerchantApplicationReview.objects.create(
            MAPP_ID=application,
            MASUB_ID=submission_three,
            USER_ID=merchant,
            MAREV_DECISION=MerchantApplicationReview.Decision.APPROVED,
            MAREV_REVIEWED_AT=now,
        )

        result = (
            MerchantApplicationAnalyticsService
            .get_sla_compliance_rate()
        )

        self.assertEqual(result, 66.7)

    def test_approval_rate_returns_none_when_no_applications_are_decided(self):
        result = (
            MerchantApplicationAnalyticsService
            .get_approval_rate()
        )

        self.assertIsNone(result)


    def test_approval_rate_returns_100_when_all_decided_applications_are_approved(self):
        merchant = User.objects.create_user(
            email="merchant-approval@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Approval",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        MerchantApplication.objects.create(
            USER_ID=merchant,
            MAPP_STATUS=MerchantApplication.ApplicationStatus.APPROVED,
        )

        result = MerchantApplicationAnalyticsService.get_approval_rate()

        self.assertEqual(result, 100.0)

    
    def test_approval_rate_returns_0_when_all_decided_applications_are_rejected(self):
        merchant = User.objects.create_user(
            email="merchant-rejection@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Rejection",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        MerchantApplication.objects.create(
            USER_ID=merchant,
            MAPP_STATUS=MerchantApplication.ApplicationStatus.REJECTED,
        )

        result = MerchantApplicationAnalyticsService.get_approval_rate()

        self.assertEqual(result, 0.0)


    def test_approval_rate_calculates_percentage_of_decided_applications(self):
        merchants = [
            User.objects.create_user(
                email=f"merchant-mixed-{index}@example.com",
                password="StrongPassword123!",
                USER_FNAME="Merchant",
                USER_LNAME=f"Mixed {index}",
                USER_ROLE=User.UserRole.MERCHANT,
                USER_STATUS=User.UserStatus.ACTIVE,
            )
            for index in range(1, 5)
        ]

        MerchantApplication.objects.create(
            USER_ID=merchants[0],
            MAPP_STATUS=MerchantApplication.ApplicationStatus.APPROVED,
        )

        MerchantApplication.objects.create(
            USER_ID=merchants[1],
            MAPP_STATUS=MerchantApplication.ApplicationStatus.APPROVED,
        )

        MerchantApplication.objects.create(
            USER_ID=merchants[2],
            MAPP_STATUS=MerchantApplication.ApplicationStatus.REJECTED,
        )

        MerchantApplication.objects.create(
            USER_ID=merchants[3],
            MAPP_STATUS=MerchantApplication.ApplicationStatus.REJECTED,
        )

        result = MerchantApplicationAnalyticsService.get_approval_rate()

        self.assertEqual(result, 50.0)


    def test_approval_rate_excludes_draft_and_submitted_applications(self):
        merchants = [
            User.objects.create_user(
                email=f"merchant-pending-{index}@example.com",
                password="StrongPassword123!",
                USER_FNAME="Merchant",
                USER_LNAME=f"Pending {index}",
                USER_ROLE=User.UserRole.MERCHANT,
                USER_STATUS=User.UserStatus.ACTIVE,
            )
            for index in range(1, 5)
        ]

        MerchantApplication.objects.create(
            USER_ID=merchants[0],
            MAPP_STATUS=MerchantApplication.ApplicationStatus.APPROVED,
        )

        MerchantApplication.objects.create(
            USER_ID=merchants[1],
            MAPP_STATUS=MerchantApplication.ApplicationStatus.REJECTED,
        )

        MerchantApplication.objects.create(
            USER_ID=merchants[2],
            MAPP_STATUS=MerchantApplication.ApplicationStatus.DRAFT,
        )

        MerchantApplication.objects.create(
            USER_ID=merchants[3],
            MAPP_STATUS=MerchantApplication.ApplicationStatus.SUBMITTED,
        )

        result = MerchantApplicationAnalyticsService.get_approval_rate()

        self.assertEqual(result, 50.0)


    def test_approval_rate_counts_resubmitted_application_only_once(self):
        merchant = User.objects.create_user(
            email="merchant-resubmitted@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Resubmitted",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        approved_application = MerchantApplication.objects.create(
            USER_ID=merchant,
            MAPP_STATUS=MerchantApplication.ApplicationStatus.APPROVED,
            MAPP_SUBMISSION_COUNT=3,
        )

        MerchantApplicationSubmission.objects.create(
            MAPP_ID=approved_application,
            MASUB_SUBMISSION_NUMBER=1,
            MASUB_SUBMITTED_AT=timezone.now(),
        )

        MerchantApplicationSubmission.objects.create(
            MAPP_ID=approved_application,
            MASUB_SUBMISSION_NUMBER=2,
            MASUB_SUBMITTED_AT=timezone.now(),
        )

        MerchantApplicationSubmission.objects.create(
            MAPP_ID=approved_application,
            MASUB_SUBMISSION_NUMBER=3,
            MASUB_SUBMITTED_AT=timezone.now(),
        )

        rejected_application = MerchantApplication.objects.create(
            USER_ID=User.objects.create_user(
                email="merchant-other@example.com",
                password="StrongPassword123!",
                USER_FNAME="Merchant",
                USER_LNAME="Other",
                USER_ROLE=User.UserRole.MERCHANT,
                USER_STATUS=User.UserStatus.ACTIVE,
            ),
            MAPP_STATUS=MerchantApplication.ApplicationStatus.REJECTED,
            MAPP_SUBMISSION_COUNT=1,
        )

        result = MerchantApplicationAnalyticsService.get_approval_rate()

        self.assertEqual(result, 50.0)


    def test_resubmission_rate_returns_none_when_no_applications_are_reviewed(self):
        result = (
            MerchantApplicationAnalyticsService
            .get_resubmission_rate()
        )

        self.assertIsNone(result)

    def test_resubmission_rate_returns_0_when_no_reviewed_application_was_resubmitted(
        self,
    ):
        merchant = User.objects.create_user(
            email="merchant-no-resubmission@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="No Resubmission",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        application = MerchantApplication.objects.create(
            USER_ID=merchant,
            MAPP_STATUS=MerchantApplication.ApplicationStatus.APPROVED,
            MAPP_SUBMISSION_COUNT=1,
        )

        MerchantApplicationReview.objects.create(
            MAPP_ID=application,
            USER_ID=merchant,
            MAREV_DECISION=MerchantApplicationReview.Decision.APPROVED,
            MAREV_REVIEWED_AT=timezone.now(),
        )

        result = MerchantApplicationAnalyticsService.get_resubmission_rate()

        self.assertEqual(result, 0.0)


    def test_resubmission_rate_calculates_percentage_of_reviewed_applications(
        self,
    ):
        merchants = [
            User.objects.create_user(
                email=f"merchant-resubmission-mixed-{index}@example.com",
                password="StrongPassword123!",
                USER_FNAME="Merchant",
                USER_LNAME=f"Mixed {index}",
                USER_ROLE=User.UserRole.MERCHANT,
                USER_STATUS=User.UserStatus.ACTIVE,
            )
            for index in range(1, 5)
        ]

        for index, merchant in enumerate(merchants):
            application = MerchantApplication.objects.create(
                USER_ID=merchant,
                MAPP_STATUS=(
                    MerchantApplication.ApplicationStatus.APPROVED
                    if index < 2
                    else MerchantApplication.ApplicationStatus.REJECTED
                ),
                MAPP_SUBMISSION_COUNT=(
                    2 if index < 2 else 1
                ),
            )

            MerchantApplicationReview.objects.create(
                MAPP_ID=application,
                USER_ID=merchant,
                MAREV_DECISION=(
                    MerchantApplicationReview.Decision.APPROVED
                    if index < 2
                    else MerchantApplicationReview.Decision.REJECTED
                ),
                MAREV_REVIEWED_AT=timezone.now(),
            )

        result = MerchantApplicationAnalyticsService.get_resubmission_rate()

        self.assertEqual(result, 50.0)


    def test_resubmission_rate_excludes_unreviewed_applications(self):
        reviewed_merchant = User.objects.create_user(
            email="merchant-reviewed@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Reviewed",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        resubmitted_application = MerchantApplication.objects.create(
            USER_ID=reviewed_merchant,
            MAPP_STATUS=MerchantApplication.ApplicationStatus.APPROVED,
            MAPP_SUBMISSION_COUNT=2,
        )

        MerchantApplicationReview.objects.create(
            MAPP_ID=resubmitted_application,
            USER_ID=reviewed_merchant,
            MAREV_DECISION=MerchantApplicationReview.Decision.APPROVED,
            MAREV_REVIEWED_AT=timezone.now(),
        )

        unreviewed_merchant = User.objects.create_user(
            email="merchant-unreviewed@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Unreviewed",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        MerchantApplication.objects.create(
            USER_ID=unreviewed_merchant,
            MAPP_STATUS=MerchantApplication.ApplicationStatus.SUBMITTED,
            MAPP_SUBMISSION_COUNT=1,
        )

        draft_merchant = User.objects.create_user(
            email="merchant-draft@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Draft",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        MerchantApplication.objects.create(
            USER_ID=draft_merchant,
            MAPP_STATUS=MerchantApplication.ApplicationStatus.DRAFT,
            MAPP_SUBMISSION_COUNT=0,
        )

        result = MerchantApplicationAnalyticsService.get_resubmission_rate()

        self.assertEqual(result, 100.0)


    def test_resubmission_rate_counts_application_only_once_regardless_of_resubmissions(
        self,
    ):
        merchant = User.objects.create_user(
            email="merchant-multiple-resubmissions@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Multiple Resubmissions",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        application = MerchantApplication.objects.create(
            USER_ID=merchant,
            MAPP_STATUS=MerchantApplication.ApplicationStatus.APPROVED,
            MAPP_SUBMISSION_COUNT=3,
        )

        for submission_number in range(1, 4):
            submission = MerchantApplicationSubmission.objects.create(
                MAPP_ID=application,
                MASUB_SUBMISSION_NUMBER=submission_number,
                MASUB_SUBMITTED_AT=timezone.now(),
            )

            MerchantApplicationReview.objects.create(
                MAPP_ID=application,
                MASUB_ID=submission,
                USER_ID=merchant,
                MAREV_DECISION=(
                    MerchantApplicationReview.Decision.APPROVED
                    if submission_number == 3
                    else MerchantApplicationReview.Decision.REJECTED
                ),
                MAREV_REVIEWED_AT=timezone.now(),
            )

        result = MerchantApplicationAnalyticsService.get_resubmission_rate()

        self.assertEqual(result, 100.0)


    def test_weekly_analytics_periods_start_on_monday(self):
        periods = MerchantApplicationAnalyticsService.get_weekly_analytics_periods()

        self.assertEqual(
            periods["current_start"].weekday(),
            0,
        )

        self.assertEqual(
            periods["previous_start"].weekday(),
            0,
        )

    def test_weekly_analytics_periods_use_equivalent_elapsed_days(self):
        periods = MerchantApplicationAnalyticsService.get_weekly_analytics_periods()

        current_days = (
            periods["current_end"] - periods["current_start"]
        ).days

        previous_days = (
            periods["previous_end"] - periods["previous_start"]
        ).days

        self.assertEqual(
            current_days,
            previous_days,
        )

    def test_calculate_trend_returns_none_when_current_sample_is_too_small(self):
        result = MerchantApplicationAnalyticsService.calculate_trend(
            current_value=80.0,
            previous_value=70.0,
            current_sample_size=9,
            previous_sample_size=20,
            unit="percentage_points",
        )

        self.assertIsNone(result)

    def test_calculate_trend_returns_percentage_point_increase(self):
        result = MerchantApplicationAnalyticsService.calculate_trend(
            current_value=80.0,
            previous_value=70.0,
            current_sample_size=20,
            previous_sample_size=20,
            unit="percentage_points",
        )

        self.assertEqual(
            result,
            {
                "value": 10.0,
                "direction": "up",
                "unit": "percentage_points",
            },
        )

    def test_calculate_trend_returns_count_decrease(self):
        result = MerchantApplicationAnalyticsService.calculate_trend(
            current_value=10,
            previous_value=15,
            current_sample_size=20,
            previous_sample_size=20,
            unit="count",
        )

        self.assertEqual(
            result,
            {
                "value": 5,
                "direction": "down",
                "unit": "count",
            },
        )


    def test_calculate_trend_returns_unchanged_when_values_are_equal(self):
        result = MerchantApplicationAnalyticsService.calculate_trend(
            current_value=50.0,
            previous_value=50.0,
            current_sample_size=20,
            previous_sample_size=20,
            unit="percentage_points",
        )

        self.assertEqual(
            result,
            {
                "value": 0.0,
                "direction": "unchanged",
                "unit": "percentage_points",
            },
        )


    