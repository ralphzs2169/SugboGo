"""Focused persisted-event, reporting-window, and account-composition tests."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.db import DatabaseError
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.test import APITestCase

from apps.admin_operations.dashboard.platform_overview_service import (
    PlatformOverviewService,
)
from apps.admin_operations.dashboard.tests import DashboardFixtures
from apps.business.models import (
    Business,
    BusinessSpecialtyTag,
    BusinessVouch,
    SpecialtyTag,
)
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationSubmission,
)
from apps.reviews.models import Review
from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin


class PlatformOverviewFixtures(DashboardFixtures):
    """Create retained source events without invoking external processing or score work."""

    def submission(
        self,
        timestamp,
        application=None,
    ):
        if application is None:
            application = self.create_application()

        return MerchantApplicationSubmission.objects.create(
            MAPP_ID=application,
            MASUB_SUBMISSION_NUMBER=application.submissions.count() + 1,
            MASUB_SUBMITTED_AT=timestamp,
        )

    def publication(
        self,
        business,
        timestamp,
        status=Review.ReviewStatus.PUBLISHED,
    ):
        review = self.create_review(
            business,
            status=status,
            REVW_PUBLISHED_AT=timestamp,
        )
        Review.objects.filter(pk=review.pk).update(
            REVW_CREATED_AT=self.NOW - timedelta(days=30),
        )
        return review

    def vouch(
        self,
        business,
        tag,
        timestamp,
        **fields,
    ):
        vouch = BusinessVouch.objects.create(
            BUSN_ID=business,
            TAG_ID=tag,
            USER_ID=self.create_user(),
            VOUCH_REPUTATION_SNAPSHOT=Decimal("0.50000"),
            **fields,
        )
        BusinessVouch.objects.filter(pk=vouch.pk).update(
            VOUCH_CREATED_AT=timestamp,
        )
        return vouch


class PlatformOverviewServiceTests(PlatformOverviewFixtures, TestCase):
    """Protect event semantics, half-open Manila periods, and disjoint account roles."""

    def test_window_reuses_seven_manila_calendar_dates_capped_at_as_of(self):
        result = PlatformOverviewService.get_overview()
        window = result["activity"]["window"]

        self.assertEqual(result["as_of"], self.NOW)
        self.assertEqual(window["timezone"], "Asia/Manila")
        self.assertEqual(
            window["start"],
            datetime(2026, 10, 30, 16, tzinfo=UTC),
        )
        self.assertEqual(window["end_exclusive"], self.NOW)
        self.assertTrue(window["includes_partial_day"])

    def test_manila_day_rollover_is_independent_of_server_and_active_timezone(self):
        now = datetime(2026, 11, 6, 17, 30, tzinfo=UTC)
        with (
            patch("django.utils.timezone.now", return_value=now),
            timezone.override("America/New_York"),
        ):
            window = PlatformOverviewService.get_overview()["activity"]["window"]

        self.assertEqual(
            window["start"],
            datetime(2026, 10, 31, 16, tzinfo=UTC),
        )
        self.assertEqual(window["end_exclusive"], now)
        self.assertEqual(window["timezone"], "Asia/Manila")

    def test_exact_manila_midnight_starts_new_calendar_selection(self):
        now = datetime(2026, 11, 6, 16, tzinfo=UTC)
        with patch("django.utils.timezone.now", return_value=now):
            window = PlatformOverviewService.get_overview()["activity"]["window"]

        self.assertEqual(
            window["start"],
            datetime(2026, 10, 31, 16, tzinfo=UTC),
        )
        self.assertEqual(window["end_exclusive"], now)

    def test_all_event_sources_obey_inclusive_start_and_exclusive_end(self):
        business = self.create_business()
        tag = SpecialtyTag.objects.create(TAG_NAME="Dashboard specialty")
        start = datetime(2026, 10, 30, 16, tzinfo=UTC)
        application = self.create_application()
        for timestamp in (
            start - timedelta(microseconds=1),
            start,
            self.NOW - timedelta(microseconds=1),
            self.NOW,
            self.NOW + timedelta(microseconds=1),
        ):
            self.submission(timestamp, application=application)
            self.publication(business, timestamp)
            self.vouch(business, tag, timestamp)

        activity = PlatformOverviewService.get_overview()["activity"]

        self.assertEqual(activity["applications_submitted"], 2)
        self.assertEqual(activity["reviews_published"], 2)
        self.assertEqual(activity["vouches_created"], 2)

    def test_submissions_include_resubmissions_independent_of_current_application_status(self):
        application = self.create_application(
            status=MerchantApplication.ApplicationStatus.APPROVED,
            submitted_at=self.NOW - timedelta(days=1),
        )
        self.submission(self.NOW - timedelta(days=20), application=application)
        self.submission(self.NOW - timedelta(days=3), application=application)
        self.submission(self.NOW - timedelta(days=1), application=application)
        MerchantApplication.objects.filter(pk=application.pk).update(
            MAPP_CREATED_AT=self.NOW - timedelta(days=40),
            MAPP_SUBMISSION_COUNT=3,
        )

        activity = PlatformOverviewService.get_overview()["activity"]

        self.assertEqual(activity["applications_submitted"], 2)

    def test_application_creation_or_latest_timestamp_without_submission_history_does_not_count(self):
        self.create_application(
            submitted_at=self.NOW - timedelta(hours=1),
        )
        self.create_application(status=MerchantApplication.ApplicationStatus.DRAFT)

        self.assertEqual(
            PlatformOverviewService.get_overview()["activity"]["applications_submitted"],
            0,
        )

    def test_delayed_publication_uses_persisted_publication_not_creation(self):
        business = self.create_business()
        self.publication(
            business,
            self.NOW - timedelta(hours=1),
        )
        created_only = self.create_review(
            business,
            status=Review.ReviewStatus.UNDER_REVIEW,
            REVW_MODERATION_DATA={"outcome": "pending_initial"},
        )
        Review.objects.filter(pk=created_only.pk).update(
            REVW_CREATED_AT=self.NOW - timedelta(hours=2),
        )

        self.assertEqual(
            PlatformOverviewService.get_overview()["activity"]["reviews_published"],
            1,
        )

    def test_recent_creation_and_updates_cannot_replace_old_or_missing_publication_time(self):
        business = self.create_business()
        for published_at in (None, self.NOW - timedelta(days=20)):
            review = self.create_review(
                business,
                REVW_PUBLISHED_AT=published_at,
            )
            Review.objects.filter(pk=review.pk).update(
                REVW_CREATED_AT=self.NOW - timedelta(hours=1),
                REVW_UPDATED_AT=self.NOW - timedelta(minutes=1),
            )

        activity = PlatformOverviewService.get_overview()["activity"]

        self.assertEqual(activity["reviews_published"], 0)
        self.assertIn(
            "Legacy reviews without publication timestamps are excluded",
            activity["definitions"]["reviews_published"],
        )

    def test_recorded_publication_still_counts_after_later_moderation(self):
        business = self.create_business()
        self.publication(
            business,
            self.NOW - timedelta(hours=1),
            status=Review.ReviewStatus.REJECTED,
        )

        self.assertEqual(
            PlatformOverviewService.get_overview()["activity"]["reviews_published"],
            1,
        )

    def test_vouch_creation_is_independent_of_current_support_and_score_state(self):
        business = self.create_business()
        tag = SpecialtyTag.objects.create(TAG_NAME="Dashboard vouch specialty")
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=business,
            TAG_ID=tag,
            BST_TAG_SCORE=Decimal("0.90000"),
            BST_VOUCH_COUNT=500,
        )
        Business.objects.filter(pk=business.pk).update(BUSN_VOUCH_COUNT=999)
        self.vouch(
            business,
            tag,
            self.NOW - timedelta(days=1),
            VOUCH_WITHDRAWN_AT=self.NOW,
            VOUCH_EVIDENCE_IS_VALID=False,
            VOUCH_FLAG_SUSPICIOUS=True,
        )
        old = self.vouch(
            business,
            tag,
            self.NOW - timedelta(days=20),
        )
        # Reinstatement updates current support, not the original creation event.
        BusinessVouch.objects.filter(pk=old.pk).update(
            VOUCH_WITHDRAWN_AT=None,
            VOUCH_UPDATED_AT=self.NOW - timedelta(hours=1),
        )

        self.assertEqual(
            PlatformOverviewService.get_overview()["activity"]["vouches_created"],
            1,
        )

    def test_every_assigned_role_and_account_status_counts_exactly_once(self):
        for role in User.UserRole.values:
            for status in User.UserStatus.values:
                self.create_user(role=role, status=status)

        distribution = PlatformOverviewService.get_overview()["user_distribution"]

        for role in User.UserRole.values:
            self.assertEqual(distribution[role], 4)
        self.assertEqual(distribution["total"], 16)
        self.assertEqual(distribution["unknown_role"], 0)
        self.assertEqual(
            distribution["total"],
            sum(
                distribution[role]
                for role in User.UserRole.values
            ),
        )

    def test_merchant_does_not_also_count_as_explorer(self):
        self.create_user(role=User.UserRole.MERCHANT)

        distribution = PlatformOverviewService.get_overview()["user_distribution"]

        self.assertEqual(distribution["total"], 1)
        self.assertEqual(distribution["merchant"], 1)
        self.assertEqual(distribution["explorer"], 0)

    def test_super_admin_counts_by_assigned_role_not_django_staff_flags(self):
        explorer = self.create_user()
        User.objects.filter(pk=explorer.pk).update(is_superuser=True, is_staff=True)
        self.create_user(role=User.UserRole.SUPER_ADMIN)

        distribution = PlatformOverviewService.get_overview()["user_distribution"]

        self.assertEqual(distribution["total"], 2)
        self.assertEqual(distribution["explorer"], 1)
        self.assertEqual(distribution["super_admin"], 1)
        self.assertEqual(distribution["admin"], 0)

    def test_unrecognized_roles_are_disclosed_without_dropping_or_reclassifying_accounts(self):
        self.create_user(role=User.UserRole.MERCHANT)
        self.create_user(role="legacy_role")
        self.create_user(role="")

        distribution = PlatformOverviewService.get_overview()["user_distribution"]

        self.assertEqual(distribution["total"], 3)
        self.assertEqual(distribution["merchant"], 1)
        self.assertEqual(distribution["unknown_role"], 2)
        self.assertEqual(distribution["explorer"], 0)
        self.assertNotIn("legacy_role", distribution)
        self.assertEqual(
            distribution["total"],
            distribution["explorer"]
            + distribution["merchant"]
            + distribution["admin"]
            + distribution["super_admin"]
            + distribution["unknown_role"],
        )

    def test_overview_uses_four_aggregate_queries(self):
        with self.assertNumQueries(4):
            result = PlatformOverviewService.get_overview()

        self.assertEqual(result["activity"]["applications_submitted"], 0)
        self.assertEqual(result["activity"]["reviews_published"], 0)
        self.assertEqual(result["activity"]["vouches_created"], 0)
        self.assertEqual(result["user_distribution"]["total"], 0)

    def test_failed_queries_are_not_converted_to_zero(self):
        for model, method in (
            (MerchantApplicationSubmission, "filter"),
            (Review, "filter"),
            (BusinessVouch, "filter"),
            (User, "aggregate"),
        ):
            with (
                self.subTest(source=model.__name__),
                patch.object(
                    model.objects,
                    method,
                    side_effect=DatabaseError("Overview source unavailable"),
                ),
            ):
                with self.assertRaisesMessage(
                    DatabaseError,
                    "Overview source unavailable",
                ):
                    PlatformOverviewService.get_overview()


class PlatformOverviewViewTests(
    PlatformOverviewFixtures,
    APIResponseAssertionsMixin,
    APITestCase,
):
    """Protect independent Dashboard response fields and server-side role access."""

    def test_admin_and_super_admin_receive_explicit_empty_contract(self):
        for role in (User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN):
            with self.subTest(role=role):
                self.client.force_authenticate(
                    user=User(
                        USER_ID=999,
                        USER_ROLE=role,
                        USER_STATUS=User.UserStatus.ACTIVE,
                    ),
                )
                response = self.client.get(reverse("admin-dashboard-platform-overview"))

                self.assertSuccessResponse(
                    response,
                    message="Dashboard platform overview retrieved successfully.",
                )
                data = response.data["data"]
                self.assertEqual(parse_datetime(data["as_of"]), self.NOW)
                window = data["activity"]["window"]
                self.assertEqual(window["start"], "2026-10-30T16:00:00Z")
                self.assertEqual(window["end_exclusive"], "2026-11-06T12:00:00Z")
                self.assertEqual(window["timezone"], "Asia/Manila")
                self.assertTrue(window["includes_partial_day"])
                for metric in (
                    "applications_submitted",
                    "reviews_published",
                    "vouches_created",
                ):
                    self.assertEqual(data["activity"][metric], 0)
                    self.assertTrue(data["activity"]["definitions"][metric])
                self.assertEqual(
                    set(data["user_distribution"]),
                    {
                        "total",
                        "explorer",
                        "merchant",
                        "admin",
                        "super_admin",
                        "unknown_role",
                        "scope",
                    },
                )
                for role in (*User.UserRole.values, "total", "unknown_role"):
                    self.assertEqual(data["user_distribution"][role], 0)
                self.assertIn("all account statuses", data["user_distribution"]["scope"])

    def test_overview_does_not_call_other_dashboard_sections(self):
        self.client.force_authenticate(
            user=self.create_user(role=User.UserRole.ADMIN),
        )
        with (
            patch(
                "apps.admin_operations.dashboard.services.DashboardSummaryService.get_summary",
                side_effect=AssertionError("Summary must remain independent"),
            ),
            patch(
                "apps.admin_operations.dashboard.recent_decisions_service."
                "RecentDecisionsService.get_recent_decisions",
                side_effect=AssertionError("Recent decisions must remain independent"),
            ),
        ):
            response = self.client.get(reverse("admin-dashboard-platform-overview"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["user_distribution"]["admin"], 1)

    def test_unauthorized_roles_and_inactive_administrators_are_rejected(self):
        for role, status in (
            (User.UserRole.EXPLORER, User.UserStatus.ACTIVE),
            (User.UserRole.MERCHANT, User.UserStatus.ACTIVE),
            (User.UserRole.ADMIN, User.UserStatus.SUSPENDED),
            (User.UserRole.SUPER_ADMIN, User.UserStatus.DISABLED),
        ):
            with self.subTest(role=role, status=status):
                self.client.force_authenticate(
                    user=self.create_user(role=role, status=status),
                )
                response = self.client.get(reverse("admin-dashboard-platform-overview"))
                self.assertEqual(response.status_code, 403)
                self.assertFalse(response.data["success"])

    def test_unauthenticated_request_is_rejected(self):
        response = self.client.get(reverse("admin-dashboard-platform-overview"))

        self.assertEqual(response.status_code, 401)
        self.assertFalse(response.data["success"])
