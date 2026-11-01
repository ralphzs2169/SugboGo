"""Focused tests for the bounded, safe Dashboard administrative-decision feed."""

from datetime import timedelta
from unittest.mock import patch

from django.db import DatabaseError, connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils.dateparse import parse_datetime
from rest_framework.test import APITestCase

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.activity_management.services import AdminActivityService
from apps.admin_operations.dashboard.recent_decision_serializers import (
    RecentDecisionsSerializer,
)
from apps.admin_operations.dashboard.recent_decisions_service import (
    RecentDecisionsService,
)
from apps.admin_operations.dashboard.tests import DashboardFixtures
from apps.business.models import Business
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationIdentity,
    MerchantApplicationReview,
)
from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin


class RecentDecisionFixtures(DashboardFixtures):
    """Build recorded decisions independently of unrelated workflow side effects."""

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.admin = User.objects.create(
            USER_EMAIL="recent-decisions-admin@example.com",
            USER_FNAME="Ana",
            USER_LNAME="Reviewer",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
            password="!",
        )
        cls.target = User.objects.create(
            USER_EMAIL="recent-decisions-target@example.com",
            USER_FNAME="Affected",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
            password="!",
        )

    def application_decision(
        self,
        decision=MerchantApplicationReview.Decision.APPROVED,
        timestamp=None,
        application=None,
        **fields,
    ):
        if application is None:
            application = self.create_application()
        if timestamp is None:
            timestamp = self.NOW

        return MerchantApplicationReview.objects.create(
            MAPP_ID=application,
            USER_ID=self.admin,
            MAREV_DECISION=decision,
            MAREV_REVIEWED_AT=timestamp,
            **fields,
        )

    def activity(
        self,
        action=AdminActivity.Action.USER_SUSPENDED,
        context=None,
        timestamp=None,
        actor=None,
    ):
        if actor is None:
            actor = self.admin
        activity = AdminActivityService.record_user_action(
            actor=actor,
            target_user=self.target,
            action=action,
            context=context,
        )
        if timestamp is not None:
            AdminActivity.objects.filter(pk=activity.pk).update(
                AACT_CREATED_AT=timestamp,
            )
        return activity

    def serialized_feed(self):
        return RecentDecisionsSerializer(
            RecentDecisionsService.get_recent_decisions(),
        ).data["items"]


class RecentDecisionsServiceTests(RecentDecisionFixtures, TestCase):
    """Protect normalization, bounded ordering, hydration, and metadata privacy."""

    def test_application_approval_and_rejection_use_recorded_decision_and_time(self):
        business = self.create_business()
        Business.objects.filter(pk=business.pk).update(BUSN_NAME="Current cafe")
        approved_application = self.create_application()
        approved_application.BUSN_ID = business
        approved_application.save(update_fields=["BUSN_ID"])
        rejected_application = self.create_application()
        MerchantApplicationIdentity.objects.create(
            MAPP_ID=rejected_application,
            CLUS_ID=self.cluster,
            CTGRY_ID=self.category,
            MIDN_BUSINESS_NAME="Submitted bakery",
            MIDN_CONTACT_NUMBER="09170000000",
            MIDN_REPRESENTATIVE_NAME="Merchant",
            MIDN_REPRESENTATIVE_ROLE=(
                MerchantApplicationIdentity.RepresentativeRole.OWNER
            ),
        )
        approved = self.application_decision(
            application=approved_application,
            timestamp=self.NOW - timedelta(hours=2),
        )
        rejected = self.application_decision(
            decision=MerchantApplicationReview.Decision.REJECTED,
            application=rejected_application,
            timestamp=self.NOW - timedelta(hours=1),
        )

        items = self.serialized_feed()

        self.assertEqual(
            [item["id"] for item in items],
            [
                f"application_review:{rejected.pk}",
                f"application_review:{approved.pk}",
            ],
        )
        self.assertEqual(items[0]["action"], "application_rejected")
        self.assertEqual(items[0]["action_label"], "Application rejected")
        self.assertEqual(items[1]["action_label"], "Application approved")
        self.assertEqual(items[0]["entity"]["label"], "Submitted bakery")
        self.assertEqual(items[1]["entity"]["label"], "Current cafe")
        self.assertEqual(items[0]["entity"]["type"], "merchant_application")
        self.assertEqual(items[0]["entity"]["id"], rejected_application.pk)
        self.assertEqual(items[0]["administrator_name"], self.admin.full_name)
        self.assertEqual(
            parse_datetime(items[0]["timestamp"]),
            rejected.MAREV_REVIEWED_AT,
        )
        # Both application records are still submitted: persistence, not current
        # application status, determines the historical decision being displayed.
        self.assertEqual(
            rejected_application.MAPP_STATUS,
            MerchantApplication.ApplicationStatus.SUBMITTED,
        )

    def test_application_uses_current_business_name_before_application_identity(self):
        business = self.create_business()
        application = self.create_application()
        application.BUSN_ID = business
        application.save(update_fields=["BUSN_ID"])
        MerchantApplicationIdentity.objects.create(
            MAPP_ID=application,
            CLUS_ID=self.cluster,
            CTGRY_ID=self.category,
            MIDN_BUSINESS_NAME="Original application name",
            MIDN_CONTACT_NUMBER="09170000000",
            MIDN_REPRESENTATIVE_NAME="Merchant",
            MIDN_REPRESENTATIVE_ROLE=(
                MerchantApplicationIdentity.RepresentativeRole.OWNER
            ),
        )
        self.application_decision(application=application)
        Business.objects.filter(pk=business.pk).update(BUSN_NAME="Renamed cafe")

        self.assertEqual(
            self.serialized_feed()[0]["entity"]["label"],
            "Renamed cafe",
        )

    def test_missing_application_identity_has_safe_application_fallback(self):
        review = self.application_decision()

        self.assertEqual(
            self.serialized_feed()[0]["entity"]["label"],
            f"Application #{review.MAPP_ID_id}",
        )
        # A deletion between the bounded source read and label hydration is safe.
        with patch.object(MerchantApplication.objects, "filter") as applications:
            applications.return_value.values.return_value = []
            self.assertEqual(
                self.serialized_feed()[0]["entity"]["label"],
                f"Application #{review.MAPP_ID_id}",
            )

    def test_explicit_allowlist_supports_exact_recorded_decision_categories(self):
        business = self.create_business()
        cases = (
            (
                "business_name_change_approved",
                "Business name change approved",
                "business_name_change_request",
                31,
            ),
            (
                "business_name_change_rejected",
                "Business name change rejected",
                "business_name_change_request",
                31,
            ),
            (
                "business_classification_change_approved",
                "Classification change approved",
                "business_classification_change_request",
                31,
            ),
            (
                "business_classification_change_rejected",
                "Classification change rejected",
                "business_classification_change_request",
                31,
            ),
            (
                "business_location_change_approved",
                "Location change approved",
                "business_location_change_request",
                31,
            ),
            (
                "business_location_change_rejected",
                "Location change rejected",
                "business_location_change_request",
                31,
            ),
            (
                "review_moderation_approved",
                "Review published",
                "review",
                32,
            ),
            (
                "review_moderation_rejected",
                "Review rejected",
                "review",
                32,
            ),
            (
                "review_dispute_upheld",
                "Dispute upheld",
                "review_dispute",
                33,
            ),
            (
                "review_dispute_dismissed",
                "Dispute dismissed",
                "review_dispute",
                33,
            ),
            (
                "review_report_approved",
                "Review report approved",
                "review",
                32,
            ),
            (
                "review_report_rejected",
                "Review report rejected",
                "review",
                32,
            ),
            (
                "reported_review_kept",
                "Reported review kept",
                "review",
                32,
            ),
            (
                "reported_review_rejected",
                "Reported review rejected",
                "review",
                32,
            ),
            (
                "user_suspended",
                "User suspended",
                "user",
                self.target.pk,
            ),
            (
                "user_reactivated",
                "User reactivated",
                "user",
                self.target.pk,
            ),
        )
        for action, label, entity_type, entity_id in cases:
            with self.subTest(action=action):
                activity = self.activity(
                    action=action,
                    context={
                        "request_id": 31,
                        "review_id": 32,
                        "dispute_id": 33,
                        "business_id": business.pk,
                    },
                )
                item = self.serialized_feed()[0]
                self.assertEqual(item["id"], f"admin_activity:{activity.pk}")
                self.assertEqual(item["action"], action)
                self.assertEqual(item["action_label"], label)
                self.assertEqual(item["entity"]["type"], entity_type)
                self.assertEqual(item["entity"]["id"], entity_id)
                if entity_type == "user":
                    self.assertEqual(item["entity"]["label"], self.target.full_name)
                else:
                    self.assertIn(business.BUSN_NAME, item["entity"]["label"])
                activity.delete()

    def test_author_deletion_admin_creation_and_unknown_activity_are_excluded(self):
        self.activity(
            action=AdminActivity.Action.REVIEW_DELETED_BY_AUTHOR,
            actor=self.target,
            context={"review_id": 15},
        )
        self.activity(action=AdminActivity.Action.ADMIN_CREATED)
        self.activity(action="unsupported_action")
        self.application_decision(decision="unsupported_decision")

        self.assertEqual(self.serialized_feed(), [])

    def test_sources_merge_by_timestamp_and_return_only_global_latest_five(self):
        expected = []
        for age in range(8):
            review = self.application_decision(
                timestamp=self.NOW - timedelta(minutes=age * 2),
            )
            activity = self.activity(
                timestamp=self.NOW - timedelta(minutes=age * 2 + 1),
            )
            expected.extend([
                f"application_review:{review.pk}",
                f"admin_activity:{activity.pk}",
            ])

        with CaptureQueriesContext(connection) as queries:
            items = self.serialized_feed()

        self.assertEqual([item["id"] for item in items], expected[:5])
        self.assertEqual(len(items), 5)
        source_queries = [
            query["sql"]
            for query in queries
            if (
                'FROM "MERCHANT_APPLICATION_REVIEW"' in query["sql"]
                or 'FROM "ADMIN_ACTIVITY"' in query["sql"]
            )
        ]
        self.assertEqual(len(source_queries), 2)
        for sql in source_queries:
            self.assertIn("LIMIT 5", sql)

    def test_tied_timestamps_use_source_then_descending_numeric_id(self):
        applications = [self.application_decision() for _ in range(7)]
        activities = [self.activity() for _ in range(7)]

        items = self.serialized_feed()

        self.assertEqual(
            [item["id"] for item in items],
            [
                f"application_review:{review.pk}"
                for review in reversed(applications[-5:])
            ],
        )
        self.assertEqual(items, self.serialized_feed())
        MerchantApplicationReview.objects.all().delete()
        self.assertEqual(
            [item["id"] for item in self.serialized_feed()],
            [
                f"admin_activity:{activity.pk}"
                for activity in reversed(activities[-5:])
            ],
        )

    def test_source_qualified_identifiers_do_not_collide(self):
        review = self.application_decision()
        activity = self.activity()
        # Numeric primary keys can overlap across the independent source tables.
        AdminActivity.objects.filter(pk=activity.pk).update(AACT_ID=review.pk)

        self.assertEqual(
            {item["id"] for item in self.serialized_feed()},
            {f"application_review:{review.pk}", f"admin_activity:{review.pk}"},
        )

    def test_deleted_business_and_review_targets_keep_safe_labels(self):
        business = self.create_business()
        business_id = business.pk
        self.activity(
            action=AdminActivity.Action.BUSINESS_LOCATION_CHANGE_APPROVED,
            context={"request_id": 12, "business_id": business_id},
        )
        self.activity(
            action=AdminActivity.Action.REVIEW_MODERATION_REJECTED,
            context={"review_id": 13, "business_id": business_id},
        )
        self.activity(
            action=AdminActivity.Action.REVIEW_DISPUTE_UPHELD,
            context={"dispute_id": 14, "business_id": business_id},
        )
        business.delete()

        items = self.serialized_feed()

        self.assertEqual(
            [item["entity"]["label"] for item in items],
            ["Dispute #14", "Review #13", "Business unavailable"],
        )

    def test_unavailable_users_and_unnamed_actor_do_not_break_feed(self):
        self.activity()
        with patch.object(
            RecentDecisionsService,
            "_hydrate_labels",
            return_value={"users": {}, "businesses": {}, "applications": {}},
        ):
            item = self.serialized_feed()[0]
        self.assertEqual(item["administrator_name"], "Administrator unavailable")
        self.assertEqual(item["entity"]["label"], "User unavailable")

        User.objects.filter(pk=self.admin.pk).update(USER_FNAME="", USER_LNAME="")
        self.assertEqual(
            self.serialized_feed()[0]["administrator_name"],
            "Administrator unavailable",
        )

    def test_malformed_context_uses_null_identifiers_and_safe_fallbacks(self):
        activity = self.activity(
            action=AdminActivity.Action.REVIEW_MODERATION_APPROVED,
        )
        for context in (
            [],
            "internal-context",
            {"review_id": True, "business_id": -1},
            {"review_id": "private-device", "business_id": 10 ** 100},
            {"review_id": {"fingerprint": "secret"}},
        ):
            with self.subTest(context=context):
                AdminActivity.objects.filter(pk=activity.pk).update(
                    AACT_CONTEXT=context,
                )
                item = self.serialized_feed()[0]
                self.assertIsNone(item["entity"]["id"])
                self.assertEqual(item["entity"]["label"], "Review unavailable")

    def test_serialized_events_exclude_internal_metadata_and_administrator_email(self):
        self.application_decision(
            MAREV_SECTION_FINGERPRINTS={"internal_fingerprint": "private-hash"},
            MAREV_DUPLICATE_EXPLANATION="Private duplicate explanation",
        )
        self.activity(
            action=AdminActivity.Action.REVIEW_REPORT_APPROVED,
            context={
                "review_id": 73,
                "business_id": 74,
                "reporter_id": 75,
                "report_ids": [76, 77],
                "admin_notes": "Private admin notes",
                "installation_id": "private-device",
                "ip_address": "192.0.2.123",
                "decision_content_fingerprint": "private-hash",
                "moderation_metadata": {"secret": "private-content"},
            },
        )

        items = self.serialized_feed()
        serialized = str(items)

        for item in items:
            self.assertEqual(
                set(item),
                {
                    "id",
                    "action",
                    "action_label",
                    "entity",
                    "administrator_name",
                    "timestamp",
                },
            )
            self.assertEqual(set(item["entity"]), {"type", "id", "label"})
        for private_value in (
            self.admin.USER_EMAIL,
            "context",
            "private-hash",
            "Private duplicate explanation",
            "Private admin notes",
            "private-device",
            "192.0.2.123",
            "private-content",
            "reporter_id",
            "report_ids",
            "_administrator_id",
            "_business_id",
        ):
            self.assertNotIn(private_value, serialized)

    def test_five_mixed_events_use_batched_hydration_in_five_queries(self):
        business = self.create_business()
        for index in range(2):
            self.application_decision(
                timestamp=self.NOW - timedelta(minutes=index),
            )
        for index in range(3):
            self.activity(
                action=AdminActivity.Action.BUSINESS_NAME_CHANGE_APPROVED,
                context={"request_id": index + 1, "business_id": business.pk},
                timestamp=self.NOW - timedelta(minutes=index + 2),
            )

        with self.assertNumQueries(5):
            items = self.serialized_feed()

        self.assertEqual(len(items), 5)

    def test_either_source_failure_fails_instead_of_returning_partial_feed(self):
        self.application_decision()
        self.activity()
        for model in (MerchantApplicationReview, AdminActivity):
            with (
                self.subTest(source=model.__name__),
                patch.object(
                    model.objects,
                    "filter",
                    side_effect=DatabaseError("Source unavailable"),
                ),
            ):
                with self.assertRaisesMessage(DatabaseError, "Source unavailable"):
                    RecentDecisionsService.get_recent_decisions()

    def test_empty_feed_uses_only_two_source_queries(self):
        with self.assertNumQueries(2):
            self.assertEqual(
                RecentDecisionsService.get_recent_decisions(),
                {"items": []},
            )


class RecentDecisionsViewTests(
    RecentDecisionFixtures,
    APIResponseAssertionsMixin,
    APITestCase,
):
    """Protect independent feed response semantics and server-side authorization."""

    def test_admin_and_super_admin_can_load_empty_feed(self):
        for role in (User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN):
            with self.subTest(role=role):
                self.client.force_authenticate(
                    user=self.create_user(role=role),
                )
                response = self.client.get(
                    reverse("admin-dashboard-recent-decisions"),
                )

                self.assertSuccessResponse(
                    response,
                    message="Recent administrative decisions retrieved successfully.",
                )
                self.assertEqual(response.data["data"], {"items": []})

    def test_endpoint_returns_safe_normalized_decisions_without_loading_summary(self):
        activity = self.activity()
        self.client.force_authenticate(user=self.admin)
        with patch(
            "apps.admin_operations.dashboard.services.DashboardSummaryService.get_summary",
            side_effect=AssertionError("Summary must remain independent"),
        ):
            response = self.client.get(
                reverse("admin-dashboard-recent-decisions"),
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["data"]["items"],
            [{
                "id": f"admin_activity:{activity.pk}",
                "action": "user_suspended",
                "action_label": "User suspended",
                "entity": {
                    "type": "user",
                    "id": self.target.pk,
                    "label": self.target.full_name,
                },
                "administrator_name": self.admin.full_name,
                "timestamp": "2026-11-06T12:00:00Z",
            }],
        )

    def test_unauthorized_roles_and_inactive_admins_are_rejected(self):
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
                response = self.client.get(
                    reverse("admin-dashboard-recent-decisions"),
                )
                self.assertEqual(response.status_code, 403)
                self.assertFalse(response.data["success"])

    def test_unauthenticated_request_is_rejected(self):
        response = self.client.get(reverse("admin-dashboard-recent-decisions"))

        self.assertEqual(response.status_code, 401)
        self.assertFalse(response.data["success"])

    def test_endpoint_returns_no_more_than_five_events(self):
        for _ in range(7):
            self.activity()
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(reverse("admin-dashboard-recent-decisions"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["data"]["items"]), 5)
