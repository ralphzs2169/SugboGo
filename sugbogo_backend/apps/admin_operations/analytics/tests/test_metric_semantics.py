"""Regression coverage for classified SLA, chronological recovery and fair cutoffs."""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from django.test import TestCase, override_settings

from apps.admin_operations.analytics.services.merchant_application_analytics_service import (
    MerchantApplicationAnalyticsService,
)
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationReview,
    MerchantApplicationSubmission,
)
from apps.users.models import User
from apps.admin_operations.system_configuration.models import (
    AnalyticsPolicyConfiguration,
)


@override_settings(TIME_ZONE="UTC")
class MetricSemanticsTests(TestCase):
    NOW = datetime(
        2026,
        10,
        14,
        10,
        30,
        tzinfo=UTC,
    )

    def setUp(self):
        AnalyticsPolicyConfiguration.objects.get_or_create(pk=1)
        clock = patch(
            "django.utils.timezone.now",
            return_value=self.NOW,
        )
        clock.start()
        self.addCleanup(clock.stop)
        self.sequence = 0

    def application(self):
        self.sequence += 1
        user = User.objects.create_user(
            email=f"semantics-{self.sequence}@example.com",
            password=None,
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        return MerchantApplication.objects.create(USER_ID=user)

    def submission(
        self,
        application,
        timestamp,
        number=1,
    ):
        return MerchantApplicationSubmission.objects.create(
            MAPP_ID=application,
            MASUB_SUBMITTED_AT=timestamp,
            MASUB_SUBMISSION_NUMBER=number,
        )

    def review(
        self,
        application,
        timestamp,
        outcome=None,
        decision="rejected",
        submission=None,
    ):
        return MerchantApplicationReview.objects.create(
            MAPP_ID=application,
            MASUB_ID=submission,
            USER_ID=application.USER_ID,
            MAREV_DECISION=decision,
            MAREV_REVIEWED_AT=timestamp,
            MAREV_SLA_COMPLIANT=outcome,
        )

    def test_sla_classified_denominator_and_unknown_counts(self):
        for outcomes, expected, classified in (
            ([True, None], 100.0, 1),
            ([True, False, None], 50.0, 2),
            ([None], None, 0),
        ):
            with self.subTest(outcomes=outcomes):
                application = self.application()
                for outcome in outcomes:
                    self.review(
                        application,
                        self.NOW - timedelta(hours=1),
                        outcome,
                    )
                reviews = MerchantApplicationReview.objects.filter(MAPP_ID=application)
                result = MerchantApplicationAnalyticsService.get_sla_outcomes(reviews)
                self.assertEqual(
                    result["unknown"],
                    1,
                )
                self.assertEqual(
                    result["classified"],
                    classified,
                )
                self.assertEqual(
                    result["rate"],
                    expected,
                )

    def test_overall_and_daily_sla_exclude_unknown_results(self):
        application = self.application()
        timestamp = self.NOW - timedelta(hours=1)
        for number, outcome in enumerate(
            (True, False, None),
            1,
        ):
            submission = self.submission(
                application,
                timestamp,
                number,
            )
            self.review(
                application,
                timestamp,
                outcome,
                submission=submission,
            )
        self.assertEqual(
            MerchantApplicationAnalyticsService.get_sla_compliance_rate(),
            50.0,
        )
        history = MerchantApplicationAnalyticsService.get_sla_compliance_rate_history()
        self.assertEqual(
            history[-1]["value"],
            50.0,
        )

    def test_unknown_only_sla_has_no_overall_daily_or_weekly_rate(self):
        application = self.application()
        timestamp = self.NOW - timedelta(hours=1)
        submission = self.submission(
            application,
            timestamp,
        )
        self.review(
            application,
            timestamp,
            submission=submission,
        )
        self.assertIsNone(MerchantApplicationAnalyticsService.get_sla_compliance_rate())
        self.assertIsNone(MerchantApplicationAnalyticsService.get_sla_compliance_rate_trend())
        self.assertIsNone(
            MerchantApplicationAnalyticsService.get_sla_compliance_rate_history()[-1]["value"],
        )

    def test_weekly_sla_uses_classified_sample_and_ignores_unknowns(self):
        for days, outcomes in ((7, [True] * 10), (0, [True] * 10 + [None] * 10)):
            timestamp = self.NOW - timedelta(
                days=days,
                hours=1,
            )
            for outcome in outcomes:
                application = self.application()
                submission = self.submission(
                    application,
                    timestamp,
                )
                self.review(
                    application,
                    timestamp,
                    outcome,
                    submission=submission,
                )
        self.assertEqual(
            MerchantApplicationAnalyticsService.get_sla_compliance_rate_trend(),
            {
                "value": 0.0,
                "direction": "unchanged",
                "unit": "percentage_points",
            },
        )

    def test_unknown_sla_does_not_satisfy_minimum_comparison_sample(self):
        for days in (0, 7):
            timestamp = self.NOW - timedelta(
                days=days,
                hours=1,
            )
            for outcome in [True] + [None] * 10:
                application = self.application()
                submission = self.submission(
                    application,
                    timestamp,
                )
                self.review(
                    application,
                    timestamp,
                    outcome,
                    submission=submission,
                )
        self.assertIsNone(MerchantApplicationAnalyticsService.get_sla_compliance_rate_trend())

    def test_submission_count_does_not_establish_resubmission(self):
        application = self.application()
        MerchantApplication.objects.filter(pk=application.pk).update(MAPP_SUBMISSION_COUNT=99)
        self.submission(
            application,
            self.NOW - timedelta(hours=3),
        )
        self.submission(
            application,
            self.NOW - timedelta(hours=2),
            2,
        )
        self.review(
            application,
            self.NOW - timedelta(hours=1),
        )
        self.assertEqual(
            MerchantApplicationAnalyticsService.get_resubmission_rate(),
            0.0,
        )

    def test_multiple_rejection_cycles_are_events_but_rate_counts_application_once(self):
        application = self.application()
        self.submission(
            application,
            self.NOW - timedelta(hours=5),
        )
        self.review(
            application,
            self.NOW - timedelta(hours=4),
        )
        second = self.submission(
            application,
            self.NOW - timedelta(hours=3),
            2,
        )
        self.review(
            application,
            self.NOW - timedelta(hours=2),
        )
        third = self.submission(
            application,
            self.NOW - timedelta(hours=1),
            3,
        )
        qualified = MerchantApplicationAnalyticsService.get_post_rejection_submissions(
            self.NOW,
        )
        qualified_ids = list(
            qualified.values_list(
                "pk",
                flat=True,
            ),
        )
        counts = MerchantApplicationAnalyticsService.get_resubmission_counts(
            self.NOW,
        )
        self.assertEqual(
            qualified_ids,
            [second.pk, third.pk],
        )
        self.assertEqual(
            counts,
            {
                "eligible": 1,
                "resubmitted": 1,
            },
        )
        self.assertEqual(
            MerchantApplicationAnalyticsService.get_resubmission_rate(),
            100.0,
        )

    def test_equal_timestamp_is_not_after_rejection_and_other_application_cannot_qualify(self):
        application = self.application()
        timestamp = self.NOW - timedelta(hours=1)
        self.review(
            application,
            timestamp,
        )
        self.submission(
            application,
            timestamp,
        )
        other = self.application()
        self.submission(
            other,
            self.NOW - timedelta(minutes=1),
        )
        self.assertEqual(
            MerchantApplicationAnalyticsService.get_resubmission_rate(),
            0.0,
        )

    def test_rejection_and_submission_use_exclusive_as_of_cutoff(self):
        application = self.application()
        self.review(
            application,
            self.NOW - timedelta(hours=1),
        )
        self.submission(
            application,
            self.NOW,
        )
        self.assertEqual(
            MerchantApplicationAnalyticsService.get_resubmission_rate(self.NOW),
            0.0,
        )
        later = self.NOW + timedelta(microseconds=1)
        self.assertEqual(
            MerchantApplicationAnalyticsService.get_resubmission_rate(later),
            100.0,
        )
        self.review(
            self.application(),
            later,
        )
        counts = MerchantApplicationAnalyticsService.get_resubmission_counts(
            later,
        )
        self.assertEqual(
            counts["eligible"],
            1,
        )

    def test_history_and_headline_share_cumulative_definition(self):
        application = self.application()
        self.review(
            application,
            self.NOW - timedelta(days=3),
        )
        self.submission(
            application,
            self.NOW - timedelta(days=1),
        )
        MerchantApplication.objects.filter(pk=application.pk).update(MAPP_STATUS="approved")
        history = MerchantApplicationAnalyticsService.get_resubmission_rate_history()
        self.assertIsNone(history[0]["value"])
        self.assertEqual(
            history[-3]["value"],
            0.0,
        )
        self.assertEqual(
            history[-2]["value"],
            100.0,
        )
        self.assertEqual(
            history[-1]["value"],
            MerchantApplicationAnalyticsService.get_resubmission_rate(),
        )

    def test_resubmission_trend_includes_earlier_rejections_and_stops_at_each_cutoff(self):
        for index in range(10):
            application = self.application()
            self.review(
                application,
                self.NOW - timedelta(days=10),
            )
            if index < 5:
                self.submission(
                    application,
                    self.NOW - timedelta(days=1),
                )
        self.assertEqual(
            MerchantApplicationAnalyticsService.get_resubmission_rate_trend(),
            {
                "value": 50.0,
                "direction": "up",
                "unit": "percentage_points",
            },
        )

    def test_partial_day_comparisons_keep_utc_and_equal_elapsed_boundaries(self):
        with override_settings(TIME_ZONE="UTC"):
            periods = MerchantApplicationAnalyticsService.get_weekly_comparison_periods(
                self.NOW,
            )
        expected_start = datetime(
            2026,
            10,
            12,
            tzinfo=UTC,
        )
        self.assertEqual(
            periods["current_start"],
            expected_start,
        )
        self.assertEqual(
            periods["current_end_exclusive"],
            self.NOW,
        )
        self.assertEqual(
            periods["previous_end_exclusive"],
            self.NOW - timedelta(days=7),
        )
        self.assertEqual(
            periods["current_end_exclusive"] - periods["current_start"],
            periods["previous_end_exclusive"] - periods["previous_start"],
        )

    def test_approval_and_sla_trends_exclude_prior_afternoon_and_exact_end(self):
        for days in (0, 7):
            timestamp = self.NOW - timedelta(
                days=days,
                hours=1,
            )
            for _ in range(10):
                application = self.application()
                submission = self.submission(
                    application,
                    timestamp,
                )
                self.review(
                    application,
                    timestamp,
                    True,
                    "approved",
                    submission,
                )
        for timestamp in (
            self.NOW - timedelta(days=7),
            self.NOW - timedelta(days=7) + timedelta(hours=2),
            self.NOW,
        ):
            application = self.application()
            submission = self.submission(
                application,
                timestamp,
            )
            self.review(
                application,
                timestamp,
                False,
                "rejected",
                submission,
            )
        for method in (
            MerchantApplicationAnalyticsService.get_approval_rate_trend,
            MerchantApplicationAnalyticsService.get_sla_compliance_rate_trend,
        ):
            self.assertEqual(
                method()["value"],
                0.0,
            )

    def test_comparison_metadata_exposes_corrected_bounds_without_removing_keys(self):
        statistics = MerchantApplicationAnalyticsService.get_application_statistics(
            self.NOW,
        )
        meta = statistics["comparison_meta"]
        self.assertEqual(
            meta["timezone"],
            "UTC",
        )
        self.assertEqual(
            meta["strategy"],
            "equal_elapsed_week_to_date",
        )
        self.assertEqual(
            meta["resubmission_basis"],
            "cumulative_as_of_comparison_end",
        )
        self.assertEqual(
            meta["bounds"]["current_end_exclusive"],
            self.NOW.isoformat(),
        )
        self.assertIn(
            "resubmission_rate_history",
            statistics,
        )
        self.assertIn(
            "sla_compliance_rate_trend",
            statistics,
        )
