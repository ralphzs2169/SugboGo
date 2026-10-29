"""Listing-change backlog aging, terminal outcomes and pooled administrator durations."""

from datetime import timedelta

from django.test import TestCase

from apps.admin_operations.analytics.services.change_request_analytics_service import (
    ChangeRequestAnalyticsService,
)

from .reporting_fixtures import ReportingFixtures


class ChangeRequestAnalyticsServiceTests(ReportingFixtures, TestCase):
    def request(
        self,
        request_type="name",
        status="pending",
        submitted_at=None,
        resolved_at=None,
    ):
        business = self.make_business()
        if submitted_at is None:
            submitted_at = self.NOW - timedelta(hours=1)
        definitions = {
            name: (model, prefix)
            for name, label, model, prefix in ChangeRequestAnalyticsService.REQUEST_TYPES
        }
        model, prefix = definitions[request_type]
        fields = {
            "BUSN_ID": business,
            "USER_ID": business.USER_ID,
            f"{prefix}_STATUS": status,
            f"{prefix}_SUBMITTED_AT": submitted_at,
            f"{prefix}_RESOLVED_AT": resolved_at,
        }
        if request_type == "name":
            fields["BNCR_PREVIOUS_BUSINESS_NAME"] = "Previous name"
            fields["BNCR_PROPOSED_BUSINESS_NAME"] = "Proposed name"
        elif request_type == "classification":
            fields.update({
                "PREVIOUS_CTGRY_ID": business.CTGRY_ID,
                "PROPOSED_CTGRY_ID": business.CTGRY_ID,
                "BCCR_PREVIOUS_CLUSTER_ID": business.CTGRY_ID.CLUS_ID_id,
                "BCCR_PROPOSED_CLUSTER_ID": business.CTGRY_ID.CLUS_ID_id,
            })
        else:
            fields.update({
                "BLCR_PREVIOUS_LOCT_ID": business.LOCT_ID_id,
                "BLCR_PREVIOUS_POINT": business.LOCT_ID.LOCT_POINT,
                "BLCR_PROPOSED_POINT": business.LOCT_ID.LOCT_POINT,
            })
        return model.objects.create(**fields)

    def test_empty_requests_have_zero_backlog_and_null_duration(self):
        report = ChangeRequestAnalyticsService.get_report(self.period)
        self.assertEqual(
            report["backlog"]["total"],
            0,
        )
        self.assertEqual(
            report["period_outcomes"],
            {"approved": 0, "rejected": 0, "withdrawn": 0},
        )
        self.assertIsNone(report["turnaround"]["median_hours"])
        self.assertEqual(
            len(report["types"]),
            3,
        )

    def test_all_request_types_use_exact_24_and_72_hour_aging_boundaries(self):
        for request_type in ("name", "classification", "location"):
            for age in (
                timedelta(
                    hours=23,
                    minutes=59,
                ),
                timedelta(hours=24),
                timedelta(
                    hours=71,
                    minutes=59,
                ),
                timedelta(hours=72),
                timedelta(hours=-1),
            ):
                self.request(
                    request_type,
                    submitted_at=self.NOW - age,
                )
        with self.assertNumQueries(9):
            report = ChangeRequestAnalyticsService.get_report(self.period)
        self.assertEqual(report["backlog"], {
            "total": 15,
            "under_1_day": 3,
            "days_1_to_2": 6,
            "days_3_plus": 3,
            "unknown_age": 3,
        })
        self.assertTrue(all(row["backlog"]["total"] == 5 for row in report["types"]))
        self.assertFalse(report["backlog_meta"]["selected_period_applies"])

    def test_withdrawals_are_outcomes_but_never_administrator_turnaround(self):
        resolved = self.period.start + timedelta(hours=2)
        for request_type in ("name", "classification", "location"):
            for status in ("approved", "rejected", "withdrawn"):
                self.request(
                    request_type,
                    status,
                    submitted_at=resolved - timedelta(hours=1),
                    resolved_at=resolved,
                )
        report = ChangeRequestAnalyticsService.get_report(self.period)
        self.assertEqual(
            report["period_outcomes"],
            {"approved": 3, "rejected": 3, "withdrawn": 3},
        )
        self.assertEqual(
            report["backlog"]["total"],
            0,
        )
        self.assertEqual(
            report["turnaround"]["sample_count"],
            6,
        )
        self.assertEqual(
            report["turnaround"]["median_hours"],
            1,
        )

    def test_pooled_mean_and_median_use_individual_samples_not_type_medians(self):
        resolved = self.period.start + timedelta(days=1)
        for request_type, hours in (("name", 1), ("name", 3), ("classification", 10)):
            self.request(
                request_type,
                "approved",
                submitted_at=resolved - timedelta(hours=hours),
                resolved_at=resolved,
            )
        report = ChangeRequestAnalyticsService.get_report(self.period)
        self.assertEqual(
            report["turnaround"]["sample_count"],
            3,
        )
        self.assertEqual(
            report["turnaround"]["median_hours"],
            3,
        )
        self.assertEqual(
            report["turnaround"]["mean_hours"],
            4.67,
        )

    def test_missing_resolution_is_globally_disclosed_and_negative_duration_excluded(self):
        resolved = self.period.start + timedelta(hours=2)
        self.request(
            "name",
            "approved",
            resolved_at=None,
        )
        self.request(
            "classification",
            "withdrawn",
            resolved_at=None,
        )
        self.request(
            "location",
            "rejected",
            submitted_at=resolved + timedelta(hours=1),
            resolved_at=resolved,
        )
        report = ChangeRequestAnalyticsService.get_report(self.period)
        self.assertEqual(
            report["missing_resolution_timestamp_count"],
            2,
        )
        self.assertEqual(
            report["period_outcomes"]["approved"],
            0,
        )
        self.assertEqual(
            report["period_outcomes"]["rejected"],
            1,
        )
        self.assertEqual(
            report["turnaround"]["invalid_chronology_count"],
            1,
        )
        self.assertEqual(
            report["turnaround"]["sample_count"],
            0,
        )
        self.assertIsNone(report["turnaround"]["mean_hours"])

    def test_resolution_window_is_half_open_and_does_not_filter_old_backlog(self):
        self.request(submitted_at=self.NOW - timedelta(days=100))
        for resolved in (
            self.period.start - timedelta(microseconds=1),
            self.period.start,
            self.period.end - timedelta(microseconds=1),
            self.period.end,
        ):
            self.request(
                "name",
                "approved",
                submitted_at=resolved,
                resolved_at=resolved,
            )
        report = ChangeRequestAnalyticsService.get_report(self.period)
        self.assertEqual(
            report["period_outcomes"]["approved"],
            2,
        )
        self.assertEqual(
            report["turnaround"]["sample_count"],
            2,
        )
        self.assertEqual(
            report["turnaround"]["mean_hours"],
            0,
        )
        self.assertEqual(
            report["backlog"]["days_3_plus"],
            1,
        )
