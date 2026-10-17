from unittest.mock import patch

from django.db import DatabaseError
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.exceptions import NotFound
from rest_framework.test import APIClient

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.moderation.services.manage_review_dispute_service import (
    ManageReviewDisputeService,
)
from apps.admin_operations.moderation.services.manage_review_report_service import (
    ManageReviewReportService,
)
from apps.admin_operations.moderation.services.tests import (
    test_manage_review_dispute_service as dispute_tests,
)
from apps.notifications.models import Notification
from apps.review_disputes.models import MerchantReviewDispute
from apps.reviews.models import Review, ReviewPhoto, ReviewReport
from apps.reviews.services.review_moderation_retry_service import (
    ReviewModerationRetryService,
)
from apps.reviews.services.review_service import ReviewService
from apps.users.models import ReputationEvent, User


class ReviewDeletionAuditTests(TestCase):
    """Verify retained author-removal history without retaining deleted content."""

    create_dispute = dispute_tests.ManageReviewDisputeServiceTests.create_dispute

    def setUp(self):
        dispute_tests.ManageReviewDisputeServiceTests.setUp(self)
        self.business.BUSN_REVIEW_COUNT = 1
        self.business.save(update_fields=["BUSN_REVIEW_COUNT"])
        self.client = APIClient()

    def _report(
        self,
        status=ReviewReport.ReportStatus.PENDING,
    ):
        reporter = User.objects.create_user(
            email=f"deletion-reporter-{ReviewReport.objects.count()}@example.com",
            password=None,
            USER_FNAME="Reporter",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        return ReviewReport.objects.create(
            REVW_ID=self.review,
            USER_ID=reporter,
            RREP_TYPE=ReviewReport.ReportType.ABUSE,
            RREP_STATUS=status,
            RREP_EXPLANATION="Private reporter explanation.",
            RREP_INSTALLATION_ID="private-reporter-installation",
        )

    def _delete(self):
        before = timezone.now()
        ReviewService.delete_review(
            user=self.explorer,
            review_id=self.review.pk,
        )
        audit = AdminActivity.objects.get(
            AACT_ACTION=AdminActivity.Action.REVIEW_DELETED_BY_AUTHOR,
            AACT_CONTEXT__review_id=self.review.pk,
        )
        self.assertGreaterEqual(audit.AACT_CREATED_AT, before)
        self.assertLessEqual(audit.AACT_CREATED_AT, timezone.now())
        self.assertEqual(audit.ACTOR_ID_id, self.explorer.pk)
        self.assertEqual(audit.TARGET_USER_ID_id, self.explorer.pk)
        self.assertEqual(audit.AACT_CONTEXT["author_id"], self.explorer.pk)
        self.assertEqual(audit.AACT_CONTEXT["business_id"], self.business.pk)
        self.assertEqual(
            audit.AACT_CONTEXT["closure_reason"],
            "content_removed_by_author",
        )
        self.assertFalse(Review.objects.filter(pk=self.review.pk).exists())
        self.assertFalse(ReviewReport.objects.filter(REVW_ID_id=self.review.pk).exists())
        self.assertFalse(
            MerchantReviewDispute.objects.filter(REVW_ID_id=self.review.pk).exists(),
        )
        return audit.AACT_CONTEXT

    def test_published_without_cases_records_independent_author_event(self):
        context = self._delete()
        self.assertEqual(context["previous_review_status"], "published")
        self.assertEqual(context["pending_reports"], [])
        self.assertEqual(context["pending_disputes"], [])
        self.assertNotIn("ai_moderation_outcome", context)
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, 0)
        self.assertFalse(ReputationEvent.objects.exists())
        self.assertFalse(Notification.objects.exists())

    def test_pending_reports_are_snapshotted_in_id_order(self):
        reports = [
            self._report()
            for _ in range(3)
        ]
        context = self._delete()
        self.assertEqual(
            context["pending_reports"],
            [
                {"id": report.pk, "previous_status": "pending"}
                for report in reports
            ],
        )

    def test_pending_dispute_is_snapshotted(self):
        dispute = self.create_dispute()
        context = self._delete()
        self.assertEqual(
            context["pending_disputes"],
            [{"id": dispute.pk, "previous_status": "pending"}],
        )

    def test_pending_reports_and_dispute_close_without_decision_side_effects(self):
        report = self._report()
        dispute = self.create_dispute()
        initial_reputation = self.explorer.USER_REPUTATION
        context = self._delete()
        self.assertEqual(
            context["pending_reports"],
            [{"id": report.pk, "previous_status": "pending"}],
        )
        self.assertEqual(
            context["pending_disputes"],
            [{"id": dispute.pk, "previous_status": "pending"}],
        )
        self.assertEqual(AdminActivity.objects.count(), 1)
        self.assertEqual(Notification.objects.count(), 2)
        self.assertFalse(Notification.objects.filter(USER_ID=self.explorer).exists())
        self.assertFalse(ReputationEvent.objects.exists())
        self.explorer.refresh_from_db()
        self.assertEqual(self.explorer.USER_REPUTATION, initial_reputation)

    def test_resolved_cases_keep_their_existing_admin_history(self):
        report = self._report()
        dispute = self.create_dispute()
        ManageReviewReportService.resolve(
            report.pk,
            actor=self.admin,
            admin_notes="Inspected report and kept the published review.",
            approve=False,
        )
        ManageReviewDisputeService.dismiss_dispute(
            dispute.pk,
            actor=self.admin,
            admin_notes="Inspected dispute and kept the published review.",
        )
        existing_history = list(AdminActivity.objects.order_by("AACT_ID").values())
        notifications = list(Notification.objects.order_by("NOTF_ID").values())
        context = self._delete()
        self.assertEqual(context["pending_reports"], [])
        self.assertEqual(context["pending_disputes"], [])
        self.assertEqual(
            list(
                AdminActivity.objects
                .exclude(AACT_ACTION=AdminActivity.Action.REVIEW_DELETED_BY_AUTHOR)
                .order_by("AACT_ID")
                .values()
            ),
            existing_history,
        )
        self.assertEqual(
            list(Notification.objects.order_by("NOTF_ID").values()),
            notifications,
        )

    def _held(
        self,
        outcome,
    ):
        self.review.REVW_STATUS = Review.ReviewStatus.UNDER_REVIEW
        self.review.REVW_MODERATION_DATA = {
            "outcome": outcome,
            "findings": [{"private": "raw AI payload"}],
            "retry_attempt": 0,
            "retryable": True,
        }
        self.review.save(update_fields=["REVW_STATUS", "REVW_MODERATION_DATA"])
        self.business.BUSN_REVIEW_COUNT = 0
        self.business.save(update_fields=["BUSN_REVIEW_COUNT"])

    def test_ai_flagged_submission_records_only_held_outcome(self):
        self._held("flagged")
        context = self._delete()
        self.assertEqual(context["previous_review_status"], "under_review")
        self.assertEqual(context["ai_moderation_outcome"], "flagged")
        self.assertNotIn("findings", context)
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, 0)

    def test_provider_failure_removal_keeps_retry_missing_row_safety(self):
        self._held("provider_failure")
        context = self._delete()
        self.assertEqual(context["ai_moderation_outcome"], "provider_failure")
        with patch(
            "apps.reviews.services.review_moderation_retry_service."
            "ReviewModerationService.moderate",
        ) as moderate:
            self.assertEqual(
                ReviewModerationRetryService.retry(self.review.pk, 0, 3),
                "stale",
            )
        moderate.assert_not_called()

    def test_rejected_review_keeps_prior_penalty_reward_and_decision(self):
        report = self._report()
        ManageReviewReportService.resolve(
            report.pk,
            actor=self.admin,
            admin_notes="Evidence inspected and violation confirmed.",
            approve=True,
        )
        decision = AdminActivity.objects.get()
        previous_context = decision.AACT_CONTEXT.copy()
        events = list(ReputationEvent.objects.order_by("REVT_ID").values())
        self.explorer.refresh_from_db()
        balance = self.explorer.USER_REPUTATION
        context = self._delete()
        self.assertEqual(context["previous_review_status"], "rejected")
        self.assertEqual(context["pending_reports"], [])
        decision.refresh_from_db()
        self.assertEqual(decision.AACT_CONTEXT, previous_context)
        self.assertEqual(decision.ACTOR_ID_id, self.admin.pk)
        self.assertEqual(
            list(ReputationEvent.objects.order_by("REVT_ID").values()),
            events,
        )
        self.explorer.refresh_from_db()
        self.assertEqual(self.explorer.USER_REPUTATION, balance)

    def test_retained_legacy_flagged_review_remains_deletable(self):
        self.review.REVW_STATUS = Review.ReviewStatus.FLAGGED
        self.review.save(update_fields=["REVW_STATUS"])
        context = self._delete()
        self.assertEqual(context["previous_review_status"], "flagged")

    def test_published_advisory_flags_are_not_copied_or_reinterpreted(self):
        self.review.REVW_IS_REPORT_FLAGGED = True
        self.review.REVW_IS_DEVICE_ABUSE_FLAGGED = True
        self.review.REVW_IS_OUTLIER_SENTIMENT = True
        self.review.REVW_RELIABILITY_REASONS = ["private-reason"]
        self.review.REVW_RELIABILITY_EVIDENCE = {"private": "evidence"}
        self.review.REVW_INSTALLATION_ID = "private-installation"
        self.review.REVW_MODERATION_DATA = {"outcome": "private-raw-result"}
        self.review.save()
        ReviewPhoto.objects.create(
            REVW_ID=self.review,
            RPHO_PHOTO_URL="https://example.com/private-review-photo.jpg",
        )
        context = self._delete()
        self.assertEqual(
            set(context),
            {
                "review_id", "author_id", "business_id", "previous_review_status",
                "closure_reason", "pending_reports", "pending_disputes",
            },
        )
        self.assertEqual(context["previous_review_status"], "published")

    def test_resolved_reports_are_excluded_when_pending_cases_remain(self):
        for status in ("approved", "rejected", "withdrawn"):
            self._report(status=status)
        pending = self._report()
        self.create_dispute(status=MerchantReviewDispute.DisputeStatus.DISMISSED)
        pending_dispute = self.create_dispute()
        context = self._delete()
        self.assertEqual(
            context["pending_reports"],
            [{"id": pending.pk, "previous_status": "pending"}],
        )
        self.assertEqual(
            context["pending_disputes"],
            [{"id": pending_dispute.pk, "previous_status": "pending"}],
        )

    def test_audit_failure_rolls_back_before_deletion_or_external_cleanup(self):
        report = self._report()
        dispute = self.create_dispute()
        with (
            patch(
                "apps.reviews.services.review_service.AdminActivityService.record_user_action",
                side_effect=RuntimeError("Audit unavailable"),
            ),
            patch("apps.reviews.services.review_service.CloudinaryService.delete_image") as media,
            patch("apps.reviews.tasks.refresh_business_review_insights.delay") as enqueue,
        ):
            with self.assertRaisesMessage(RuntimeError, "Audit unavailable"):
                ReviewService.delete_review(self.explorer, self.review.pk)
        media.assert_not_called()
        enqueue.assert_not_called()
        self.assertTrue(Review.objects.filter(pk=self.review.pk).exists())
        report.refresh_from_db()
        dispute.refresh_from_db()
        self.assertEqual(report.RREP_STATUS, "pending")
        self.assertEqual(dispute.MRDSP_STATUS, "pending")
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, 1)
        self.assertFalse(AdminActivity.objects.exists())

    def test_database_failure_rolls_back_audit_and_cascaded_rows(self):
        report = self._report()
        dispute = self.create_dispute()
        failure_targets = (
            "apps.reviews.services.review_service.Review.delete",
            "apps.reviews.services.review_service."
            "BusinessReviewSummaryService.recompute_sentiment",
        )
        for target in failure_targets:
            with self.subTest(target=target):
                with patch(target, side_effect=DatabaseError("Database failure")):
                    with self.assertRaises(DatabaseError):
                        ReviewService.delete_review(self.explorer, self.review.pk)
                self.assertTrue(Review.objects.filter(pk=self.review.pk).exists())
                self.assertTrue(ReviewReport.objects.filter(pk=report.pk).exists())
                self.assertTrue(MerchantReviewDispute.objects.filter(pk=dispute.pk).exists())
                self.assertFalse(AdminActivity.objects.exists())
                self.business.refresh_from_db()
                self.assertEqual(self.business.BUSN_REVIEW_COUNT, 1)

    def test_repeated_delete_records_only_one_author_removal(self):
        self._delete()
        with self.assertRaises(NotFound):
            ReviewService.delete_review(self.explorer, self.review.pk)
        self.assertEqual(AdminActivity.objects.count(), 1)

    def test_http_ownership_and_actor_cannot_be_spoofed(self):
        url = reverse("review-detail", args=[self.review.pk])
        self.client.force_authenticate(user=self.second_explorer)
        response = self.client.delete(url)
        self.assertEqual(response.status_code, 403)
        self.assertFalse(AdminActivity.objects.exists())
        self.client.force_authenticate(user=self.explorer)
        response = self.client.delete(
            url,
            data={"actor": self.admin.pk},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(AdminActivity.objects.get().ACTOR_ID_id, self.explorer.pk)
        self.assertEqual(self.client.delete(url).status_code, 404)
        self.assertEqual(AdminActivity.objects.count(), 1)

    def test_history_reports_actual_author_role_and_remains_admin_only(self):
        self._delete()
        url = reverse(
            "admin-user-administrative-history",
            args=[self.explorer.pk],
        )
        self.client.force_authenticate(user=self.explorer)
        self.assertEqual(self.client.get(url).status_code, 403)
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        event = response.data["data"]["items"][0]
        self.assertEqual(event["action"], "review_deleted_by_author")
        self.assertEqual(event["actor"]["id"], self.explorer.pk)
        self.assertEqual(event["actor"]["role"], "explorer")
        self.assertIn("timestamp", event)
