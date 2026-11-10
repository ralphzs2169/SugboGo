from datetime import timedelta
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.core.paginator import Paginator
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.activity_management.unified_activity_service import (
    UnifiedActivityService,
)
from apps.admin_operations.system_configuration.models import AnalyticsPolicyChange
from apps.authentication.models import LoginEvent
from apps.business.models import Business, Category, Cluster, Location
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationSubmission,
)
from apps.reviews.models import Review
from apps.users.models import User


class UnifiedAuthenticationActivityTests(TestCase):
    """Verify attributable login receipts, privacy, retention, and cross-source pagination."""

    @classmethod
    def setUpTestData(cls):
        """Create known accounts without producing authentication or unrelated activity records."""
        AnalyticsPolicyChange.objects.all().delete()
        cls.now = timezone.now().replace(microsecond=0)
        cls.user = User.objects.create(
            USER_EMAIL="unified-login@example.com",
            USER_FNAME="Private",
            USER_LNAME="Current Merchant",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
            EMAIL_VERIFIED=True,
            password="!",
        )
        cls.admin = User.objects.create(
            USER_EMAIL="unified-login-admin@example.com",
            USER_FNAME="Private",
            USER_LNAME="Current Admin",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
            EMAIL_VERIFIED=True,
            password="!",
        )

    def make_event(
        self,
        method=LoginEvent.Method.PASSWORD,
        outcome=LoginEvent.Outcome.SUCCESS,
        *,
        user=None,
        anonymous=False,
        occurred_at=None,
        source_id=None,
    ):
        """Create stored authentication evidence with metadata that the unified reader must omit."""
        if occurred_at is None:
            occurred_at = self.now
        if anonymous:
            actor = None
        elif user is not None:
            actor = user
        else:
            actor = self.user
        fields = {
            "USER": actor,
            "LEVT_METHOD": method,
            "LEVT_OUTCOME": outcome,
            "LEVT_CREATED_AT": occurred_at,
            "LEVT_IP_ADDRESS": "192.0.2.55",
            "LEVT_PLATFORM": "private-platform",
            "LEVT_CLIENT": "private-client",
        }
        if source_id is not None:
            fields["LEVT_ID"] = source_id
        return LoginEvent.objects.create(**fields)

    def test_supported_outcomes_keep_original_identity_time_and_only_safe_metadata(self):
        events = []
        for method in LoginEvent.Method.values:
            actor = self.user
            if method == LoginEvent.Method.ADMIN:
                actor = self.admin
            events.append(self.make_event(method=method, user=actor))
        for method in (LoginEvent.Method.GOOGLE, LoginEvent.Method.FACEBOOK):
            for outcome in (LoginEvent.Outcome.FAILED, LoginEvent.Outcome.UNAVAILABLE):
                events.append(self.make_event(method=method, outcome=outcome))

        with CaptureQueriesContext(connection) as queries:
            rows = list(UnifiedActivityService.list_activity())

        self.assertEqual(len(queries), 1)
        self.assertIn("UNION ALL", queries[0]["sql"])
        for field in ("LEVT_IP_ADDRESS", "LEVT_PLATFORM", "LEVT_CLIENT"):
            self.assertNotIn(field, queries[0]["sql"])
        self.assertEqual(len(rows), 8)
        expected = {
            str(event.pk): event
            for event in events
        }
        occurrences = {
            "success": "login_succeeded",
            "failed": "login_failed",
            "unavailable": "login_unavailable",
        }
        for row in rows:
            with self.subTest(source_id=row["source_id"]):
                event = expected[row["source_id"]]
                self.assertEqual(tuple(row), UnifiedActivityService.COLUMNS)
                self.assertEqual(row["source_type"], "login_event")
                self.assertEqual(row["module"], "authentication")
                self.assertEqual(row["occurrence"], occurrences[event.LEVT_OUTCOME])
                self.assertEqual(row["occurred_at"], event.LEVT_CREATED_AT)
                self.assertEqual(row["actor_id"], event.USER_id)
                self.assertEqual(row["target_type"], "user")
                self.assertEqual(row["target_id"], str(event.USER_id))
                self.assertEqual(row["outcome"], event.LEVT_OUTCOME)
                self.assertFalse(row["is_administrative"])
                self.assertEqual(row["provenance"], {
                    "model": "authentication.loginevent",
                    "method": event.LEVT_METHOD,
                })
                for field in (
                    "actor_display_snapshot",
                    "actor_role_snapshot",
                    "target_label",
                    "new_state",
                ):
                    self.assertIsNone(row[field])
        self.assertNotIn("192.0.2.55", repr(rows))
        self.assertNotIn("private-", repr(rows))
        self.assertNotIn(self.user.USER_EMAIL, repr(rows))

    def test_anonymous_and_email_only_password_failures_are_not_attributed_as_user_activity(self):
        for method in LoginEvent.Method.values:
            for outcome in LoginEvent.Outcome.values:
                self.make_event(method=method, outcome=outcome, anonymous=True)
        for method in (LoginEvent.Method.PASSWORD, LoginEvent.Method.ADMIN):
            for outcome in (LoginEvent.Outcome.FAILED, LoginEvent.Outcome.UNAVAILABLE):
                self.make_event(method=method, outcome=outcome)
        successful = self.make_event()
        verified_denial = self.make_event(
            method=LoginEvent.Method.GOOGLE,
            outcome=LoginEvent.Outcome.FAILED,
        )

        rows = list(UnifiedActivityService.list_activity())

        self.assertEqual(
            {row["source_id"] for row in rows},
            {str(successful.pk), str(verified_denial.pk)},
        )
        self.assertEqual(len(rows), 2)
        self.assertEqual(LoginEvent.objects.count(), 18)

    @override_settings(LOGIN_HISTORY_RETENTION_DAYS=2)
    def test_retention_uses_shared_cutoff_without_pruning_or_hiding_older_non_auth_activity(self):
        cutoff = self.now - timedelta(days=2)
        expired = self.make_event(occurred_at=cutoff - timedelta(microseconds=1))
        boundary = self.make_event(occurred_at=cutoff)
        retained = self.make_event(occurred_at=cutoff + timedelta(microseconds=1))
        administrative = AdminActivity.objects.create(
            ACTOR_ID=self.admin,
            AACT_ACTION=AdminActivity.Action.USER_SUSPENDED,
        )
        AdminActivity.objects.filter(pk=administrative.pk).update(
            AACT_CREATED_AT=cutoff - timedelta(days=30),
        )

        with patch(
            "apps.authentication.services.login_history_service.timezone.now",
            return_value=self.now,
        ):
            rows = list(UnifiedActivityService.list_activity())

        self.assertEqual(
            {(row["source_type"], row["source_id"]) for row in rows},
            {
                ("login_event", str(boundary.pk)),
                ("login_event", str(retained.pk)),
                ("admin_activity", str(administrative.pk)),
            },
        )
        self.assertTrue(LoginEvent.objects.filter(pk=expired.pk).exists())
        self.assertEqual(LoginEvent.objects.count(), 3)

    def test_current_account_changes_do_not_rewrite_historical_identity_or_classification(self):
        event = self.make_event(method=LoginEvent.Method.ADMIN, user=self.admin)
        User.objects.filter(pk=self.admin.pk).update(
            USER_ROLE=User.UserRole.EXPLORER,
            USER_FNAME="Renamed",
            USER_STATUS=User.UserStatus.SUSPENDED,
            EMAIL_VERIFIED=False,
        )
        rows = list(UnifiedActivityService.list_activity())

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["source_id"], str(event.pk))
        self.assertEqual(rows[0]["actor_id"], self.admin.pk)
        self.assertEqual(rows[0]["provenance"]["method"], "admin")
        self.assertFalse(rows[0]["is_administrative"])
        self.assertIsNone(rows[0]["actor_role_snapshot"])
        self.assertIsNone(rows[0]["actor_display_snapshot"])
        self.assertIsNone(rows[0]["target_label"])

    def test_repeated_logins_order_and_paginate_with_admin_merchant_and_explorer_sources(self):
        for source_id in (9, 42, 100):
            self.make_event(source_id=source_id)
        administrative = AdminActivity.objects.create(
            AACT_ID=42,
            ACTOR_ID=self.admin,
            AACT_ACTION=AdminActivity.Action.USER_REACTIVATED,
        )
        AdminActivity.objects.filter(pk=administrative.pk).update(AACT_CREATED_AT=self.now)
        application = MerchantApplication.objects.create(
            USER_ID=self.user,
            MAPP_STATUS=MerchantApplication.ApplicationStatus.APPROVED,
        )
        MerchantApplicationSubmission.objects.create(
            MASUB_ID=42,
            MAPP_ID=application,
            MASUB_SUBMISSION_NUMBER=1,
            MASUB_SUBMITTED_AT=self.now,
        )
        cluster = Cluster.objects.create(CLUS_NAME="Authentication compatibility")
        category = Category.objects.create(
            CLUS_ID=cluster,
            CTGRY_NAME="Authentication compatibility category",
        )
        location = Location.objects.create(
            LOCT_POINT=Point(123.9, 10.3, srid=4326),
            LOCT_ADDRESS="Business address",
        )
        business = Business.objects.create(
            USER_ID=self.admin,
            CTGRY_ID=category,
            LOCT_ID=location,
            BUSN_NAME="Historical business",
            BUSN_CONTACT_NUMBER="09123456789",
        )
        review = Review.objects.create(
            REVW_ID=42,
            USER_ID=self.user,
            BUSN_ID=business,
            REVW_TEXT="Retained review receipt.",
        )
        Review.objects.filter(pk=review.pk).update(REVW_CREATED_AT=self.now)
        paginator = Paginator(UnifiedActivityService.list_activity(), 2)
        with CaptureQueriesContext(connection) as queries:
            rows = [
                row
                for page_number in paginator.page_range
                for row in paginator.page(page_number).object_list
            ]

        self.assertEqual(len(queries), 4)
        self.assertIn("UNION ALL", queries[-1]["sql"])
        self.assertIn("LIMIT 2 OFFSET 4", queries[-1]["sql"])
        self.assertEqual(paginator.count, 6)
        self.assertEqual(
            [(row["source_type"], row["source_id"]) for row in rows],
            [
                ("admin_activity", "42"),
                ("login_event", "100"),
                ("login_event", "42"),
                ("login_event", "9"),
                ("merchant_application_submission", "42"),
                ("review", "42"),
            ],
        )
        self.assertTrue(rows[0]["is_administrative"])
        self.assertFalse(rows[-1]["is_administrative"])
        self.assertFalse(rows[-2]["is_administrative"])

        newest = self.make_event(occurred_at=self.now + timedelta(microseconds=1))
        first = UnifiedActivityService.list_activity()[0]
        self.assertEqual(first["source_type"], "login_event")
        self.assertEqual(first["source_id"], str(newest.pk))
