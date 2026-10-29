"""Publication and exclusion serialize business effects before insight policy locks."""

from concurrent.futures import ThreadPoolExecutor
from threading import Event
from time import monotonic
from unittest import skipUnless
from unittest.mock import patch

from django.db import connection, transaction
from django.test import TransactionTestCase
from rest_framework.exceptions import ValidationError

from apps.admin_operations.moderation.services.manage_reported_review_service import (
    ManageReportedReviewService,
)
from apps.admin_operations.moderation.services.manage_review_report_service import (
    ManageReviewReportService,
)
from apps.admin_operations.moderation.services.manage_under_review_service import (
    ManageUnderReviewService,
)
from apps.admin_operations.system_configuration.models import AnalyticsPolicyConfiguration
from apps.admin_operations.system_configuration.services.tests.test_analytics_policy_service import (
    create_policy_admin,
)
from apps.business.models import Business
from apps.notifications.models import Notification
from apps.reviews.models import (
    BusinessReviewSummary,
    Review,
    ReviewInsightRegeneration,
    ReviewReport,
)
from apps.reviews.services.review_insight_scheduling_service import ReviewInsightSchedulingService
from apps.reviews.services.review_moderation_consistency_service import (
    ReviewModerationConsistencyService,
)
from apps.reviews.services.review_service import ReviewService
from apps.reviews.services.tests.test_business_review_summary_service import SummaryFixtureMixin
from apps.users.models import ReputationEvent, User


@skipUnless(connection.vendor == "postgresql", "Requires PostgreSQL row locks.")
class ReviewPublicationLockOrderTests(SummaryFixtureMixin, TransactionTestCase):
    def setUp(self):
        AnalyticsPolicyConfiguration.objects.get_or_create(pk=1)
        self.business = self.create_business()
        self.publishing = self.create_review(
            self.business,
            REVW_STATUS=Review.ReviewStatus.UNDER_REVIEW,
        )
        self.excluding = self.create_review(self.business, 1)
        Business.objects.filter(pk=self.business.pk).update(BUSN_REVIEW_COUNT=1)
        BusinessReviewSummary.objects.create(BUSN_ID=self.business)
        ReviewInsightSchedulingService.reconcile(self.business.pk)
        self.initial_revision = self.state().RIRG_REQUESTED_REVISION
        self.publication_locked = Event()
        self.contender_ready = Event()
        self.admin = create_policy_admin()
        for target in (
            "apps.reviews.tasks.process_review_sentiment.delay",
            "apps.reviews.tasks.cleanup_review_media_asset.apply_async",
            "apps.notifications.services.notification_service."
            "NotificationRealtimeService.schedule",
        ):
            self.enterContext(patch(target))

    def state(self):
        return ReviewInsightRegeneration.objects.get(BUSN_ID=self.business)

    def _operate(
        self,
        operation,
    ):
        if operation == "publish":
            return ReviewService.publish_under_review(self.publishing.pk)
        if operation == "admin_publish":
            return ManageUnderReviewService.resolve(
                self.publishing.pk,
                actor=self.admin,
                approve=True,
            )
        if operation == "admin_reject":
            return ManageReportedReviewService.resolve(
                self.excluding.pk,
                actor=self.admin,
                decision="reject",
                admin_notes="Inspected the review and confirmed the reported violation.",
            )
        if operation == "admin_report_reject":
            return ManageReviewReportService.resolve(
                self.report.pk,
                actor=self.admin,
                approve=True,
                admin_notes="Inspected the review and confirmed the reported violation.",
            )
        if operation == "delete":
            return ReviewService.delete_review(
                self.excluding.USER_ID,
                self.excluding.pk,
            )
        return ReviewModerationConsistencyService.reject_review(self.excluding.pk)

    def _worker(
        self,
        operation,
        publisher,
        shared_reporter=False,
    ):
        business_table = connection.ops.quote_name(Business._meta.db_table)
        policy_table = connection.ops.quote_name(
            AnalyticsPolicyConfiguration._meta.db_table,
        )
        user_table = connection.ops.quote_name(User._meta.db_table)

        def coordinate(
            execute,
            sql,
            params,
            many,
            context,
        ):
            counter_update = sql.startswith(f"UPDATE {business_table} ")
            business_lock = (
                f"FROM {business_table} " in sql
                and "FOR UPDATE" in sql
            )
            policy_lock = policy_table in sql and "FOR UPDATE" in sql
            user_lock = (
                f"FROM {user_table} " in sql
                and "FOR UPDATE" in sql
            )
            shared_user_lock = shared_reporter and user_lock
            if (
                not publisher
                and (counter_update or business_lock or shared_user_lock)
            ):
                # Signal before a possible wait on publication's first shared
                # lock: the account for reporter races, otherwise the business
                # row (rating deletion invalidation can lock it before UPDATE).
                self.contender_ready.set()
            result = execute(sql, params, many, context)
            if (
                publisher
                and (counter_update or shared_user_lock)
                and not self.publication_locked.is_set()
            ):
                self.publication_locked.set()
                if not self.contender_ready.wait(timeout=5):
                    raise AssertionError("Exclusion did not reach its first shared lock.")
                deadline = monotonic() + 5
                while True:
                    with connection.cursor() as cursor:
                        cursor.execute(
                            "SELECT %s = ANY(pg_blocking_pids(%s))",
                            [backend_id, self.exclusion_backend_id],
                        )
                        if cursor.fetchone()[0]:
                            break
                    if monotonic() >= deadline:
                        raise AssertionError("Exclusion did not wait on the shared row.")
                    Event().wait(0.01)
            elif not publisher and policy_lock:
                # Before the fix, resume publication only after rejection holds
                # the actual policy row lock, deterministically closing the cycle.
                self.contender_ready.set()
            return result

        try:
            with connection.cursor() as cursor:
                cursor.execute("SET lock_timeout = '8s'")
                cursor.execute("SET statement_timeout = '12s'")
                cursor.execute("SELECT pg_backend_pid()")
                backend_id = cursor.fetchone()[0]
            if not publisher:
                self.exclusion_backend_id = backend_id
                if not self.publication_locked.wait(timeout=5):
                    raise AssertionError("Publication did not acquire its first shared lock.")
            with connection.execute_wrapper(coordinate):
                self._operate(operation)
            return backend_id
        finally:
            connection.close()

    def _assert_race(
        self,
        publication="publish",
        exclusion="reject",
        shared_reporter=False,
    ):
        with ThreadPoolExecutor(max_workers=2) as executor:
            published = executor.submit(
                self._worker,
                publication,
                True,
                shared_reporter,
            )
            excluded = executor.submit(
                self._worker,
                exclusion,
                False,
                shared_reporter,
            )
            publisher_id = published.result(timeout=18)
            exclusion_id = excluded.result(timeout=18)
        self.assertNotEqual(publisher_id, exclusion_id)
        self.publishing.refresh_from_db()
        self.business.refresh_from_db()
        self.assertEqual(self.publishing.REVW_STATUS, Review.ReviewStatus.PUBLISHED)
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, 1)
        if exclusion == "delete":
            self.assertFalse(Review.objects.filter(pk=self.excluding.pk).exists())
        else:
            self.excluding.refresh_from_db()
            self.assertEqual(self.excluding.REVW_STATUS, Review.ReviewStatus.REJECTED)
        state = self.state()
        self.assertEqual(state.RIRG_REQUESTED_REVISION, self.initial_revision + 2)
        self.assertEqual(state.RIRG_OBSERVED_REVISION, state.RIRG_REQUESTED_REVISION)
        summary = BusinessReviewSummary.objects.get(BUSN_ID=self.business)
        self.assertEqual(summary.BRSU_ELIGIBLE_REVIEW_COUNT, 1)
        self.assertEqual(
            Notification.objects.filter(NOTF_TYPE="business_review_received").count(),
            1,
        )
        self.assertEqual(
            ReputationEvent.objects.filter(
                USER_ID=self.publishing.USER_ID,
                REVT_EVENT_TYPE=ReputationEvent.EventType.REVIEW_REWARD,
            ).count(),
            1,
        )

    def test_publication_and_rejection_of_different_reviews_do_not_deadlock(self):
        self._assert_race()
        before_notifications = Notification.objects.count()
        before_reputation = ReputationEvent.objects.count()
        with self.assertRaises(ValidationError):
            self._operate("publish")
        self._operate("reject")
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, 1)
        self.assertEqual(Notification.objects.count(), before_notifications)
        self.assertEqual(ReputationEvent.objects.count(), before_reputation)
        self.assertEqual(self.state().RIRG_REQUESTED_REVISION, self.initial_revision + 2)

    def test_administrative_publication_and_report_rejection_do_not_deadlock(self):
        reporter = User.objects.create_user(
            email="lock-order-reporter@example.com",
            password=None,
            USER_FNAME="Review",
            USER_LNAME="Reporter",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        report = ReviewReport.objects.create(
            REVW_ID=self.excluding,
            USER_ID=reporter,
            RREP_TYPE=ReviewReport.ReportType.ABUSE,
        )
        self._assert_race("admin_publish", "admin_reject")
        report.refresh_from_db()
        self.assertEqual(report.RREP_STATUS, ReviewReport.ReportStatus.APPROVED)
        before_notifications = Notification.objects.count()
        before_reputation = ReputationEvent.objects.count()
        for operation in ("admin_publish", "admin_reject"):
            with self.assertRaises(ValidationError):
                self._operate(operation)
        self.assertEqual(Notification.objects.count(), before_notifications)
        self.assertEqual(ReputationEvent.objects.count(), before_reputation)
        self.assertEqual(self.state().RIRG_REQUESTED_REVISION, self.initial_revision + 2)

    def test_publication_and_deletion_keep_the_same_lock_order(self):
        self._assert_race(exclusion="delete")

    def _assert_shared_reporter_race(
        self,
        exclusion,
    ):
        self.report = ReviewReport.objects.create(
            REVW_ID=self.excluding,
            USER_ID=self.publishing.USER_ID,
            RREP_TYPE=ReviewReport.ReportType.ABUSE,
        )
        self._assert_race(
            exclusion=exclusion,
            shared_reporter=True,
        )
        self.report.refresh_from_db()
        self.assertEqual(self.report.RREP_STATUS, ReviewReport.ReportStatus.APPROVED)
        self.assertEqual(
            ReputationEvent.objects.filter(USER_ID=self.publishing.USER_ID).count(),
            2,
        )
        before_reputation = ReputationEvent.objects.count()
        before_notifications = Notification.objects.count()
        with self.assertRaises(ValidationError):
            self._operate(exclusion)
        self.assertEqual(ReputationEvent.objects.count(), before_reputation)
        self.assertEqual(Notification.objects.count(), before_notifications)
        self.assertEqual(self.state().RIRG_REQUESTED_REVISION, self.initial_revision + 2)

    def test_publishing_author_reporting_rejected_review_does_not_deadlock(self):
        self._assert_shared_reporter_race("admin_reject")

    def test_publishing_author_reporting_individually_resolved_review_does_not_deadlock(self):
        self._assert_shared_reporter_race("admin_report_reject")

    def test_failed_publication_rolls_back_all_effects_and_demand(self):
        with self.assertRaises(RuntimeError):
            with transaction.atomic():
                self._operate("publish")
                raise RuntimeError("Abort after publication effects.")
        self.publishing.refresh_from_db()
        self.business.refresh_from_db()
        self.assertEqual(self.publishing.REVW_STATUS, Review.ReviewStatus.UNDER_REVIEW)
        self.assertIsNone(self.publishing.REVW_PUBLISHED_AT)
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, 1)
        self.assertEqual(Notification.objects.count(), 0)
        self.assertEqual(ReputationEvent.objects.count(), 0)
        self.assertEqual(self.state().RIRG_REQUESTED_REVISION, self.initial_revision)

    def test_failed_rejection_scheduling_rolls_back_status_and_counter(self):
        with patch.object(
            ReviewInsightSchedulingService,
            "review_changed",
            side_effect=RuntimeError("Scheduling failed after the counter update."),
        ):
            with self.assertRaises(RuntimeError):
                self._operate("reject")
        self.excluding.refresh_from_db()
        self.business.refresh_from_db()
        self.assertEqual(self.excluding.REVW_STATUS, Review.ReviewStatus.PUBLISHED)
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, 1)
        self.assertEqual(self.state().RIRG_REQUESTED_REVISION, self.initial_revision)
