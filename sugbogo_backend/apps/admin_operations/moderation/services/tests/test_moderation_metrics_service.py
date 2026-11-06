"""Coverage for queue scope, recorded ages, and local-day resolution counts."""

from datetime import datetime, timedelta, timezone as datetime_timezone
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.moderation.services.manage_under_review_service import (
    ManageUnderReviewService,
)
from apps.admin_operations.moderation.services.manage_review_dispute_service import (
    ManageReviewDisputeService,
)
from apps.admin_operations.moderation.services.moderation_metrics_service import (
    ModerationMetricsService,
    filter_aging_cases,
)
from apps.admin_operations.moderation.services.reported_review_service import (
    ReportedReviewService,
)
from apps.admin_operations.moderation.services.tests.test_manage_under_review_service import (
    create_under_review_context,
)
from apps.business.models import BusinessVouch, SpecialtyTag
from apps.business.services.vouch_service import VouchService
from apps.review_disputes.models import MerchantReviewDispute
from apps.reviews.models import Review, ReviewReport
from apps.users.models import User


class ModerationMetricsServiceTests(TestCase):
    """Keep summary cards and aging filters aligned with moderation cases."""

    @classmethod
    def setUpTestData(cls):
        """Create shared display identities without triggering moderation tasks."""
        cls.owner, cls.author, cls.business = create_under_review_context()

    def setUp(self):
        """Freeze a time after Manila midnight and before UTC midnight."""
        self.now = datetime(2026, 11, 5, 17, 0, tzinfo=datetime_timezone.utc)
        self.clock = patch(
            "apps.admin_operations.moderation.services.moderation_metrics_service.timezone.now",
            return_value=self.now,
        )
        self.clock.start()
        self.addCleanup(self.clock.stop)

    def review(
        self,
        age_hours,
        status=Review.ReviewStatus.UNDER_REVIEW,
        **extra,
    ):
        """Create an independent author and explicitly date the review."""
        author = User.objects.create(
            USER_EMAIL=f"metric-author-{User.objects.count()}@example.com",
            USER_FNAME="Metric",
            USER_LNAME="Author",
            password="!",
        )
        review = Review.objects.create(
            USER_ID=author,
            BUSN_ID=self.business,
            REVW_TEXT="Review used for queue metrics.",
            REVW_STATUS=status,
            **extra,
        )
        Review.objects.filter(pk=review.pk).update(
            REVW_CREATED_AT=self.now - timedelta(hours=age_hours),
        )
        return review

    def test_hold_age_survives_retries_and_includes_48_hour_boundary(self):
        """Count only held reviews using their initial publication-hold entry."""
        oldest = self.review(
            49,
            REVW_MODERATION_DATA={"checked_at": self.now.isoformat()},
        )
        boundary = self.review(48)
        self.review(47)
        self.review(90, status=Review.ReviewStatus.PUBLISHED)

        summary = ModerationMetricsService.get_summary("under-review")
        self.assertEqual(summary["pending"], 3)
        self.assertEqual(summary["aging_cases"], 2)
        self.assertEqual(summary["oldest_pending"]["id"], oldest.pk)
        self.assertEqual(summary["oldest_pending"]["seconds"], 49 * 3600)
        self.assertSetEqual(
            set(
                ManageUnderReviewService.list_reviews({"aging": True})
                .values_list(
                    "pk",
                    flat=True,
                ),
            ),
            {oldest.pk, boundary.pk},
        )

    def test_reported_metrics_group_siblings_and_use_pending_report_time(self):
        """An old review with a recent report has only a recent queue age."""
        recent = self.review(2000, status=Review.ReviewStatus.PUBLISHED)
        oldest = self.review(2000, status=Review.ReviewStatus.PUBLISHED)
        for review, reporter, hours in [
            (recent, self.owner, 1),
            (oldest, self.owner, 49),
            (oldest, self.author, 2),
        ]:
            report = ReviewReport.objects.create(
                REVW_ID=review,
                USER_ID=reporter,
                RREP_TYPE=ReviewReport.ReportType.SPAM,
            )
            ReviewReport.objects.filter(pk=report.pk).update(
                RREP_CREATED_AT=self.now - timedelta(hours=hours),
            )
        summary = ModerationMetricsService.get_summary("reported")
        self.assertEqual(summary["pending"], 2)
        self.assertEqual(summary["aging_cases"], 1)
        self.assertEqual(summary["oldest_pending"]["id"], oldest.pk)
        self.assertEqual(
            list(
                ReportedReviewService.list_reviews({"aging": True})
                .values_list(
                    "pk",
                    flat=True,
                ),
            ),
            [oldest.pk],
        )

    def test_daily_decisions_use_manila_midnight_and_distinct_review_cases(self):
        """Repeated audit events do not multiply cases or use UTC midnight."""
        actions = [
            (1, 30),
            (1, 20),
            (2, 10),
            (3, 61),
            (4, -1),
        ]
        for review_id, minutes_ago in actions:
            activity = AdminActivity.objects.create(
                ACTOR_ID=self.owner,
                TARGET_USER_ID=self.author,
                AACT_ACTION=AdminActivity.Action.REVIEW_MODERATION_APPROVED,
                AACT_CONTEXT={"review_id": review_id},
            )
            AdminActivity.objects.filter(pk=activity.pk).update(
                AACT_CREATED_AT=self.now - timedelta(minutes=minutes_ago),
            )
        summary = ModerationMetricsService.get_summary("under-review")
        self.assertEqual(summary["resolved_today"], 2)
        self.assertEqual(summary["time_zone"], "Asia/Manila")

    def test_suspicious_uses_detection_time_and_combines_reviews_and_vouches(self):
        """Missing detection timestamps stay unknown instead of using creation time."""
        self.review(
            2000,
            status=Review.ReviewStatus.PUBLISHED,
            REVW_RELIABILITY_REASONS=[Review.ReliabilityReason.RAPID_SUBMISSION],
            REVW_RELIABILITY_EVIDENCE={
                Review.ReliabilityReason.RAPID_SUBMISSION: {
                    "observed_at": (self.now - timedelta(hours=1)).isoformat(),
                },
            },
        )
        self.review(
            2000,
            status=Review.ReviewStatus.PUBLISHED,
            REVW_RELIABILITY_REASONS=[Review.ReliabilityReason.RAPID_SUBMISSION],
        )
        tag = SpecialtyTag.objects.create(TAG_NAME="Metric specialty")
        vouch = BusinessVouch.objects.create(
            USER_ID=self.author,
            BUSN_ID=self.business,
            TAG_ID=tag,
            VOUCH_REPUTATION_SNAPSHOT=Decimal("0.5"),
            VOUCH_FLAG_SUSPICIOUS=True,
            VOUCH_RELIABILITY_EVIDENCE={
                VouchService.CONCENTRATION_REASON: {
                    "observed_at": (self.now - timedelta(hours=50)).isoformat(),
                },
            },
        )
        summary = ModerationMetricsService.get_summary("suspicious")
        self.assertEqual(summary["pending"], 3)
        self.assertEqual(summary["aging_cases"], 1)
        self.assertEqual(summary["unknown_age_count"], 1)
        self.assertEqual(summary["oldest_pending"]["queue"], "suspicious-vouches")
        self.assertEqual(summary["oldest_pending"]["id"], vouch.pk)
        self.assertIsNone(summary["resolved_today"])
        self.assertEqual(
            filter_aging_cases(
                BusinessVouch.objects.all(),
                "suspicious-vouches",
            ).count(),
            1,
        )

    def test_disputes_exclude_withdrawals_from_daily_human_decisions(self):
        """Pending age and resolved totals refer to dispute cases, not reviews."""
        review = self.review(100, status=Review.ReviewStatus.PUBLISHED)
        for status in ["upheld", "dismissed", "withdrawn", "pending"]:
            dispute = MerchantReviewDispute.objects.create(
                REVW_ID=review,
                USER_ID=self.owner,
                BUSN_ID=self.business,
                MRDSP_ORIGINAL_REVIEW_ID=review.pk,
                MRDSP_ORIGINAL_BUSINESS_ID=self.business.pk,
                MRDSP_ORIGINAL_MERCHANT_ID=self.owner.pk,
                MRDSP_REASON=MerchantReviewDispute.DisputeReason.OTHER,
                MRDSP_DESCRIPTION="Dispute metrics test.",
                MRDSP_STATUS=status,
                MRDSP_RESOLVED_AT=None if status == "pending" else self.now,
            )
            MerchantReviewDispute.objects.filter(pk=dispute.pk).update(
                MRDSP_CREATED_AT=self.now - timedelta(hours=49),
            )
        summary = ModerationMetricsService.get_summary("disputes")
        self.assertEqual(summary["pending"], 1)
        self.assertEqual(summary["aging_cases"], 1)
        self.assertEqual(summary["resolved_today"], 2)
        self.assertEqual(
            ManageReviewDisputeService.list_disputes(
                status="pending",
                aging=True,
            ).count(),
            1,
        )
        self.assertEqual(
            ManageReviewDisputeService.list_disputes(
                status="upheld",
                aging=True,
            ).count(),
            0,
        )

    def test_empty_queue_has_zero_counts_and_no_oldest_case(self):
        """An empty queue does not invent a waiting time."""
        summary = ModerationMetricsService.get_summary("under-review")
        self.assertEqual(summary["pending"], 0)
        self.assertEqual(summary["aging_cases"], 0)
        self.assertEqual(summary["resolved_today"], 0)
        self.assertIsNone(summary["oldest_pending"])
