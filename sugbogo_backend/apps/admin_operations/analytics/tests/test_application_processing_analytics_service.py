"""Linked review turnaround and overlapping rejection-section populations."""

from datetime import timedelta

from django.test import TestCase

from apps.admin_operations.analytics.services.application_processing_analytics_service import (
    ApplicationProcessingAnalyticsService,
)
from apps.admin_operations.analytics.services.reporting_helpers import summarize_turnaround
from apps.merchant_application.models import MerchantApplicationFeedback

from .reporting_fixtures import ReportingFixtures


class ApplicationProcessingAnalyticsServiceTests(ReportingFixtures, TestCase):
    def feedback(
        self,
        review,
        section,
    ):
        return MerchantApplicationFeedback.objects.create(
            MAREV_ID=review,
            MAPF_SECTION=section,
            MAPF_MESSAGE="Update this section.",
        )

    def test_empty_processing_has_null_durations_and_undefined_shares(self):
        report = ApplicationProcessingAnalyticsService.get_report(self.period)
        self.assertIsNone(report["review_turnaround"]["median_hours"])
        self.assertIsNone(report["review_turnaround"]["mean_hours"])
        self.assertEqual(
            report["review_turnaround"]["sample_count"],
            0,
        )
        self.assertTrue(
            all(
                (row["decision_share_percentage"] is None for row in report["rejection_insights"]["sections"]),
            ),
        )

    def test_multiple_cycles_use_each_reviews_own_submission_and_pool_mean_median(self):
        application = self.make_application()
        for number, hours in enumerate(
            (0, 2, 10),
            1,
        ):
            submitted = self.period.start + timedelta(days=number)
            submission = self.make_submission(
                application,
                submitted,
                number,
            )
            self.make_decision(
                application,
                submitted + timedelta(hours=hours),
                submission=submission,
            )
        result = ApplicationProcessingAnalyticsService.review_turnaround(self.period)
        self.assertEqual(
            result["candidate_count"],
            3,
        )
        self.assertEqual(
            result["sample_count"],
            3,
        )
        self.assertEqual(
            result["median_hours"],
            2,
        )
        self.assertEqual(
            result["mean_hours"],
            4,
        )

    def test_missing_link_cross_application_link_and_negative_chronology_are_excluded(self):
        application = self.make_application()
        when = self.period.start + timedelta(days=1)
        self.make_decision(
            application,
            when,
        )
        future_submission = self.make_submission(
            application,
            when + timedelta(hours=1),
        )
        self.make_decision(
            application,
            when,
            submission=future_submission,
        )
        other = self.make_application()
        unrelated = self.make_submission(
            other,
            when - timedelta(hours=1),
        )
        self.make_decision(
            application,
            when,
            submission=unrelated,
        )
        result = ApplicationProcessingAnalyticsService.review_turnaround(self.period)
        self.assertEqual(
            result["excluded_count"],
            3,
        )
        self.assertEqual(
            result["missing_timestamp_count"],
            1,
        )
        self.assertEqual(
            result["invalid_chronology_count"],
            1,
        )
        self.assertEqual(
            result["unrelated_record_count"],
            1,
        )
        self.assertIsNone(result["median_hours"])

    def test_missing_timestamp_summary_never_invents_a_duration(self):
        # Decision/submission times are non-null model columns; the nullable link
        # covers stored missing starts, while this exercises defensive null-end handling.
        result = summarize_turnaround([(self.period.start, None, True)])
        self.assertEqual(
            result["missing_timestamp_count"],
            1,
        )
        self.assertIsNone(result["mean_hours"])

    def test_turnaround_uses_decision_period_and_exclusive_edges(self):
        for when in (
            self.period.start - timedelta(microseconds=1),
            self.period.start,
            self.period.end - timedelta(microseconds=1),
            self.period.end,
        ):
            application = self.make_application()
            submission = self.make_submission(
                application,
                when - timedelta(days=20),
            )
            self.make_decision(
                application,
                when,
                "approved",
                submission,
            )
        result = ApplicationProcessingAnalyticsService.review_turnaround(self.period)
        self.assertEqual(
            result["sample_count"],
            2,
        )
        self.assertEqual(
            result["mean_hours"],
            480,
        )

    def test_rejection_sections_deduplicate_decisions_and_applications_independently(self):
        application = self.make_application()
        first = self.make_decision(
            application,
            self.period.start,
        )
        second = self.make_decision(
            application,
            self.period.start + timedelta(days=1),
        )
        self.feedback(
            first,
            "identity",
        )
        self.feedback(
            first,
            "identity",
        )
        self.feedback(
            first,
            "photos",
        )
        self.feedback(
            second,
            "identity",
        )
        self.make_decision(
            self.make_application(),
            self.period.start,
        )
        approved = self.make_decision(
            self.make_application(),
            self.period.start,
            "approved",
        )
        self.feedback(
            approved,
            "identity",
        )
        result = ApplicationProcessingAnalyticsService.rejection_insights(self.period)
        rows = {row["section"]: row for row in result["sections"]}
        self.assertEqual(
            result["rejected_decisions"],
            3,
        )
        self.assertEqual(
            result["distinct_applications"],
            2,
        )
        self.assertEqual(
            result["decisions_without_section_feedback"],
            1,
        )
        self.assertEqual(
            rows["identity"]["rejection_decisions"],
            2,
        )
        self.assertEqual(
            rows["identity"]["distinct_applications"],
            1,
        )
        self.assertEqual(
            rows["identity"]["decision_share_percentage"],
            66.67,
        )
        self.assertEqual(
            rows["identity"]["application_share_percentage"],
            50,
        )
        self.assertEqual(
            rows["photos"]["rejection_decisions"],
            1,
        )
        self.assertEqual(
            rows["location"]["rejection_decisions"],
            0,
        )

    def test_unknown_sections_are_disclosed_without_inventing_a_category(self):
        review = self.make_decision(
            self.make_application(),
            self.period.start,
        )
        self.feedback(
            review,
            "unknown_legacy_section",
        )
        result = ApplicationProcessingAnalyticsService.rejection_insights(self.period)
        self.assertEqual(
            result["decisions_with_unrecognized_section"],
            1,
        )
        self.assertEqual(
            result["decisions_without_section_feedback"],
            1,
        )
        self.assertEqual(
            len(result["sections"]),
            len(MerchantApplicationFeedback.Section.values),
        )

    def test_rejection_edges_are_half_open_and_query_count_is_bounded(self):
        for when in (self.period.start, self.period.end):
            review = self.make_decision(
                self.make_application(),
                when,
            )
            self.feedback(
                review,
                "documents",
            )
        with self.assertNumQueries(4):
            result = ApplicationProcessingAnalyticsService.get_report(self.period)
        self.assertEqual(
            result["rejection_insights"]["rejected_decisions"],
            1,
        )

    def test_multiple_sections_share_the_same_decision_denominator(self):
        review = self.make_decision(
            self.make_application(),
            self.period.start,
        )
        self.feedback(
            review,
            "identity",
        )
        self.feedback(
            review,
            "photos",
        )
        report = ApplicationProcessingAnalyticsService.rejection_insights(self.period)
        shares = [
            row["decision_share_percentage"]
            for row in report["sections"]
            if row["rejection_decisions"]
        ]
        self.assertEqual(
            shares,
            [100, 100],
        )
        self.assertEqual(
            report["rejected_decisions"],
            1,
        )
