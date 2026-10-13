"""Current queue boundaries and recorded completed-dispute turnaround."""

from datetime import UTC, datetime, timedelta

from django.contrib.gis.geos import Point
from django.test import TestCase

from apps.admin_operations.analytics.services.attention_queue_service import AttentionQueueService
from apps.business.models import Business, Category, Cluster, Location
from apps.review_disputes.models import MerchantReviewDispute
from apps.reviews.models import Review, ReviewReport
from apps.shared.analytics.date_ranges import resolve_period
from apps.users.models import User


class OperationsFixtures:
    NOW = datetime(2026, 10, 12, 4, 30, tzinfo=UTC)

    @classmethod
    def setUpTestData(cls):
        cls.period = resolve_period(now=cls.NOW)
        cls.owner = User.objects.create_user(
            email="operations-owner@example.com", password=None,
            USER_ROLE=User.UserRole.MERCHANT, USER_STATUS=User.UserStatus.ACTIVE,
            USER_FNAME="Operations", USER_LNAME="Owner",
        )
        cls.explorer = User.objects.create_user(
            email="operations-explorer@example.com", password=None,
            USER_ROLE=User.UserRole.EXPLORER, USER_STATUS=User.UserStatus.ACTIVE,
            USER_FNAME="Operations", USER_LNAME="Explorer",
        )
        cluster = Cluster.objects.create(CLUS_NAME="Operations cluster")
        category = Category.objects.create(CTGRY_NAME="Operations category", CLUS_ID=cluster)
        location = Location.objects.create(LOCT_POINT=Point(123.88, 10.31), LOCT_ADDRESS="Cebu")
        cls.business = Business.objects.create(
            BUSN_NAME="Operations business", BUSN_CONTACT_NUMBER="09170000000",
            USER_ID=cls.owner, CTGRY_ID=category, LOCT_ID=location,
        )

    def review(self):
        reviewer = User.objects.create_user(
            email=f"operations-reviewer-{Review.objects.count()}@example.com", password=None,
            USER_ROLE=User.UserRole.EXPLORER, USER_STATUS=User.UserStatus.ACTIVE,
            USER_FNAME="Review", USER_LNAME="Author",
        )
        return Review.objects.create(USER_ID=reviewer, BUSN_ID=self.business, REVW_TEXT="Review")

    def report(self, age, status=ReviewReport.ReportStatus.PENDING):
        report = ReviewReport.objects.create(
            REVW_ID=self.review(), USER_ID=self.explorer, RREP_TYPE=ReviewReport.ReportType.SPAM,
            RREP_STATUS=status,
        )
        ReviewReport.objects.filter(pk=report.pk).update(RREP_CREATED_AT=self.NOW - age)
        return report

    def dispute(self, age, status=MerchantReviewDispute.DisputeStatus.PENDING, resolved_at=None):
        dispute = MerchantReviewDispute.objects.create(
            REVW_ID=self.review(), BUSN_ID=self.business, USER_ID=self.owner,
            MRDSP_REASON=MerchantReviewDispute.DisputeReason.OTHER, MRDSP_DESCRIPTION="Investigate",
            MRDSP_STATUS=status, MRDSP_RESOLVED_AT=resolved_at,
        )
        MerchantReviewDispute.objects.filter(pk=dispute.pk).update(MRDSP_CREATED_AT=self.NOW - age)
        return dispute


class AttentionQueueServiceTests(OperationsFixtures, TestCase):
    def test_empty_queues_and_no_completed_disputes(self):
        result = AttentionQueueService.get_report(self.period)
        self.assertEqual(result["open_reports"]["total"], 0)
        self.assertEqual(result["open_disputes"]["total"], 0)
        self.assertIsNone(result["completed_dispute_turnaround"]["median_hours"])
        self.assertEqual(result["completed_dispute_turnaround"]["sample_count"], 0)
        self.assertFalse(result["queue_meta"]["history_available"])
        self.assertIn("queue_history_unavailable", result["meta"]["partial_reasons"])

    def test_exact_age_edges_cover_both_queues_without_a_gap(self):
        ages = (
            timedelta(0), timedelta(hours=24) - timedelta(microseconds=1),
            timedelta(hours=24), timedelta(hours=48),
            timedelta(hours=72) - timedelta(microseconds=1), timedelta(hours=72),
            timedelta(days=60), timedelta(hours=-1),
        )
        for age in ages:
            self.report(age)
            self.dispute(age)
        result = AttentionQueueService.get_report(self.period)
        for key in ("open_reports", "open_disputes"):
            self.assertEqual(result[key], {
                "total": 8, "under_1_day": 2, "days_1_to_2": 3,
                "days_3_plus": 2, "unknown_age": 1,
            })

    def test_resolved_and_withdrawn_records_do_not_enter_pending_counts(self):
        for status in ReviewReport.ReportStatus.values:
            self.report(timedelta(hours=2), status)
        for status in MerchantReviewDispute.DisputeStatus.values:
            self.dispute(timedelta(hours=2), status, self.NOW - timedelta(hours=1))
        result = AttentionQueueService.get_report(self.period)
        self.assertEqual(result["open_reports"]["total"], 1)
        self.assertEqual(result["open_disputes"]["total"], 1)
        self.assertEqual(result["completed_dispute_turnaround"]["sample_count"], 2)

    def test_median_counts_completed_statuses_and_retains_zero_duration(self):
        resolved = self.NOW - timedelta(hours=1)
        for hours, status in ((0, "upheld"), (2, "dismissed"), (10, "upheld")):
            self.dispute(timedelta(hours=hours + 1), status, resolved)
        self.dispute(timedelta(days=10), "withdrawn", resolved)
        self.dispute(timedelta(days=10), "pending", resolved)
        result = AttentionQueueService.completed_turnaround(self.period)
        self.assertEqual(result["sample_count"], 3)
        self.assertEqual(result["median_hours"], 2)

    def test_resolution_period_is_half_open_and_does_not_filter_old_backlog(self):
        for timestamp in (
            self.period.start - timedelta(microseconds=1), self.period.start,
            self.period.end - timedelta(microseconds=1), self.period.end,
        ):
            self.dispute(self.NOW - timestamp + timedelta(hours=1), "upheld", timestamp)
        self.dispute(timedelta(days=100))
        result = AttentionQueueService.get_report(self.period)
        self.assertEqual(result["completed_dispute_turnaround"]["sample_count"], 2)
        self.assertEqual(result["open_disputes"]["days_3_plus"], 1)

    def test_even_sample_median_averages_the_middle_durations(self):
        resolved = self.NOW - timedelta(hours=1)
        self.dispute(timedelta(hours=3), "upheld", resolved)
        self.dispute(timedelta(hours=7), "dismissed", resolved)
        result = AttentionQueueService.completed_turnaround(self.period)
        self.assertEqual(result["median_hours"], 4)
        self.assertEqual(result["sample_count"], 2)

    def test_missing_and_negative_resolution_times_are_disclosed(self):
        self.dispute(timedelta(hours=1), "upheld", self.NOW - timedelta(hours=2))
        self.dispute(timedelta(hours=1), "dismissed")
        result = AttentionQueueService.get_report(self.period)
        metric = result["completed_dispute_turnaround"]
        self.assertIsNone(metric["median_hours"])
        self.assertEqual(metric["sample_count"], 0)
        self.assertEqual(metric["excluded_invalid_duration_count"], 1)
        self.assertEqual(metric["missing_resolution_timestamp_count"], 1)
        self.assertIn("completed_dispute_timestamp_anomalies", result["meta"]["partial_reasons"])
