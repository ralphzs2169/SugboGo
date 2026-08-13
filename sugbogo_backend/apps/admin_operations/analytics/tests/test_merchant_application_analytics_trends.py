from datetime import datetime, timedelta

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


class MerchantApplicationAnalyticsTrendTests(TestCase):
    """Test weekly trend calculations for merchant application analytics."""

    def _timestamp(self, date):
        return timezone.make_aware(
            datetime.combine(
                date,
                datetime.min.time(),
            )
        )

    def _create_merchants(self, count, prefix):
        """Create merchants efficiently without password hashing per user."""

        users = [
            User(
                USER_EMAIL=f"{prefix}-{index}@example.com",
                USER_FNAME="Merchant",
                USER_LNAME=f"Trend {index}",
                USER_ROLE=User.UserRole.MERCHANT,
                USER_STATUS=User.UserStatus.ACTIVE,
            )
            for index in range(count)
        ]

        return User.objects.bulk_create(users)

    def _create_reviewed_applications(
        self,
        count,
        prefix,
        review_date,
        approved_count,
        create_submissions=False,
    ):
        """Create reviewed applications efficiently for trend tests."""

        users = self._create_merchants(
            count=count,
            prefix=prefix,
        )

        applications = [
            MerchantApplication(
                USER_ID=user,
                MAPP_STATUS=(
                    MerchantApplication.ApplicationStatus.APPROVED
                    if index < approved_count
                    else MerchantApplication.ApplicationStatus.REJECTED
                ),
                MAPP_SUBMISSION_COUNT=(
                    1 if create_submissions else 0
                ),
            )
            for index, user in enumerate(users)
        ]

        applications = MerchantApplication.objects.bulk_create(
            applications,
        )

        reviewed_at = self._timestamp(review_date)

        submissions = []

        if create_submissions:
            submissions = MerchantApplicationSubmission.objects.bulk_create(
                [
                    MerchantApplicationSubmission(
                        MAPP_ID=application,
                        MASUB_SUBMISSION_NUMBER=1,
                        MASUB_SUBMITTED_AT=reviewed_at,
                    )
                    for application in applications
                ]
            )

        MerchantApplicationReview.objects.bulk_create(
            [
                MerchantApplicationReview(
                    MAPP_ID=application,
                    MASUB_ID=(
                        submissions[index]
                        if create_submissions
                        else None
                    ),
                    USER_ID=user,
                    MAREV_DECISION=(
                        MerchantApplicationReview.Decision.APPROVED
                        if index < approved_count
                        else MerchantApplicationReview.Decision.REJECTED
                    ),
                    MAREV_REVIEWED_AT=reviewed_at,
                )
                for index, (application, user) in enumerate(
                    zip(applications, users)
                )
            ]
        )

        return applications

    def test_approval_rate_trend_returns_none_when_sample_size_is_too_small(
        self,
    ):
        periods = (
            MerchantApplicationAnalyticsService
            .get_weekly_analytics_periods()
        )

        self._create_reviewed_applications(
            count=9,
            prefix="approval-small",
            review_date=periods["current_start"],
            approved_count=9,
        )

        result = (
            MerchantApplicationAnalyticsService
            .get_approval_rate_trend()
        )

        self.assertIsNone(result)

    def test_approval_rate_trend_returns_up_when_current_rate_is_higher(
        self,
    ):
        periods = (
            MerchantApplicationAnalyticsService
            .get_weekly_analytics_periods()
        )

        self._create_reviewed_applications(
            count=10,
            prefix="approval-up-previous",
            review_date=periods["previous_start"],
            approved_count=5,
        )

        self._create_reviewed_applications(
            count=10,
            prefix="approval-up-current",
            review_date=periods["current_start"],
            approved_count=10,
        )

        result = (
            MerchantApplicationAnalyticsService
            .get_approval_rate_trend()
        )

        self.assertEqual(
            result,
            {
                "value": 50.0,
                "direction": "up",
                "unit": "percentage_points",
            },
        )

    def test_approval_rate_trend_returns_down_when_current_rate_is_lower(
        self,
    ):
        periods = (
            MerchantApplicationAnalyticsService
            .get_weekly_analytics_periods()
        )

        self._create_reviewed_applications(
            count=10,
            prefix="approval-down-previous",
            review_date=periods["previous_start"],
            approved_count=10,
        )

        self._create_reviewed_applications(
            count=10,
            prefix="approval-down-current",
            review_date=periods["current_start"],
            approved_count=0,
        )

        result = (
            MerchantApplicationAnalyticsService
            .get_approval_rate_trend()
        )

        self.assertEqual(
            result,
            {
                "value": 100.0,
                "direction": "down",
                "unit": "percentage_points",
            },
        )

    def test_approval_rate_trend_returns_unchanged_when_rates_are_equal(
        self,
    ):
        periods = (
            MerchantApplicationAnalyticsService
            .get_weekly_analytics_periods()
        )

        for period_name in (
            "previous_start",
            "current_start",
        ):
            self._create_reviewed_applications(
                count=10,
                prefix=f"approval-equal-{period_name}",
                review_date=periods[period_name],
                approved_count=5,
            )

        result = (
            MerchantApplicationAnalyticsService
            .get_approval_rate_trend()
        )

        self.assertEqual(
            result,
            {
                "value": 0.0,
                "direction": "unchanged",
                "unit": "percentage_points",
            },
        )

    def test_approval_rate_trend_counts_resubmitted_application_once(self):
        periods = (
            MerchantApplicationAnalyticsService
            .get_weekly_analytics_periods()
        )

        # Previous period: 10 approved applications → 100%.
        self._create_reviewed_applications(
            count=10,
            prefix="approval-resubmit-previous",
            review_date=periods["previous_start"],
            approved_count=10,
            create_submissions=True,
        )

        # Current period: 9 applications approved normally.
        self._create_reviewed_applications(
            count=9,
            prefix="approval-resubmit-current",
            review_date=periods["current_start"],
            approved_count=9,
            create_submissions=True,
        )

        # One application is rejected first, then approved after resubmission.
        merchant = self._create_merchants(
            count=1,
            prefix="approval-resubmitted",
        )[0]

        application = MerchantApplication.objects.create(
            USER_ID=merchant,
            MAPP_STATUS=MerchantApplication.ApplicationStatus.APPROVED,
            MAPP_SUBMISSION_COUNT=2,
        )

        reviewed_at = self._timestamp(
            periods["current_start"],
        )

        first_submission = MerchantApplicationSubmission.objects.create(
            MAPP_ID=application,
            MASUB_SUBMISSION_NUMBER=1,
            MASUB_SUBMITTED_AT=reviewed_at,
        )

        MerchantApplicationReview.objects.create(
            MAPP_ID=application,
            MASUB_ID=first_submission,
            USER_ID=merchant,
            MAREV_DECISION=(
                MerchantApplicationReview.Decision.REJECTED
            ),
            MAREV_REVIEWED_AT=reviewed_at,
        )

        second_submission = MerchantApplicationSubmission.objects.create(
            MAPP_ID=application,
            MASUB_SUBMISSION_NUMBER=2,
            MASUB_SUBMITTED_AT=reviewed_at,
        )

        MerchantApplicationReview.objects.create(
            MAPP_ID=application,
            MASUB_ID=second_submission,
            USER_ID=merchant,
            MAREV_DECISION=(
                MerchantApplicationReview.Decision.APPROVED
            ),
            MAREV_REVIEWED_AT=reviewed_at,
        )

        result = (
            MerchantApplicationAnalyticsService
            .get_approval_rate_trend()
        )

        self.assertEqual(
            result,
            {
                "value": 0.0,
                "direction": "unchanged",
                "unit": "percentage_points",
            },
        )


    def test_resubmission_rate_trend_returns_none_when_no_reviews_exist(self):
        periods = (
            MerchantApplicationAnalyticsService
            .get_weekly_analytics_periods()
        )

        self._create_merchants(
            count=10,
            prefix="resubmission-no-reviews",
        )

        result = (
            MerchantApplicationAnalyticsService
            .get_resubmission_rate_trend()
        )

        self.assertIsNone(result)

    def test_resubmission_rate_trend_returns_up_when_current_rate_is_higher(
        self,
    ):
        periods = (
            MerchantApplicationAnalyticsService
            .get_weekly_analytics_periods()
        )

        previous_users = self._create_merchants(
            count=10,
            prefix="resubmission-up-previous",
        )

        previous_applications = MerchantApplication.objects.bulk_create(
            [
                MerchantApplication(
                    USER_ID=user,
                    MAPP_STATUS=(
                        MerchantApplication.ApplicationStatus.APPROVED
                    ),
                    MAPP_SUBMISSION_COUNT=1,
                )
                for user in previous_users
            ]
        )

        previous_reviewed_at = self._timestamp(
            periods["previous_start"],
        )

        previous_submissions = (
            MerchantApplicationSubmission.objects.bulk_create(
                [
                    MerchantApplicationSubmission(
                        MAPP_ID=application,
                        MASUB_SUBMISSION_NUMBER=1,
                        MASUB_SUBMITTED_AT=previous_reviewed_at,
                    )
                    for application in previous_applications
                ]
            )
        )

        MerchantApplicationReview.objects.bulk_create(
            [
                MerchantApplicationReview(
                    MAPP_ID=application,
                    MASUB_ID=submission,
                    USER_ID=user,
                    MAREV_DECISION=(
                        MerchantApplicationReview.Decision.APPROVED
                    ),
                    MAREV_REVIEWED_AT=previous_reviewed_at,
                )
                for application, submission, user in zip(
                    previous_applications,
                    previous_submissions,
                    previous_users,
                )
            ]
        )

        current_users = self._create_merchants(
            count=10,
            prefix="resubmission-up-current",
        )

        current_applications = MerchantApplication.objects.bulk_create(
            [
                MerchantApplication(
                    USER_ID=user,
                    MAPP_STATUS=(
                        MerchantApplication.ApplicationStatus.APPROVED
                    ),
                    MAPP_SUBMISSION_COUNT=2 if index < 5 else 1,
                )
                for index, user in enumerate(current_users)
            ]
        )

        current_reviewed_at = self._timestamp(
            periods["current_start"],
        )

        current_submissions = (
            MerchantApplicationSubmission.objects.bulk_create(
                [
                    MerchantApplicationSubmission(
                        MAPP_ID=application,
                        MASUB_SUBMISSION_NUMBER=1,
                        MASUB_SUBMITTED_AT=current_reviewed_at,
                    )
                    for application in current_applications
                ]
            )
        )

        MerchantApplicationReview.objects.bulk_create(
            [
                MerchantApplicationReview(
                    MAPP_ID=application,
                    MASUB_ID=submission,
                    USER_ID=user,
                    MAREV_DECISION=(
                        MerchantApplicationReview.Decision.APPROVED
                    ),
                    MAREV_REVIEWED_AT=current_reviewed_at,
                )
                for application, submission, user in zip(
                    current_applications,
                    current_submissions,
                    current_users,
                )
            ]
        )

        result = (
            MerchantApplicationAnalyticsService
            .get_resubmission_rate_trend()
        )

        self.assertEqual(
            result,
            {
                "value": 50.0,
                "direction": "up",
                "unit": "percentage_points",
            },
        )

    def test_resubmission_rate_trend_returns_down_when_current_rate_is_lower(
        self,
    ):
        periods = (
            MerchantApplicationAnalyticsService
            .get_weekly_analytics_periods()
        )

        previous_users = self._create_merchants(
            count=10,
            prefix="resubmission-down-previous",
        )

        previous_applications = MerchantApplication.objects.bulk_create(
            [
                MerchantApplication(
                    USER_ID=user,
                    MAPP_STATUS=(
                        MerchantApplication.ApplicationStatus.APPROVED
                    ),
                    MAPP_SUBMISSION_COUNT=2 if index < 5 else 1,
                )
                for index, user in enumerate(previous_users)
            ]
        )

        previous_reviewed_at = self._timestamp(
            periods["previous_start"],
        )

        previous_submissions = (
            MerchantApplicationSubmission.objects.bulk_create(
                [
                    MerchantApplicationSubmission(
                        MAPP_ID=application,
                        MASUB_SUBMISSION_NUMBER=1,
                        MASUB_SUBMITTED_AT=previous_reviewed_at,
                    )
                    for application in previous_applications
                ]
            )
        )

        MerchantApplicationReview.objects.bulk_create(
            [
                MerchantApplicationReview(
                    MAPP_ID=application,
                    MASUB_ID=submission,
                    USER_ID=user,
                    MAREV_DECISION=(
                        MerchantApplicationReview.Decision.APPROVED
                    ),
                    MAREV_REVIEWED_AT=previous_reviewed_at,
                )
                for application, submission, user in zip(
                    previous_applications,
                    previous_submissions,
                    previous_users,
                )
            ]
        )

        current_users = self._create_merchants(
            count=10,
            prefix="resubmission-down-current",
        )

        current_applications = MerchantApplication.objects.bulk_create(
            [
                MerchantApplication(
                    USER_ID=user,
                    MAPP_STATUS=(
                        MerchantApplication.ApplicationStatus.APPROVED
                    ),
                    MAPP_SUBMISSION_COUNT=1,
                )
                for user in current_users
            ]
        )

        current_reviewed_at = self._timestamp(
            periods["current_start"],
        )

        current_submissions = (
            MerchantApplicationSubmission.objects.bulk_create(
                [
                    MerchantApplicationSubmission(
                        MAPP_ID=application,
                        MASUB_SUBMISSION_NUMBER=1,
                        MASUB_SUBMITTED_AT=current_reviewed_at,
                    )
                    for application in current_applications
                ]
            )
        )

        MerchantApplicationReview.objects.bulk_create(
            [
                MerchantApplicationReview(
                    MAPP_ID=application,
                    MASUB_ID=submission,
                    USER_ID=user,
                    MAREV_DECISION=(
                        MerchantApplicationReview.Decision.APPROVED
                    ),
                    MAREV_REVIEWED_AT=current_reviewed_at,
                )
                for application, submission, user in zip(
                    current_applications,
                    current_submissions,
                    current_users,
                )
            ]
        )

        result = (
            MerchantApplicationAnalyticsService
            .get_resubmission_rate_trend()
        )

        self.assertEqual(
            result,
            {
                "value": 50.0,
                "direction": "down",
                "unit": "percentage_points",
            },
        )

    def test_resubmission_rate_trend_returns_unchanged_when_rates_are_equal(
        self,
    ):
        periods = (
            MerchantApplicationAnalyticsService
            .get_weekly_analytics_periods()
        )

        for period_name in (
            "previous_start",
            "current_start",
        ):
            users = self._create_merchants(
                count=10,
                prefix=f"resubmission-equal-{period_name}",
            )

            applications = MerchantApplication.objects.bulk_create(
                [
                    MerchantApplication(
                        USER_ID=user,
                        MAPP_STATUS=(
                            MerchantApplication.ApplicationStatus.APPROVED
                        ),
                        MAPP_SUBMISSION_COUNT=2 if index < 5 else 1,
                    )
                    for index, user in enumerate(users)
                ]
            )

            reviewed_at = self._timestamp(
                periods[period_name],
            )

            submissions = (
                MerchantApplicationSubmission.objects.bulk_create(
                    [
                        MerchantApplicationSubmission(
                            MAPP_ID=application,
                            MASUB_SUBMISSION_NUMBER=1,
                            MASUB_SUBMITTED_AT=reviewed_at,
                        )
                        for application in applications
                    ]
                )
            )

            MerchantApplicationReview.objects.bulk_create(
                [
                    MerchantApplicationReview(
                        MAPP_ID=application,
                        MASUB_ID=submission,
                        USER_ID=user,
                        MAREV_DECISION=(
                            MerchantApplicationReview.Decision.APPROVED
                        ),
                        MAREV_REVIEWED_AT=reviewed_at,
                    )
                    for application, submission, user in zip(
                        applications,
                        submissions,
                        users,
                    )
                ]
            )

        result = (
            MerchantApplicationAnalyticsService
            .get_resubmission_rate_trend()
        )

        self.assertEqual(
            result,
            {
                "value": 0.0,
                "direction": "unchanged",
                "unit": "percentage_points",
            },
        )

    def test_resubmission_rate_trend_counts_each_application_once(self):
        periods = (
            MerchantApplicationAnalyticsService
            .get_weekly_analytics_periods()
        )

        users = self._create_merchants(
            count=10,
            prefix="resubmission-count-once",
        )

        applications = MerchantApplication.objects.bulk_create(
            [
                MerchantApplication(
                    USER_ID=user,
                    MAPP_STATUS=(
                        MerchantApplication.ApplicationStatus.APPROVED
                    ),
                    MAPP_SUBMISSION_COUNT=3 if index == 0 else 1,
                )
                for index, user in enumerate(users)
            ]
        )

        reviewed_at = self._timestamp(
            periods["current_start"],
        )

        submissions = (
            MerchantApplicationSubmission.objects.bulk_create(
                [
                    MerchantApplicationSubmission(
                        MAPP_ID=application,
                        MASUB_SUBMISSION_NUMBER=1,
                        MASUB_SUBMITTED_AT=reviewed_at,
                    )
                    for application in applications
                ]
            )
        )

        MerchantApplicationReview.objects.bulk_create(
            [
                MerchantApplicationReview(
                    MAPP_ID=application,
                    MASUB_ID=submission,
                    USER_ID=user,
                    MAREV_DECISION=(
                        MerchantApplicationReview.Decision.REJECTED
                        if index == 0
                        else MerchantApplicationReview.Decision.APPROVED
                    ),
                    MAREV_REVIEWED_AT=reviewed_at,
                )
                for index, (application, submission, user) in enumerate(
                    zip(
                        applications,
                        submissions,
                        users,
                    )
                )
            ]
        )

        result = (
            MerchantApplicationAnalyticsService
            .get_resubmission_rate_trend()
        )

        self.assertIsNone(result)


    def test_sla_compliance_rate_trend_returns_none_when_no_reviews_exist(self):
        result = (
            MerchantApplicationAnalyticsService
            .get_sla_compliance_rate_trend()
        )

        self.assertIsNone(result)

    def test_sla_compliance_rate_trend_returns_up_when_current_rate_is_higher(
        self,
    ):
        periods = (
            MerchantApplicationAnalyticsService
            .get_weekly_analytics_periods()
        )

        # Previous period: all reviews are outside the SLA.
        previous_users = self._create_merchants(
            count=10,
            prefix="sla-up-previous",
        )

        previous_applications = MerchantApplication.objects.bulk_create(
            [
                MerchantApplication(
                    USER_ID=user,
                    MAPP_STATUS=(
                        MerchantApplication.ApplicationStatus.APPROVED
                    ),
                    MAPP_SUBMISSION_COUNT=1,
                )
                for user in previous_users
            ]
        )

        previous_reviewed_at = self._timestamp(
            periods["previous_start"],
        )

        previous_submissions = (
            MerchantApplicationSubmission.objects.bulk_create(
                [
                    MerchantApplicationSubmission(
                        MAPP_ID=application,
                        MASUB_SUBMISSION_NUMBER=1,
                        MASUB_SUBMITTED_AT=(
                            previous_reviewed_at
                            - timezone.timedelta(days=10)
                        ),
                    )
                    for application in previous_applications
                ]
            )
        )

        MerchantApplicationReview.objects.bulk_create(
            [
                MerchantApplicationReview(
                    MAPP_ID=application,
                    MASUB_ID=submission,
                    USER_ID=user,
                    MAREV_DECISION=(
                        MerchantApplicationReview.Decision.APPROVED
                    ),
                    MAREV_REVIEWED_AT=previous_reviewed_at,
                )
                for application, submission, user in zip(
                    previous_applications,
                    previous_submissions,
                    previous_users,
                )
            ]
        )

        # Current period: all reviews are inside the SLA.
        current_users = self._create_merchants(
            count=10,
            prefix="sla-up-current",
        )

        current_applications = MerchantApplication.objects.bulk_create(
            [
                MerchantApplication(
                    USER_ID=user,
                    MAPP_STATUS=(
                        MerchantApplication.ApplicationStatus.APPROVED
                    ),
                    MAPP_SUBMISSION_COUNT=1,
                )
                for user in current_users
            ]
        )

        current_reviewed_at = self._timestamp(
            periods["current_start"],
        )

        current_submissions = (
            MerchantApplicationSubmission.objects.bulk_create(
                [
                    MerchantApplicationSubmission(
                        MAPP_ID=application,
                        MASUB_SUBMISSION_NUMBER=1,
                        MASUB_SUBMITTED_AT=current_reviewed_at,
                    )
                    for application in current_applications
                ]
            )
        )

        MerchantApplicationReview.objects.bulk_create(
            [
                MerchantApplicationReview(
                    MAPP_ID=application,
                    MASUB_ID=submission,
                    USER_ID=user,
                    MAREV_DECISION=(
                        MerchantApplicationReview.Decision.APPROVED
                    ),
                    MAREV_REVIEWED_AT=current_reviewed_at,
                )
                for application, submission, user in zip(
                    current_applications,
                    current_submissions,
                    current_users,
                )
            ]
        )

        result = (
            MerchantApplicationAnalyticsService
            .get_sla_compliance_rate_trend()
        )

        self.assertEqual(
            result,
            {
                "value": 100.0,
                "direction": "up",
                "unit": "percentage_points",
            },
        )

    def test_sla_compliance_rate_trend_returns_down_when_current_rate_is_lower(
        self,
    ):
        periods = (
            MerchantApplicationAnalyticsService
            .get_weekly_analytics_periods()
        )

        # Previous period: all reviews are inside the SLA.
        previous_users = self._create_merchants(
            count=10,
            prefix="sla-down-previous",
        )

        previous_applications = MerchantApplication.objects.bulk_create(
            [
                MerchantApplication(
                    USER_ID=user,
                    MAPP_STATUS=(
                        MerchantApplication.ApplicationStatus.APPROVED
                    ),
                    MAPP_SUBMISSION_COUNT=1,
                )
                for user in previous_users
            ]
        )

        previous_reviewed_at = self._timestamp(
            periods["previous_start"],
        )

        previous_submissions = (
            MerchantApplicationSubmission.objects.bulk_create(
                [
                    MerchantApplicationSubmission(
                        MAPP_ID=application,
                        MASUB_SUBMISSION_NUMBER=1,
                        MASUB_SUBMITTED_AT=previous_reviewed_at,
                    )
                    for application in previous_applications
                ]
            )
        )

        MerchantApplicationReview.objects.bulk_create(
            [
                MerchantApplicationReview(
                    MAPP_ID=application,
                    MASUB_ID=submission,
                    USER_ID=user,
                    MAREV_DECISION=(
                        MerchantApplicationReview.Decision.APPROVED
                    ),
                    MAREV_REVIEWED_AT=previous_reviewed_at,
                )
                for application, submission, user in zip(
                    previous_applications,
                    previous_submissions,
                    previous_users,
                )
            ]
        )

        # Current period: all reviews are outside the SLA.
        current_users = self._create_merchants(
            count=10,
            prefix="sla-down-current",
        )

        current_applications = MerchantApplication.objects.bulk_create(
            [
                MerchantApplication(
                    USER_ID=user,
                    MAPP_STATUS=(
                        MerchantApplication.ApplicationStatus.APPROVED
                    ),
                    MAPP_SUBMISSION_COUNT=1,
                )
                for user in current_users
            ]
        )

        current_reviewed_at = self._timestamp(
            periods["current_start"],
        )

        current_submissions = (
            MerchantApplicationSubmission.objects.bulk_create(
                [
                    MerchantApplicationSubmission(
                        MAPP_ID=application,
                        MASUB_SUBMISSION_NUMBER=1,
                        MASUB_SUBMITTED_AT=(
                            current_reviewed_at
                            - timezone.timedelta(days=10)
                        ),
                    )
                    for application in current_applications
                ]
            )
        )

        MerchantApplicationReview.objects.bulk_create(
            [
                MerchantApplicationReview(
                    MAPP_ID=application,
                    MASUB_ID=submission,
                    USER_ID=user,
                    MAREV_DECISION=(
                        MerchantApplicationReview.Decision.APPROVED
                    ),
                    MAREV_REVIEWED_AT=current_reviewed_at,
                )
                for application, submission, user in zip(
                    current_applications,
                    current_submissions,
                    current_users,
                )
            ]
        )

        result = (
            MerchantApplicationAnalyticsService
            .get_sla_compliance_rate_trend()
        )

        self.assertEqual(
            result,
            {
                "value": 100.0,
                "direction": "down",
                "unit": "percentage_points",
            },
        )

    def test_sla_compliance_rate_trend_returns_unchanged_when_rates_are_equal(
        self,
    ):
        periods = (
            MerchantApplicationAnalyticsService
            .get_weekly_analytics_periods()
        )

        for period_name in (
            "previous_start",
            "current_start",
        ):
            users = self._create_merchants(
                count=10,
                prefix=f"sla-equal-{period_name}",
            )

            applications = MerchantApplication.objects.bulk_create(
                [
                    MerchantApplication(
                        USER_ID=user,
                        MAPP_STATUS=(
                            MerchantApplication.ApplicationStatus.APPROVED
                        ),
                        MAPP_SUBMISSION_COUNT=1,
                    )
                    for user in users
                ]
            )

            reviewed_at = self._timestamp(
                periods[period_name],
            )

            submissions = (
                MerchantApplicationSubmission.objects.bulk_create(
                    [
                        MerchantApplicationSubmission(
                            MAPP_ID=application,
                            MASUB_SUBMISSION_NUMBER=1,
                            MASUB_SUBMITTED_AT=(
                                reviewed_at
                                if index < 5
                                else reviewed_at - timezone.timedelta(days=10)
                            ),
                        )
                        for index, application in enumerate(applications)
                    ]
                )
            )

            MerchantApplicationReview.objects.bulk_create(
                [
                    MerchantApplicationReview(
                        MAPP_ID=application,
                        MASUB_ID=submission,
                        USER_ID=user,
                        MAREV_DECISION=(
                            MerchantApplicationReview.Decision.APPROVED
                        ),
                        MAREV_REVIEWED_AT=reviewed_at,
                    )
                    for application, submission, user in zip(
                        applications,
                        submissions,
                        users,
                    )
                ]
            )

        result = (
            MerchantApplicationAnalyticsService
            .get_sla_compliance_rate_trend()
        )

        self.assertEqual(
            result,
            {
                "value": 0.0,
                "direction": "unchanged",
                "unit": "percentage_points",
            },
        )

    def test_sla_compliance_rate_trend_counts_resubmission_reviews_independently(
        self,
    ):
        periods = (
            MerchantApplicationAnalyticsService
            .get_weekly_analytics_periods()
        )

        # Previous period: 10 non-compliant review events.
        previous_users = self._create_merchants(
            count=10,
            prefix="sla-resubmission-previous",
        )

        previous_applications = MerchantApplication.objects.bulk_create(
            [
                MerchantApplication(
                    USER_ID=user,
                    MAPP_STATUS=(
                        MerchantApplication.ApplicationStatus.REJECTED
                    ),
                    MAPP_SUBMISSION_COUNT=1,
                )
                for user in previous_users
            ]
        )

        previous_reviewed_at = self._timestamp(
            periods["previous_start"],
        )

        previous_submissions = (
            MerchantApplicationSubmission.objects.bulk_create(
                [
                    MerchantApplicationSubmission(
                        MAPP_ID=application,
                        MASUB_SUBMISSION_NUMBER=1,
                        MASUB_SUBMITTED_AT=(
                            previous_reviewed_at - timedelta(days=10)
                        ),
                    )
                    for application in previous_applications
                ]
            )
        )

        MerchantApplicationReview.objects.bulk_create(
            [
                MerchantApplicationReview(
                    MAPP_ID=application,
                    MASUB_ID=submission,
                    USER_ID=user,
                    MAREV_DECISION=(
                        MerchantApplicationReview.Decision.REJECTED
                    ),
                    MAREV_REVIEWED_AT=previous_reviewed_at,
                )
                for application, submission, user in zip(
                    previous_applications,
                    previous_submissions,
                    previous_users,
                )
            ]
        )

        # Current period: 10 non-compliant first reviews.
        current_users = self._create_merchants(
            count=10,
            prefix="sla-resubmission-current",
        )

        current_applications = MerchantApplication.objects.bulk_create(
            [
                MerchantApplication(
                    USER_ID=user,
                    MAPP_STATUS=(
                        MerchantApplication.ApplicationStatus.APPROVED
                    ),
                    MAPP_SUBMISSION_COUNT=2,
                )
                for user in current_users
            ]
        )

        current_reviewed_at = self._timestamp(
            periods["current_start"],
        )

        first_submissions = (
            MerchantApplicationSubmission.objects.bulk_create(
                [
                    MerchantApplicationSubmission(
                        MAPP_ID=application,
                        MASUB_SUBMISSION_NUMBER=1,
                        MASUB_SUBMITTED_AT=(
                            current_reviewed_at - timedelta(days=10)
                        ),
                    )
                    for application in current_applications
                ]
            )
        )

        MerchantApplicationReview.objects.bulk_create(
            [
                MerchantApplicationReview(
                    MAPP_ID=application,
                    MASUB_ID=submission,
                    USER_ID=user,
                    MAREV_DECISION=(
                        MerchantApplicationReview.Decision.REJECTED
                    ),
                    MAREV_REVIEWED_AT=current_reviewed_at,
                )
                for application, submission, user in zip(
                    current_applications,
                    first_submissions,
                    current_users,
                )
            ]
        )

        # One application is resubmitted and its second review is compliant.
        second_submission = MerchantApplicationSubmission.objects.create(
            MAPP_ID=current_applications[0],
            MASUB_SUBMISSION_NUMBER=2,
            MASUB_SUBMITTED_AT=current_reviewed_at,
        )

        MerchantApplicationReview.objects.create(
            MAPP_ID=current_applications[0],
            MASUB_ID=second_submission,
            USER_ID=current_users[0],
            MAREV_DECISION=(
                MerchantApplicationReview.Decision.APPROVED
            ),
            MAREV_REVIEWED_AT=current_reviewed_at,
        )

        result = (
            MerchantApplicationAnalyticsService
            .get_sla_compliance_rate_trend()
        )

        self.assertEqual(
            result,
            {
                "value": 9.1,
                "direction": "up",
                "unit": "percentage_points",
            },
        )

    def test_pending_review_trend_returns_none_when_sample_size_is_too_small(
        self,
    ):
        periods = (
            MerchantApplicationAnalyticsService
            .get_weekly_analytics_periods()
        )

        users = self._create_merchants(
            count=9,
            prefix="pending-small",
        )

        applications = MerchantApplication.objects.bulk_create(
            [
                MerchantApplication(
                    USER_ID=user,
                    MAPP_STATUS=(
                        MerchantApplication.ApplicationStatus.SUBMITTED
                    ),
                    MAPP_SUBMISSION_COUNT=1,
                )
                for user in users
            ]
        )

        submitted_at = self._timestamp(
            periods["current_start"],
        )

        MerchantApplicationSubmission.objects.bulk_create(
            [
                MerchantApplicationSubmission(
                    MAPP_ID=application,
                    MASUB_SUBMISSION_NUMBER=1,
                    MASUB_SUBMITTED_AT=submitted_at,
                )
                for application in applications
            ]
        )

        result = (
            MerchantApplicationAnalyticsService
            .get_pending_review_trend()
        )

        self.assertIsNone(result)

    def test_pending_review_trend_returns_up_when_current_pending_count_is_higher(
        self,
    ):
        periods = (
            MerchantApplicationAnalyticsService
            .get_weekly_analytics_periods()
        )

        # Previous period: 10 submissions, all pending.
        previous_users = self._create_merchants(
            count=10,
            prefix="pending-up-previous",
        )

        previous_applications = MerchantApplication.objects.bulk_create(
            [
                MerchantApplication(
                    USER_ID=user,
                    MAPP_STATUS=(
                        MerchantApplication.ApplicationStatus.SUBMITTED
                    ),
                    MAPP_SUBMISSION_COUNT=1,
                )
                for user in previous_users
            ]
        )

        previous_submitted_at = self._timestamp(
            periods["previous_start"],
        )

        previous_submissions = (
            MerchantApplicationSubmission.objects.bulk_create(
                [
                    MerchantApplicationSubmission(
                        MAPP_ID=application,
                        MASUB_SUBMISSION_NUMBER=1,
                        MASUB_SUBMITTED_AT=previous_submitted_at,
                    )
                    for application in previous_applications
                ]
            )
        )

        # Current period: 3 previous submissions get reviewed,
        # while 5 new submissions enter the queue.
        reviewed_at = self._timestamp(
            periods["current_start"],
        )

        MerchantApplicationReview.objects.bulk_create(
            [
                MerchantApplicationReview(
                    MAPP_ID=previous_applications[index],
                    MASUB_ID=previous_submissions[index],
                    USER_ID=previous_users[index],
                    MAREV_DECISION=(
                        MerchantApplicationReview.Decision.APPROVED
                    ),
                    MAREV_REVIEWED_AT=reviewed_at,
                )
                for index in range(3)
            ]
        )

        current_users = self._create_merchants(
            count=5,
            prefix="pending-up-current",
        )

        current_applications = MerchantApplication.objects.bulk_create(
            [
                MerchantApplication(
                    USER_ID=user,
                    MAPP_STATUS=(
                        MerchantApplication.ApplicationStatus.SUBMITTED
                    ),
                    MAPP_SUBMISSION_COUNT=1,
                )
                for user in current_users
            ]
        )

        MerchantApplicationSubmission.objects.bulk_create(
            [
                MerchantApplicationSubmission(
                    MAPP_ID=application,
                    MASUB_SUBMISSION_NUMBER=1,
                    MASUB_SUBMITTED_AT=reviewed_at,
                )
                for application in current_applications
            ]
        )

        result = (
            MerchantApplicationAnalyticsService
            .get_pending_review_trend()
        )

        self.assertEqual(
            result,
            {
                "value": 2,
                "direction": "up",
                "unit": "count",
            },
        )

    def test_pending_review_trend_returns_down_when_current_pending_count_is_lower(
        self,
    ):
        periods = (
            MerchantApplicationAnalyticsService
            .get_weekly_analytics_periods()
        )

        # Previous period: 12 submissions, all pending.
        previous_users = self._create_merchants(
            count=12,
            prefix="pending-down-previous",
        )

        previous_applications = MerchantApplication.objects.bulk_create(
            [
                MerchantApplication(
                    USER_ID=user,
                    MAPP_STATUS=(
                        MerchantApplication.ApplicationStatus.SUBMITTED
                    ),
                    MAPP_SUBMISSION_COUNT=1,
                )
                for user in previous_users
            ]
        )

        previous_submitted_at = self._timestamp(
            periods["previous_start"],
        )

        previous_submissions = (
            MerchantApplicationSubmission.objects.bulk_create(
                [
                    MerchantApplicationSubmission(
                        MAPP_ID=application,
                        MASUB_SUBMISSION_NUMBER=1,
                        MASUB_SUBMITTED_AT=previous_submitted_at,
                    )
                    for application in previous_applications
                ]
            )
        )

        # Current period: 4 of those submissions are reviewed.
        reviewed_at = self._timestamp(
            periods["current_start"],
        )

        MerchantApplicationReview.objects.bulk_create(
            [
                MerchantApplicationReview(
                    MAPP_ID=previous_applications[index],
                    MASUB_ID=previous_submissions[index],
                    USER_ID=previous_users[index],
                    MAREV_DECISION=(
                        MerchantApplicationReview.Decision.APPROVED
                    ),
                    MAREV_REVIEWED_AT=reviewed_at,
                )
                for index in range(4)
            ]
        )

        # 12 - 4 = 8 pending.

        result = (
            MerchantApplicationAnalyticsService
            .get_pending_review_trend()
        )

        self.assertEqual(
            result,
            {
                "value": 4,
                "direction": "down",
                "unit": "count",
            },
        )

    def test_pending_review_trend_returns_unchanged_when_pending_counts_are_equal(
        self,
    ):
        periods = (
            MerchantApplicationAnalyticsService
            .get_weekly_analytics_periods()
        )

        # Previous period: 10 pending submissions.
        previous_users = self._create_merchants(
            count=10,
            prefix="pending-equal-previous",
        )

        previous_applications = MerchantApplication.objects.bulk_create(
            [
                MerchantApplication(
                    USER_ID=user,
                    MAPP_STATUS=(
                        MerchantApplication.ApplicationStatus.SUBMITTED
                    ),
                    MAPP_SUBMISSION_COUNT=1,
                )
                for user in previous_users
            ]
        )

        previous_submitted_at = self._timestamp(
            periods["previous_start"],
        )

        previous_submissions = (
            MerchantApplicationSubmission.objects.bulk_create(
                [
                    MerchantApplicationSubmission(
                        MAPP_ID=application,
                        MASUB_SUBMISSION_NUMBER=1,
                        MASUB_SUBMITTED_AT=previous_submitted_at,
                    )
                    for application in previous_applications
                ]
            )
        )

        # Review 3 old submissions.
        current_reviewed_at = self._timestamp(
            periods["current_start"],
        )

        MerchantApplicationReview.objects.bulk_create(
            [
                MerchantApplicationReview(
                    MAPP_ID=previous_applications[index],
                    MASUB_ID=previous_submissions[index],
                    USER_ID=previous_users[index],
                    MAREV_DECISION=(
                        MerchantApplicationReview.Decision.APPROVED
                    ),
                    MAREV_REVIEWED_AT=current_reviewed_at,
                )
                for index in range(3)
            ]
        )

        # Add 3 new submissions.
        current_users = self._create_merchants(
            count=3,
            prefix="pending-equal-current",
        )

        current_applications = MerchantApplication.objects.bulk_create(
            [
                MerchantApplication(
                    USER_ID=user,
                    MAPP_STATUS=(
                        MerchantApplication.ApplicationStatus.SUBMITTED
                    ),
                    MAPP_SUBMISSION_COUNT=1,
                )
                for user in current_users
            ]
        )

        MerchantApplicationSubmission.objects.bulk_create(
            [
                MerchantApplicationSubmission(
                    MAPP_ID=application,
                    MASUB_SUBMISSION_NUMBER=1,
                    MASUB_SUBMITTED_AT=current_reviewed_at,
                )
                for application in current_applications
            ]
        )

        # Previous: 10 pending.
        # Current: 10 - 3 + 3 = 10 pending.

        result = (
            MerchantApplicationAnalyticsService
            .get_pending_review_trend()
        )

        self.assertEqual(
            result,
            {
                "value": 0,
                "direction": "unchanged",
                "unit": "count",
            },
        )

    def test_pending_review_trend_treats_resubmissions_as_separate_submissions(
        self,
    ):
        periods = (
            MerchantApplicationAnalyticsService
            .get_weekly_analytics_periods()
        )

        users = self._create_merchants(
            count=10,
            prefix="pending-resubmission",
        )

        applications = MerchantApplication.objects.bulk_create(
            [
                MerchantApplication(
                    USER_ID=user,
                    MAPP_STATUS=(
                        MerchantApplication.ApplicationStatus.SUBMITTED
                    ),
                    MAPP_SUBMISSION_COUNT=2,
                )
                for user in users
            ]
        )

        previous_submitted_at = self._timestamp(
            periods["previous_start"],
        )

        first_submissions = (
            MerchantApplicationSubmission.objects.bulk_create(
                [
                    MerchantApplicationSubmission(
                        MAPP_ID=application,
                        MASUB_SUBMISSION_NUMBER=1,
                        MASUB_SUBMITTED_AT=previous_submitted_at,
                    )
                    for application in applications
                ]
            )
        )

        # All first submissions are reviewed during the current period.
        current_reviewed_at = self._timestamp(
            periods["current_start"],
        )

        MerchantApplicationReview.objects.bulk_create(
            [
                MerchantApplicationReview(
                    MAPP_ID=application,
                    MASUB_ID=submission,
                    USER_ID=user,
                    MAREV_DECISION=(
                        MerchantApplicationReview.Decision.REJECTED
                    ),
                    MAREV_REVIEWED_AT=current_reviewed_at,
                )
                for application, submission, user in zip(
                    applications,
                    first_submissions,
                    users,
                )
            ]
        )

        # Resubmit the first application.
        MerchantApplicationSubmission.objects.create(
            MAPP_ID=applications[0],
            MASUB_SUBMISSION_NUMBER=2,
            MASUB_SUBMITTED_AT=current_reviewed_at,
        )

        result = (
            MerchantApplicationAnalyticsService
            .get_pending_review_trend()
        )

        # Previous cutoff:
        # 10 first submissions were pending.
        #
        # Current cutoff:
        # all 10 first submissions were reviewed,
        # and submission #2 is pending.
        #
        # Therefore the trend is 10 -> 1, or -9.

        self.assertEqual(
            result,
            {
                "value": 9,
                "direction": "down",
                "unit": "count",
            },
        )