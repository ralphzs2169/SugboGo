from datetime import timedelta

from django.core.paginator import Paginator
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.activity_management.unified_activity_service import (
    UnifiedActivityService,
)
from apps.admin_operations.system_configuration.models import AnalyticsPolicyChange
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationSubmission,
)
from apps.users.models import User


class UnifiedActivityServiceTests(TestCase):
    """Verify source semantics and database pagination for the initial unified read contract."""

    @classmethod
    def setUpTestData(cls):
        """Create three source receipts with colliding source IDs and different event times."""
        AnalyticsPolicyChange.objects.all().delete()
        cls.now = timezone.now().replace(microsecond=0)
        cls.admin = User.objects.create(
            USER_EMAIL="unified-admin@example.com",
            USER_FNAME="Current",
            USER_LNAME="Administrator",
            USER_ROLE=User.UserRole.SUPER_ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
            password="!",
        )
        cls.applicant = User.objects.create(
            USER_EMAIL="unified-applicant@example.com",
            USER_FNAME="Current",
            USER_LNAME="Merchant",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.DISABLED,
            password="!",
        )
        cls.activity = AdminActivity.objects.create(
            AACT_ID=42,
            ACTOR_ID=cls.admin,
            TARGET_USER_ID=cls.applicant,
            AACT_ACTION=AdminActivity.Action.BUSINESS_SUSPENDED,
            AACT_IS_ADMINISTRATIVE=True,
            AACT_MODULE=AdminActivity.Module.BUSINESS,
            AACT_ACTOR_NAME="Recorded Administrator",
            AACT_ACTOR_ROLE=User.UserRole.ADMIN,
            AACT_TARGET_TYPE="business",
            AACT_TARGET_ID="73",
            AACT_TARGET_LABEL="Recorded Business",
            AACT_OUTCOME=AdminActivity.Outcome.SUCCEEDED,
            AACT_NEW_STATE={"status": "suspended"},
            AACT_SOURCE_TYPE="business_status_decision",
            AACT_SOURCE_ID="7",
            AACT_CONTEXT={"internal_notes": "Not part of the list projection."},
        )
        AdminActivity.objects.filter(pk=cls.activity.pk).update(
            AACT_CREATED_AT=cls.now - timedelta(hours=3),
        )
        cls.policy_change = AnalyticsPolicyChange.objects.create(
            APCH_ID=42,
            APCH_VERSION=2,
            APCH_ACTOR=cls.admin,
            APCH_ACTOR_ID_SNAPSHOT=cls.admin.pk,
            APCH_REASON="Adjust the narrative threshold.",
            APCH_BEFORE={"narrative_min_eligible_reviews": 3},
            APCH_AFTER={"narrative_min_eligible_reviews": 5},
        )
        AnalyticsPolicyChange.objects.filter(pk=cls.policy_change.pk).update(
            APCH_CREATED_AT=cls.now - timedelta(hours=2),
        )
        cls.application = MerchantApplication.objects.create(
            USER_ID=cls.applicant,
            MAPP_STATUS=MerchantApplication.ApplicationStatus.APPROVED,
        )
        cls.submission = MerchantApplicationSubmission.objects.create(
            MASUB_ID=42,
            MAPP_ID=cls.application,
            MASUB_SUBMISSION_NUMBER=2,
            MASUB_SUBMITTED_AT=cls.now - timedelta(hours=1),
            MASUB_DUPLICATE_EVIDENCE=[{"private_evidence": "Excluded."}],
        )

    def test_sources_share_one_typed_contract_and_read_authoritative_records_once(self):
        before_counts = (
            AdminActivity.objects.count(),
            AnalyticsPolicyChange.objects.count(),
            MerchantApplicationSubmission.objects.count(),
        )

        with CaptureQueriesContext(connection) as queries:
            rows = list(UnifiedActivityService.list_activity())

        self.assertEqual(len(queries), 1)
        self.assertIn("UNION ALL", queries[0]["sql"])
        self.assertEqual(len(rows), 3)
        for row in rows:
            with self.subTest(source=row["source_type"]):
                self.assertEqual(tuple(row), UnifiedActivityService.COLUMNS)
                self.assertIsInstance(row["source_id"], str)
                self.assertIsInstance(row["actor_id"], int)
                self.assertTrue(timezone.is_aware(row["occurred_at"]))
                self.assertIsInstance(row["is_administrative"], bool)
                self.assertIsInstance(row["provenance"], dict)

        by_source = {
            row["source_type"]: row
            for row in rows
        }
        activity = by_source["admin_activity"]
        self.assertEqual(activity["occurrence"], "business_suspended")
        self.assertEqual(activity["module"], "business")
        self.assertEqual(activity["actor_id"], self.admin.pk)
        self.assertEqual(activity["actor_display_snapshot"], "Recorded Administrator")
        self.assertEqual(activity["target_type"], "business")
        self.assertEqual(activity["target_id"], "73")
        self.assertEqual(activity["target_label"], "Recorded Business")
        self.assertEqual(activity["outcome"], "succeeded")
        self.assertEqual(activity["new_state"], {"status": "suspended"})
        self.assertEqual(activity["provenance"], {
            "model": "activity_management.adminactivity",
            "domain_source_type": "business_status_decision",
            "domain_source_id": "7",
        })

        policy = by_source["analytics_policy_change"]
        self.assertEqual(policy["occurrence"], "analytics_policy_revision")
        self.assertEqual(policy["module"], "system_configuration")
        self.assertEqual(policy["actor_id"], self.admin.pk)
        self.assertEqual(policy["target_type"], "analytics_policy")
        self.assertEqual(policy["target_id"], "1")
        self.assertEqual(policy["new_state"], {"narrative_min_eligible_reviews": 5})
        self.assertIsNone(policy["outcome"])
        self.assertEqual(policy["provenance"], {
            "model": "system_configuration.analyticspolicychange",
            "version": 2,
        })

        submission = by_source["merchant_application_submission"]
        self.assertEqual(submission["occurrence"], "merchant_application_submitted")
        self.assertEqual(submission["module"], "merchant_application")
        self.assertEqual(submission["actor_id"], self.applicant.pk)
        self.assertEqual(submission["target_type"], "merchant_application")
        self.assertEqual(submission["target_id"], str(self.application.pk))
        self.assertEqual(submission["occurred_at"], self.submission.MASUB_SUBMITTED_AT)
        self.assertIsNone(submission["outcome"])
        self.assertIsNone(submission["new_state"])
        self.assertFalse(submission["is_administrative"])
        self.assertTrue(policy["is_administrative"])
        self.assertEqual(submission["provenance"], {
            "model": "merchant_application.merchantapplicationsubmission",
            "submission_number": 2,
        })
        self.assertEqual(
            before_counts,
            (
                AdminActivity.objects.count(),
                AnalyticsPolicyChange.objects.count(),
                MerchantApplicationSubmission.objects.count(),
            ),
        )

    def test_unavailable_history_never_uses_current_identity_role_or_related_user_as_target(self):
        legacy = AdminActivity.objects.create(
            ACTOR_ID=self.admin,
            TARGET_USER_ID=self.applicant,
            AACT_ACTION=AdminActivity.Action.USER_REACTIVATED,
        )
        User.objects.filter(pk=self.admin.pk).update(
            USER_FNAME="Renamed",
            USER_ROLE=User.UserRole.EXPLORER,
        )
        rows = list(UnifiedActivityService.list_activity())

        for row in rows:
            with self.subTest(source=row["source_type"], source_id=row["source_id"]):
                if (
                    row["source_type"] == "admin_activity"
                    and row["source_id"] == str(self.activity.pk)
                ):
                    self.assertEqual(row["actor_role_snapshot"], "admin")
                    self.assertEqual(row["actor_display_snapshot"], "Recorded Administrator")
                else:
                    self.assertIsNone(row["actor_role_snapshot"])
                    self.assertIsNone(row["actor_display_snapshot"])
                    self.assertIsNone(row["target_label"])

        legacy_row = next(
            row
            for row in rows
            if (
                row["source_type"] == "admin_activity"
                and row["source_id"] == str(legacy.pk)
            )
        )
        self.assertEqual(legacy_row["module"], "user")
        self.assertIsNone(legacy_row["target_type"])
        self.assertIsNone(legacy_row["target_id"])
        self.assertIsNone(legacy_row["outcome"])
        self.assertIsNone(legacy_row["new_state"])

    def test_policy_actor_snapshot_survives_missing_relationship_and_unknown_actor_stays_null(self):
        AnalyticsPolicyChange.objects.filter(pk=self.policy_change.pk).update(
            APCH_ACTOR=None,
        )
        unknown_actor_revision = AnalyticsPolicyChange.objects.create(
            APCH_VERSION=1,
            APCH_REASON="Initial approved analytics defaults.",
            APCH_BEFORE={},
            APCH_AFTER={"narrative_min_eligible_reviews": 3},
        )
        rows = {
            row["source_id"]: row
            for row in UnifiedActivityService.list_activity()
            if row["source_type"] == "analytics_policy_change"
        }

        self.assertEqual(rows[str(self.policy_change.pk)]["actor_id"], self.admin.pk)
        self.assertIsNone(rows[str(unknown_actor_revision.pk)]["actor_id"])
        self.assertIsNone(rows[str(unknown_actor_revision.pk)]["actor_role_snapshot"])

    def test_admin_classification_matches_explicit_flags_and_known_legacy_meanings(self):
        cases = (
            (AdminActivity.Action.USER_SUSPENDED, None),
            (AdminActivity.Action.REVIEW_DELETED_BY_AUTHOR, None),
            ("unknown_legacy_action", None),
            (AdminActivity.Action.USER_SUSPENDED, False),
            ("explicit_administrative_action", True),
        )
        expected = {}
        for action, classification in cases:
            event = AdminActivity.objects.create(
                ACTOR_ID=self.applicant,
                TARGET_USER_ID=self.applicant,
                AACT_ACTION=action,
                AACT_IS_ADMINISTRATIVE=classification,
            )
            expected[str(event.pk)] = event.is_administrative

        rows = {
            row["source_id"]: row
            for row in UnifiedActivityService.list_activity()
            if row["source_type"] == "admin_activity"
        }
        for source_id, classification in expected.items():
            with self.subTest(source_id=source_id):
                self.assertIs(rows[source_id]["is_administrative"], classification)

    def test_timestamp_order_is_global_across_all_sources(self):
        rows = list(UnifiedActivityService.list_activity())
        self.assertEqual(
            [row["source_type"] for row in rows],
            [
                "merchant_application_submission",
                "analytics_policy_change",
                "admin_activity",
            ],
        )

        AdminActivity.objects.filter(pk=self.activity.pk).update(
            AACT_CREATED_AT=self.now,
        )
        reordered = list(UnifiedActivityService.list_activity())
        self.assertEqual(
            [row["source_type"] for row in reordered],
            [
                "admin_activity",
                "merchant_application_submission",
                "analytics_policy_change",
            ],
        )

    def test_tied_timestamps_paginate_in_stable_source_and_text_identity_order(self):
        AdminActivity.objects.update(AACT_CREATED_AT=self.now)
        AnalyticsPolicyChange.objects.update(APCH_CREATED_AT=self.now)
        MerchantApplicationSubmission.objects.update(MASUB_SUBMITTED_AT=self.now)
        for source_id in (9, 100):
            event = AdminActivity.objects.create(
                AACT_ID=source_id,
                ACTOR_ID=self.admin,
                AACT_ACTION=AdminActivity.Action.ADMIN_CREATED,
            )
            AdminActivity.objects.filter(pk=event.pk).update(
                AACT_CREATED_AT=self.now,
            )

        paginator = Paginator(UnifiedActivityService.list_activity(), 2)
        with CaptureQueriesContext(connection) as queries:
            first_page = list(paginator.page(1).object_list)

        self.assertEqual(len(queries), 2)
        self.assertIn("UNION ALL", queries[-1]["sql"])
        self.assertIn("LIMIT 2", queries[-1]["sql"])
        self.assertEqual(paginator.count, 5)
        paged = [
            *first_page,
            *paginator.page(2).object_list,
            *paginator.page(3).object_list,
        ]
        expected = [
            ("admin_activity", "100"),
            ("admin_activity", "42"),
            ("admin_activity", "9"),
            ("analytics_policy_change", "42"),
            ("merchant_application_submission", "42"),
        ]
        self.assertEqual(
            [(row["source_type"], row["source_id"]) for row in paged],
            expected,
        )
        self.assertEqual(
            [
                (row["source_type"], row["source_id"])
                for row in UnifiedActivityService.list_activity()
            ],
            expected,
        )
