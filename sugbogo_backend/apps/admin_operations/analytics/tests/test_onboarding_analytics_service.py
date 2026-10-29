"""Legacy reuse, weekday aging and Manila weekly submission/review events."""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone

from apps.admin_operations.analytics.services.merchant_application_analytics_service import MerchantApplicationAnalyticsService
from apps.admin_operations.analytics.services.onboarding_analytics_service import OnboardingAnalyticsService
from apps.merchant_application.models import MerchantApplication, MerchantApplicationReview, MerchantApplicationSubmission
from apps.shared.analytics.date_ranges import MANILA, resolve_period
from apps.users.models import User
from apps.admin_operations.system_configuration.models import (
    AnalyticsPolicyConfiguration,
)


class OnboardingAnalyticsServiceTests(TestCase):
    NOW = datetime(2026, 10, 12, 4, 30, tzinfo=UTC)

    @classmethod
    def setUpTestData(cls):
        AnalyticsPolicyConfiguration.objects.get_or_create(pk=1)
        cls.period = resolve_period(now=cls.NOW)
        cls.owner = User.objects.create_user(
            email="onboarding-operations@example.com", password=None,
            USER_ROLE=User.UserRole.MERCHANT, USER_STATUS=User.UserStatus.ACTIVE,
            USER_FNAME="Onboarding", USER_LNAME="Owner",
        )

    def application(self, submitted_at=None, status=MerchantApplication.ApplicationStatus.SUBMITTED):
        owner = User.objects.create_user(
            email=f"onboarding-app-{MerchantApplication.objects.count()}@example.com", password=None,
            USER_ROLE=User.UserRole.MERCHANT, USER_STATUS=User.UserStatus.ACTIVE,
            USER_FNAME="Application", USER_LNAME="Owner",
        )
        return MerchantApplication.objects.create(
            USER_ID=owner, MAPP_SUBMITTED_AT=submitted_at, MAPP_STATUS=status,
        )

    def submission(self, application, timestamp, number=1):
        return MerchantApplicationSubmission.objects.create(
            MAPP_ID=application, MASUB_SUBMITTED_AT=timestamp, MASUB_SUBMISSION_NUMBER=number,
        )

    def decision(self, application, timestamp, decision="approved"):
        return MerchantApplicationReview.objects.create(
            MAPP_ID=application, USER_ID=self.owner, MAREV_DECISION=decision, MAREV_REVIEWED_AT=timestamp,
        )

    @override_settings(TIME_ZONE="UTC")
    def test_existing_statistics_are_reused_unchanged_under_native_timezone(self):
        statistics = {
            "pending_review": 7, "approval_rate": None, "existing_key": [1, 2],
            "policy_version": 1, "comparison_minimum_sample": 10,
        }
        with timezone.override(MANILA), patch.object(
            MerchantApplicationAnalyticsService, "get_application_statistics",
            side_effect=lambda **kwargs: (self.assertEqual(timezone.get_current_timezone_name(), "UTC") or statistics),
        ) as legacy, patch(
            "apps.admin_operations.analytics.services.merchant_application_analytics_service.timezone.localdate",
            return_value=self.NOW.date(),
        ):
            result = OnboardingAnalyticsService.get_report(self.period)
        legacy.assert_called_once_with(now=self.period.generated_at)
        self.assertIs(result["legacy_statistics"], statistics)
        self.assertEqual(result["legacy_meta"]["timezone"], "UTC")
        self.assertFalse(result["legacy_meta"]["selected_period_applies"])
        self.assertEqual(result["meta"]["period"]["timezone"], "Asia/Manila")

    def test_empty_existing_rates_remain_null_and_weeks_are_zero_filled(self):
        with patch("django.utils.timezone.now", return_value=self.NOW):
            result = OnboardingAnalyticsService.get_report(self.period)
        self.assertIsNone(result["legacy_statistics"]["approval_rate"])
        self.assertIsNone(result["legacy_statistics"]["sla_compliance_rate"])
        self.assertTrue(result["weekly_activity"])
        self.assertTrue(all(row["submissions"] == row["completed_reviews"] == 0 for row in result["weekly_activity"]))

    @override_settings(TIME_ZONE="UTC")
    def test_weekday_aging_uses_shared_three_and_five_day_thresholds(self):
        for days in (0, 4, 5, 6, 7):
            self.application(self.NOW - timedelta(days=days))
        self.application()
        self.application(self.NOW + timedelta(hours=1))
        self.application(self.NOW - timedelta(days=30), "approved")
        self.application(self.NOW - timedelta(days=30), "draft")
        self.assertEqual(OnboardingAnalyticsService.pending_aging(self.NOW), {
            "on_time": 2, "approaching": 2, "overdue": 1, "unknown_age": 2,
        })

    def test_resubmissions_and_unlinked_decisions_are_events_not_unique_applications(self):
        application = self.application()
        self.submission(application, self.NOW - timedelta(days=2), 1)
        self.submission(application, self.NOW - timedelta(days=1), 2)
        self.decision(application, self.NOW - timedelta(days=1), "rejected")
        self.decision(application, self.NOW - timedelta(hours=1), "approved")
        series = OnboardingAnalyticsService.weekly_activity(self.period)
        self.assertEqual(sum(row["submissions"] for row in series), 2)
        self.assertEqual(sum(row["completed_reviews"] for row in series), 2)

    @override_settings(TIME_ZONE="UTC")
    def test_pending_aging_retains_utc_dates_at_manila_midnight(self):
        now = datetime(2026, 10, 11, 16, 30, tzinfo=UTC)
        self.application(datetime(2026, 10, 7, 8, 0, tzinfo=UTC))
        with timezone.override(MANILA):
            result = OnboardingAnalyticsService.pending_aging(now)
        # Sunday UTC has only two elapsed weekdays; Manila has already reached Monday.
        self.assertEqual(result["on_time"], 1)
        self.assertEqual(result["approaching"], 0)

    def test_manila_week_boundary_and_half_open_period_edges(self):
        application = self.application()
        timestamps = (
            self.period.start - timedelta(microseconds=1), self.period.start,
            datetime(2026, 10, 11, 15, 59, tzinfo=UTC),
            datetime(2026, 10, 11, 16, 0, tzinfo=UTC), self.period.end,
        )
        for number, timestamp in enumerate(timestamps, 1):
            self.submission(application, timestamp, number)
            self.decision(application, timestamp)
        series = OnboardingAnalyticsService.weekly_activity(self.period)
        self.assertEqual(sum(row["submissions"] for row in series), 3)
        self.assertEqual(sum(row["completed_reviews"] for row in series), 3)
        self.assertEqual(next(row for row in series if row["date"] == "2026-10-05")["submissions"], 1)
        self.assertEqual(next(row for row in series if row["date"] == "2026-10-12")["submissions"], 1)
