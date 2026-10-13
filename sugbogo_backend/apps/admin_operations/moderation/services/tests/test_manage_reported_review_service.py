"""Focused review-level community-report decision tests."""

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch

from django.db import close_old_connections
from django.test import TestCase, TransactionTestCase
from rest_framework.exceptions import ValidationError

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.moderation.services.manage_reported_review_service import (
    ManageReportedReviewService,
)
from apps.admin_operations.moderation.services.reported_review_service import (
    ReportedReviewService,
)
from apps.admin_operations.moderation.services.tests.test_manage_review_report_service import (
    ReportFixtures,
)
from apps.business.models import Business
from apps.notifications.models import Notification
from apps.reviews.models import Review, ReviewReport
from apps.users.models import ReputationEvent, User


class ManageReportedReviewServiceTests(ReportFixtures, TestCase):
    def decide(self, decision):
        return ManageReportedReviewService.resolve(
            self.review.pk,
            actor=self.admin,
            decision=decision,
            admin_notes="Review content and community reports inspected.",
        )

    def test_keep_dismisses_all_pending_reports_without_changing_review(self):
        self.add_pending_reports(2)
        self.assertTrue(self.review.REVW_IS_REPORT_FLAGGED)
        Business.objects.filter(pk=self.business.pk).update(BUSN_REVIEW_COUNT=1)

        with patch("apps.reviews.tasks.refresh_business_review_insights.delay") as enqueue:
            result = self.decide("keep")
            enqueue.assert_not_called()

        self.review.refresh_from_db()
        self.business.refresh_from_db()
        self.assertEqual(result["resolved_report_count"], 3)
        self.assertEqual(self.review.REVW_STATUS, Review.ReviewStatus.PUBLISHED)
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, 1)
        self.assertFalse(self.review.REVW_IS_REPORT_FLAGGED)
        self.assertEqual(
            ReviewReport.objects.filter(RREP_STATUS=ReviewReport.ReportStatus.REJECTED).count(),
            3,
        )
        self.assertFalse(ReputationEvent.objects.exists())
        self.assertFalse(ReportedReviewService.queryset().exists())
        self.assertEqual(AdminActivity.objects.get().AACT_ACTION, "reported_review_kept")
        self.assertEqual(Notification.objects.filter(NOTF_TYPE="review_report_rejected").count(), 3)

    def test_decision_notes_do_not_replace_reporter_explanation(self):
        ReviewReport.objects.filter(pk=self.report.pk).update(
            RREP_EXPLANATION="The review contains private contact details.",
        )

        self.decide("keep")

        self.report.refresh_from_db()
        self.assertEqual(
            self.report.RREP_EXPLANATION,
            "The review contains private contact details.",
        )
        self.assertEqual(
            self.report.RREP_NOTES,
            "Review content and community reports inspected.",
        )

    def test_reject_confirms_all_pending_with_one_review_rejection(self):
        self.add_pending_reports(2)
        Business.objects.filter(pk=self.business.pk).update(BUSN_REVIEW_COUNT=1)

        with patch("apps.reviews.tasks.refresh_business_review_insights.delay") as enqueue:
            with self.captureOnCommitCallbacks(execute=True):
                result = self.decide("reject")
            enqueue.assert_called_once_with(self.business.pk)

        self.review.refresh_from_db()
        self.business.refresh_from_db()
        self.assertEqual(result["resolved_report_count"], 3)
        self.assertEqual(self.review.REVW_STATUS, Review.ReviewStatus.REJECTED)
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, 0)
        self.assertEqual(
            ReviewReport.objects.filter(RREP_STATUS=ReviewReport.ReportStatus.APPROVED).count(),
            3,
        )
        self.assertFalse(ReportedReviewService.queryset().exists())
        self.assertEqual(AdminActivity.objects.get().AACT_ACTION, "reported_review_rejected")
        self.assertEqual(Notification.objects.filter(NOTF_TYPE="review_rejected").count(), 1)
        self.assertEqual(Notification.objects.filter(NOTF_TYPE="review_report_approved").count(), 3)
        self.assertEqual(
            ReputationEvent.objects.filter(
                REVT_EVENT_TYPE=ReputationEvent.EventType.CONFIRMED_VIOLATION_PENALTY,
            ).count(),
            1,
        )

    def test_only_pending_reports_transition_and_history_remains(self):
        self.add_pending_reports(2)
        resolved_reporters = [
            User.objects.create_user(
                email=f"resolved-reporter-{index}@example.com",
                password=None,
                USER_FNAME="Resolved",
                USER_LNAME="Reporter",
                USER_ROLE=User.UserRole.EXPLORER,
                USER_STATUS=User.UserStatus.ACTIVE,
            )
            for index in range(2)
        ]
        approved = ReviewReport.objects.create(
            USER_ID=self.admin,
            REVW_ID=self.review,
            RREP_TYPE=ReviewReport.ReportType.SPAM,
            RREP_STATUS=ReviewReport.ReportStatus.APPROVED,
        )
        rejected = ReviewReport.objects.create(
            USER_ID=resolved_reporters[0],
            REVW_ID=self.review,
            RREP_TYPE=ReviewReport.ReportType.ABUSE,
            RREP_STATUS=ReviewReport.ReportStatus.REJECTED,
        )
        withdrawn = ReviewReport.objects.create(
            USER_ID=resolved_reporters[1],
            REVW_ID=self.review,
            RREP_TYPE=ReviewReport.ReportType.OTHER,
            RREP_STATUS=ReviewReport.ReportStatus.WITHDRAWN,
        )

        self.decide("keep")

        for report, status in (
            (approved, ReviewReport.ReportStatus.APPROVED),
            (rejected, ReviewReport.ReportStatus.REJECTED),
            (withdrawn, ReviewReport.ReportStatus.WITHDRAWN),
        ):
            report.refresh_from_db()
            self.assertEqual(report.RREP_STATUS, status)
        self.assertEqual(ReviewReport.objects.filter(REVW_ID=self.review).count(), 6)

    def test_repeated_decision_does_not_duplicate_effects(self):
        self.add_pending_reports(2)
        Business.objects.filter(pk=self.business.pk).update(BUSN_REVIEW_COUNT=1)
        with patch("apps.reviews.tasks.refresh_business_review_insights.delay"):
            self.decide("reject")
            with self.assertRaises(ValidationError):
                self.decide("reject")
            with self.assertRaises(ValidationError):
                self.decide("keep")
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, 0)
        self.assertEqual(AdminActivity.objects.count(), 1)
        self.assertEqual(Notification.objects.filter(NOTF_TYPE="review_rejected").count(), 1)

    def test_legacy_rejected_review_resolves_without_rejection_effects(self):
        self.add_pending_reports(2)
        Review.objects.filter(pk=self.review.pk).update(
            REVW_STATUS=Review.ReviewStatus.REJECTED,
        )
        Business.objects.filter(pk=self.business.pk).update(BUSN_REVIEW_COUNT=1)

        with patch("apps.reviews.tasks.refresh_business_review_insights.delay") as enqueue:
            with self.assertRaises(ValidationError):
                self.decide("keep")
            self.decide("reject")
            enqueue.assert_not_called()

        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, 1)
        self.assertEqual(Notification.objects.filter(NOTF_TYPE="review_rejected").count(), 0)
        self.assertEqual(
            ReputationEvent.objects.filter(
                REVT_EVENT_TYPE=ReputationEvent.EventType.CONFIRMED_VIOLATION_PENALTY,
            ).count(),
            0,
        )
        self.assertFalse(ReportedReviewService.queryset().exists())

    def test_audit_failure_rolls_back_review_and_all_reports(self):
        self.add_pending_reports(2)
        with patch(
            "apps.admin_operations.moderation.services.manage_reported_review_service.AdminActivityService.record_user_action",
            side_effect=RuntimeError("Audit failed"),
        ):
            with self.assertRaises(RuntimeError):
                self.decide("reject")

        self.review.refresh_from_db()
        self.assertEqual(self.review.REVW_STATUS, Review.ReviewStatus.PUBLISHED)
        self.assertEqual(
            ReviewReport.objects.filter(RREP_STATUS=ReviewReport.ReportStatus.PENDING).count(),
            3,
        )
        self.assertFalse(ReputationEvent.objects.exists())


class ConcurrentReportedReviewDecisionTests(ReportFixtures, TransactionTestCase):
    def test_competing_keep_and_reject_resolve_the_group_once(self):
        self.add_pending_reports(2)
        Business.objects.filter(pk=self.business.pk).update(BUSN_REVIEW_COUNT=1)
        barrier = Barrier(2)

        def decide(decision):
            close_old_connections()
            try:
                barrier.wait(timeout=5)
                try:
                    ManageReportedReviewService.resolve(
                        self.review.pk,
                        actor=self.admin,
                        decision=decision,
                        admin_notes="Review and all community reports inspected.",
                    )
                    return "resolved"
                except ValidationError:
                    return "already resolved"
            finally:
                close_old_connections()

        with patch("apps.reviews.tasks.refresh_business_review_insights.delay"):
            with ThreadPoolExecutor(max_workers=2) as pool:
                futures = [
                    pool.submit(decide, decision)
                    for decision in ("keep", "reject")
                ]
                outcomes = [future.result(timeout=20) for future in futures]

        self.assertCountEqual(outcomes, ["resolved", "already resolved"])
        self.assertEqual(AdminActivity.objects.count(), 1)
        self.assertFalse(
            ReviewReport.objects.filter(
                REVW_ID=self.review,
                RREP_STATUS=ReviewReport.ReportStatus.PENDING,
            ).exists()
        )
        self.review.refresh_from_db()
        self.business.refresh_from_db()
        if self.review.REVW_STATUS == Review.ReviewStatus.REJECTED:
            self.assertEqual(self.business.BUSN_REVIEW_COUNT, 0)
        else:
            self.assertEqual(self.business.BUSN_REVIEW_COUNT, 1)
