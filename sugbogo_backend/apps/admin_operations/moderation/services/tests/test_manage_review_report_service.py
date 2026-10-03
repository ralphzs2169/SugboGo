from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch

from django.db import close_old_connections
from django.test import TestCase, TransactionTestCase
from rest_framework.exceptions import ValidationError

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.moderation.services.manage_review_report_service import ManageReviewReportService
from apps.reviews.models import Review, ReviewReport, BusinessReviewSummary
from apps.reviews.services.tests import test_review_report_service as report_fixtures
from apps.users.models import User, ReputationEvent


class ReportFixtures:
    """Provides existing business fixtures and one pending reported review."""

    def setUp(self):
        report_fixtures.ReviewReportServiceTests.setUpTestData.__func__(type(self))
        self.admin = User.objects.create_user(
            email="report-admin@example.com", password=None,
            USER_FNAME="Admin", USER_LNAME="Moderator",
            USER_ROLE=User.UserRole.ADMIN, USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.review = Review.objects.create(
            USER_ID=self.second_user, BUSN_ID=self.business,
            REVW_TEXT="Friendly staff", REVW_SENTIMENT_LABEL="positive",
            REVW_SENTIMENT_SCORE=0.75,
        )
        self.report = ReviewReport.objects.create(
            USER_ID=self.user, REVW_ID=self.review, RREP_TYPE="abuse",
            RREP_DEVICE_ID="private-device",
        )

    def resolve(self, report=None, approve=True):
        return ManageReviewReportService.resolve(
            (report or self.report).pk, actor=self.admin,
            admin_notes="Evidence inspected and decision recorded.", approve=approve,
        )


class ManageReviewReportServiceTests(ReportFixtures, TestCase):
    def test_approval_rejects_review_refreshes_insights_and_audits(self):
        summary = BusinessReviewSummary.objects.create(
            BUSN_ID=self.business, BRSU_POSITIVE_COUNT=1,
            BRSU_REVIEW_COUNT=1, BRSU_CLASSIFIED_REVIEW_COUNT=1,
            BRSU_NARRATIVE="Visitors mention friendly staff.",
            BRSU_SUPPORTING_REVIEW_REFERENCES={"narrative_review_ids": [self.review.pk]},
            BRSU_GENERATION_STATE="ready",
        )
        with patch("apps.reviews.tasks.refresh_business_review_insights.delay") as enqueue:
            with self.captureOnCommitCallbacks(execute=True):
                self.resolve()
                enqueue.assert_not_called()
            enqueue.assert_called_once_with(self.business.pk)
        self.review.refresh_from_db()
        self.report.refresh_from_db()
        summary.refresh_from_db()
        self.assertEqual(self.review.REVW_STATUS, "rejected")
        self.assertEqual(self.report.RREP_STATUS, "approved")
        self.assertEqual(summary.BRSU_POSITIVE_COUNT, 0)
        self.assertEqual(summary.BRSU_NARRATIVE, "")
        self.assertEqual(ReputationEvent.objects.count(), 2)
        event = AdminActivity.objects.get()
        self.assertEqual(event.ACTOR_ID_id, self.admin.pk)
        self.assertEqual(event.AACT_CONTEXT["previous_review_status"], "published")
        self.assertEqual(event.AACT_CONTEXT["report_status"], "approved")

    def test_rejection_preserves_flagged_review_without_reputation_or_refresh(self):
        self.review.REVW_IS_SPAM_FLAGGED = True
        self.review.save()
        with patch("apps.reviews.tasks.refresh_business_review_insights.delay") as enqueue:
            with self.captureOnCommitCallbacks(execute=True):
                self.resolve(approve=False)
            enqueue.assert_not_called()
        self.review.refresh_from_db()
        self.assertTrue(self.review.REVW_IS_SPAM_FLAGGED)
        self.assertEqual(self.review.REVW_STATUS, "published")
        self.assertFalse(ReputationEvent.objects.exists())
        self.assertEqual(AdminActivity.objects.get().AACT_ACTION, "review_report_rejected")

    def test_repeated_resolution_has_no_duplicate_effects(self):
        self.resolve()
        with self.assertRaises(ValidationError):
            self.resolve(approve=False)
        self.assertEqual(AdminActivity.objects.count(), 1)
        self.assertEqual(ReputationEvent.objects.count(), 2)

    def test_related_reports_remain_pending_and_author_penalty_is_once_per_review(self):
        sibling = ReviewReport.objects.create(
            USER_ID=self.admin, REVW_ID=self.review, RREP_TYPE="spam",
        )
        self.resolve()
        sibling.refresh_from_db()
        self.assertEqual(sibling.RREP_STATUS, "pending")
        self.resolve(sibling)
        self.assertEqual(ReputationEvent.objects.filter(
            REVT_EVENT_TYPE=ReputationEvent.EventType.CONFIRMED_VIOLATION_PENALTY,
        ).count(), 1)
        self.assertEqual(ReputationEvent.objects.count(), 3)

    def test_self_report_does_not_reward_author(self):
        self.report.USER_ID = self.second_user
        self.report.save()
        self.resolve()
        self.assertEqual(ReputationEvent.objects.count(), 1)

    def test_audit_failure_rolls_back_all_effects_and_task(self):
        with (
            patch("apps.reviews.tasks.refresh_business_review_insights.delay") as enqueue,
            patch("apps.admin_operations.moderation.services.manage_review_report_service.AdminActivityService.record_user_action", side_effect=RuntimeError("Audit failed")),
        ):
            with self.captureOnCommitCallbacks(execute=True):
                with self.assertRaises(RuntimeError):
                    self.resolve()
            enqueue.assert_not_called()
        self.report.refresh_from_db()
        self.review.refresh_from_db()
        self.assertEqual(self.report.RREP_STATUS, "pending")
        self.assertEqual(self.review.REVW_STATUS, "published")
        self.assertFalse(ReputationEvent.objects.exists())


class ConcurrentReviewReportTests(ReportFixtures, TransactionTestCase):
    def test_concurrent_sibling_approvals_penalize_author_once(self):
        sibling = ReviewReport.objects.create(
            USER_ID=self.admin, REVW_ID=self.review, RREP_TYPE="spam",
        )
        barrier = Barrier(2)

        def approve(report):
            close_old_connections()
            try:
                barrier.wait(timeout=5)
                self.resolve(report)
            finally:
                close_old_connections()

        with patch("apps.reviews.tasks.refresh_business_review_insights.delay"):
            with ThreadPoolExecutor(max_workers=2) as pool:
                futures = [pool.submit(approve, report) for report in (self.report, sibling)]
                for future in futures:
                    future.result(timeout=15)
        self.assertEqual(AdminActivity.objects.count(), 2)
        self.assertEqual(ReputationEvent.objects.count(), 3)
        self.assertEqual(ReputationEvent.objects.filter(
            REVT_EVENT_TYPE=ReputationEvent.EventType.CONFIRMED_VIOLATION_PENALTY,
        ).count(), 1)

    def test_competing_decisions_resolve_once(self):
        barrier = Barrier(2)

        def decide(approve):
            close_old_connections()
            try:
                barrier.wait(timeout=5)
                try:
                    self.resolve(approve=approve)
                    return "resolved"
                except ValidationError:
                    return "rejected"
            finally:
                close_old_connections()

        with patch("apps.reviews.tasks.refresh_business_review_insights.delay"):
            with ThreadPoolExecutor(max_workers=2) as pool:
                futures = [pool.submit(decide, value) for value in (True, False)]
                outcomes = [future.result(timeout=15) for future in futures]
        self.assertCountEqual(outcomes, ["resolved", "rejected"])
        self.assertEqual(AdminActivity.objects.count(), 1)
