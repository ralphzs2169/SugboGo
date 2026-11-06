from unittest.mock import patch
from uuid import UUID

from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError
from django.test import TestCase, TransactionTestCase
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.activity_management.services import (
    AdminActivityService,
)
from apps.admin_operations.activity_management.serializers import (
    AdminActivitySerializer,
)
from apps.users.models import User


class AdminActivityServiceTests(TestCase):
    """Covers legacy history and the generalized transactional event contract."""

    @classmethod
    def setUpTestData(cls):
        """Creates an administrator and review author for audit records."""
        cls.admin = User.objects.create(
            USER_EMAIL="moderation-admin@example.com",
            USER_FNAME="Admin",
            USER_LNAME="Moderator",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
            password="!",
        )
        cls.author = User.objects.create(
            USER_EMAIL="review-author@example.com",
            USER_FNAME="Review",
            USER_LNAME="Author",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
            password="!",
        )

    def test_direct_review_moderation_actions_are_valid_and_recordable(self):
        """Records distinct approval and rejection actions through the service."""
        actions = (
            (
                AdminActivity.Action.REVIEW_MODERATION_APPROVED,
                "review_moderation_approved",
            ),
            (
                AdminActivity.Action.REVIEW_MODERATION_REJECTED,
                "review_moderation_rejected",
            ),
        )
        valid_choices = dict(
            AdminActivity._meta.get_field("AACT_ACTION").choices,
        )

        for action, expected_value in actions:
            with self.subTest(action=expected_value):
                self.assertEqual(action.value, expected_value)
                self.assertIn(expected_value, valid_choices)

                activity = AdminActivityService.record_user_action(
                    actor=self.admin,
                    target_user=self.author,
                    action=action,
                    context={"review_id": 42},
                )

                activity.full_clean()
                activity.refresh_from_db()
                self.assertEqual(activity.AACT_ACTION, expected_value)
                self.assertEqual(activity.ACTOR_ID, self.admin)
                self.assertEqual(activity.TARGET_USER_ID, self.author)
                self.assertEqual(activity.AACT_CONTEXT, {"review_id": 42})

        self.assertEqual(AdminActivity.objects.count(), 2)

    def record_event(
        self,
        **overrides,
    ):
        """Record one existing business action with a generalized target."""
        values = {
            "actor": self.admin,
            "action": AdminActivity.Action.BUSINESS_SUSPENDED,
            "module": AdminActivity.Module.BUSINESS,
            "target_type": "business",
            "target_id": 42,
        }
        values.update(overrides)
        return AdminActivityService.record_event(**values)

    def test_event_can_target_non_user_without_live_target_or_subject(self):
        event = self.record_event(target_label="Cebu Store")

        event.full_clean()
        event.refresh_from_db()
        self.assertIsNone(event.TARGET_USER_ID_id)
        self.assertEqual(event.AACT_TARGET_TYPE, "business")
        self.assertEqual(event.AACT_TARGET_ID, "42")
        self.assertEqual(event.AACT_TARGET_LABEL, "Cebu Store")
        self.assertEqual(event.AACT_ACTOR_NAME, self.admin.full_name)
        self.assertEqual(event.AACT_ACTOR_ROLE, User.UserRole.ADMIN)
        self.assertEqual(event.AACT_MODULE, AdminActivity.Module.BUSINESS)
        self.assertEqual(event.AACT_OUTCOME, AdminActivity.Outcome.SUCCEEDED)
        self.assertTrue(event.AACT_IS_ADMINISTRATIVE)
        self.assertTrue(event.is_administrative)
        self.assertIsNotNone(event.AACT_CREATED_AT)

    def test_optional_states_reason_and_safe_context_are_persisted(self):
        previous_state = {"status": "active", "is_active": True}
        new_state = {"status": "suspended", "is_active": False}
        context = {"business_id": 42, "request_id": None}
        event = self.record_event(
            previous_state=previous_state,
            new_state=new_state,
            reason=" Listing requires correction. ",
            context=context,
        )

        event.refresh_from_db()
        self.assertEqual(event.AACT_PREVIOUS_STATE, previous_state)
        self.assertEqual(event.AACT_NEW_STATE, new_state)
        self.assertEqual(event.AACT_REASON, "Listing requires correction.")
        self.assertEqual(event.AACT_CONTEXT, context)

    def test_missing_optional_event_information_remains_null(self):
        event = self.record_event()

        event.refresh_from_db()
        for field in (
            "AACT_PREVIOUS_STATE",
            "AACT_NEW_STATE",
            "AACT_REASON",
            "AACT_TARGET_LABEL",
            "AACT_SOURCE_TYPE",
            "AACT_SOURCE_ID",
        ):
            with self.subTest(field=field):
                self.assertIsNone(getattr(event, field))
        self.assertEqual(event.AACT_CONTEXT, {})

    def test_user_history_and_legacy_serializer_remain_compatible(self):
        legacy_context = {
            "review_id": 42,
            "pending_reports": [{"id": 7, "previous_status": "pending"}],
        }
        legacy = AdminActivityService.record_user_action(
            actor=self.author,
            target_user=self.author,
            action=AdminActivity.Action.REVIEW_DELETED_BY_AUTHOR,
            context=legacy_context,
        )
        current = self.record_event(target_user=self.author)
        self.record_event(target_id=43)

        history = list(AdminActivityService.list_for_user(self.author))
        self.assertEqual(history, [current, legacy])
        self.assertEqual(legacy.AACT_CONTEXT, legacy_context)
        payload = AdminActivitySerializer(legacy).data
        self.assertEqual(
            set(payload),
            {"id", "action", "actor", "timestamp", "context"},
        )
        self.assertEqual(payload["context"], legacy_context)
        self.assertEqual(payload["actor"]["id"], self.author.pk)
        self.assertFalse(legacy.is_administrative)

    def test_legacy_rows_remain_valid_without_new_fields_or_fabricated_snapshots(self):
        event = AdminActivity.objects.create(
            ACTOR_ID=self.admin,
            TARGET_USER_ID=self.author,
            AACT_ACTION=AdminActivity.Action.USER_REACTIVATED,
        )

        event.full_clean()
        event.refresh_from_db()
        for field in (
            "AACT_MODULE",
            "AACT_TARGET_TYPE",
            "AACT_TARGET_ID",
            "AACT_TARGET_LABEL",
            "AACT_ACTOR_NAME",
            "AACT_ACTOR_ROLE",
            "AACT_IS_ADMINISTRATIVE",
            "AACT_PREVIOUS_STATE",
            "AACT_NEW_STATE",
            "AACT_REASON",
            "AACT_OUTCOME",
        ):
            with self.subTest(field=field):
                self.assertIsNone(getattr(event, field))
        self.assertTrue(event.is_administrative)

    def test_known_legacy_actions_are_classified_by_meaning_not_actor_current_role(self):
        self.admin.USER_ROLE = User.UserRole.EXPLORER
        self.admin.save(update_fields=["USER_ROLE"])

        for action in AdminActivity.Action.values:
            with self.subTest(action=action):
                event = AdminActivity.objects.create(
                    ACTOR_ID=self.admin,
                    TARGET_USER_ID=self.author,
                    AACT_ACTION=action,
                )
                self.assertEqual(
                    event.is_administrative,
                    action != "review_deleted_by_author",
                )
        unknown = AdminActivity(AACT_ACTION="unknown_legacy_activity")
        self.assertIsNone(unknown.is_administrative)

    def test_source_retries_return_original_event_without_overwriting_snapshots(self):
        first = self.record_event(
            source_type="business_status_decision",
            source_id=7,
            target_label="Original store name",
        )
        self.admin.USER_FNAME = "Renamed"
        self.admin.save(update_fields=["USER_FNAME"])
        second = self.record_event(
            source_type="business_status_decision",
            source_id="007",
            target_label="Current store name",
        )

        self.assertEqual(first.pk, second.pk)
        self.assertEqual(AdminActivity.objects.count(), 1)
        self.assertEqual(second.AACT_CREATED_AT, first.AACT_CREATED_AT)
        self.assertEqual(second.AACT_TARGET_LABEL, "Original store name")
        self.assertEqual(second.AACT_ACTOR_NAME, "Admin Moderator")

    def test_conflicting_reuse_of_source_is_rejected(self):
        first = self.record_event(
            source_type="business_status_decision",
            source_id=7,
        )

        with self.assertRaises(ValidationError):
            self.record_event(
                source_type="business_status_decision",
                source_id=7,
                target_id=99,
            )

        self.assertEqual(AdminActivity.objects.count(), 1)
        first.refresh_from_db()
        self.assertEqual(first.AACT_TARGET_ID, "42")

    def test_source_namespace_distinguishes_records_and_unsourced_events_can_repeat(self):
        self.record_event(source_type="application_review", source_id=7)
        self.record_event(source_type="duplicate_assessment", source_id=7)
        self.record_event()
        self.record_event()

        self.assertEqual(AdminActivity.objects.count(), 4)

    def test_database_prevents_duplicate_source_records(self):
        first = self.record_event(source_type="application_review", source_id=7)

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                AdminActivity.objects.create(
                    ACTOR_ID=self.admin,
                    AACT_ACTION=first.AACT_ACTION,
                    AACT_SOURCE_TYPE=first.AACT_SOURCE_TYPE,
                    AACT_SOURCE_ID=first.AACT_SOURCE_ID,
                )

        self.assertEqual(AdminActivity.objects.count(), 1)

    def test_incomplete_or_blank_target_and_source_pairs_fail_database_constraints(self):
        invalid_pairs = (
            {"AACT_TARGET_TYPE": "business"},
            {"AACT_TARGET_ID": "42"},
            {"AACT_TARGET_TYPE": "", "AACT_TARGET_ID": "42"},
            {"AACT_SOURCE_TYPE": "application_review"},
            {"AACT_SOURCE_ID": "7"},
            {"AACT_SOURCE_TYPE": "application_review", "AACT_SOURCE_ID": ""},
        )

        for fields in invalid_pairs:
            with self.subTest(fields=fields):
                with self.assertRaises(IntegrityError):
                    with transaction.atomic():
                        AdminActivity.objects.create(
                            ACTOR_ID=self.admin,
                            AACT_ACTION=AdminActivity.Action.BUSINESS_SUSPENDED,
                            **fields,
                        )

    def test_missing_source_half_and_invalid_identifiers_are_rejected(self):
        invalid_inputs = (
            {"source_type": "application_review"},
            {"source_id": 7},
            {"source_type": "application_review", "source_id": ""},
            {"target_id": 0},
            {"target_id": True},
            {"target_type": "business record"},
        )

        for fields in invalid_inputs:
            with self.subTest(fields=fields):
                with self.assertRaises(ValidationError):
                    self.record_event(**fields)

        self.assertFalse(AdminActivity.objects.exists())

    def test_uuid_identities_are_canonicalized(self):
        identity = UUID("12345678-1234-5678-abcd-123456789abc")
        first = self.record_event(
            target_id=identity,
            source_type="application_review",
            source_id=identity,
        )
        second = self.record_event(
            target_id=str(identity).upper(),
            source_type="application_review",
            source_id=str(identity).upper(),
        )

        self.assertEqual(first.pk, second.pk)
        self.assertEqual(second.AACT_TARGET_ID, str(identity))
        self.assertEqual(second.AACT_SOURCE_ID, str(identity))

    def test_decision_rejection_is_success_and_async_acceptance_is_distinct(self):
        rejected = self.record_event(
            action=AdminActivity.Action.REVIEW_MODERATION_REJECTED,
            module=AdminActivity.Module.REVIEW_MODERATION,
            target_type="review",
            new_state={"status": "rejected"},
            reason="The content violates review policy.",
        )
        accepted = self.record_event(
            target_id=43,
            outcome=AdminActivity.Outcome.ACCEPTED,
        )

        self.assertEqual(rejected.AACT_OUTCOME, "succeeded")
        self.assertEqual(rejected.AACT_NEW_STATE, {"status": "rejected"})
        self.assertEqual(accepted.AACT_OUTCOME, "accepted")
        with self.assertRaises(ValidationError):
            self.record_event(outcome="rejected")
        with self.assertRaises(ValidationError):
            self.record_event(outcome="failed")

    def test_author_activity_unknown_actions_and_incorrect_modules_are_rejected(self):
        invalid_inputs = (
            {"action": AdminActivity.Action.REVIEW_DELETED_BY_AUTHOR},
            {"action": "unregistered_action"},
            {"module": AdminActivity.Module.TRANSIT},
        )

        for fields in invalid_inputs:
            with self.subTest(fields=fields):
                with self.assertRaises(ValidationError):
                    self.record_event(**fields)

    def test_only_active_administrators_can_use_standardized_recorder(self):
        with self.assertRaises(PermissionDenied):
            self.record_event(actor=self.author)

        self.admin.USER_STATUS = User.UserStatus.SUSPENDED
        with self.assertRaises(PermissionDenied):
            self.record_event()

        self.admin.USER_STATUS = User.UserStatus.ACTIVE
        self.admin.USER_ROLE = User.UserRole.SUPER_ADMIN
        self.assertTrue(self.record_event().is_administrative)

    def test_user_target_can_retain_history_relationship_and_cannot_misidentify_user(self):
        event = self.record_event(
            action=AdminActivity.Action.USER_SUSPENDED,
            module=AdminActivity.Module.USER,
            target_type="user",
            target_id=self.author.pk,
            target_user=self.author,
        )

        self.assertEqual(list(AdminActivityService.list_for_user(self.author)), [event])
        with self.assertRaises(ValidationError):
            self.record_event(
                target_type="user",
                target_id=self.admin.pk,
                target_user=self.author,
            )
        with self.assertRaises(ProtectedError):
            self.author.delete()
        with self.assertRaises(ProtectedError):
            self.admin.delete()

    def test_sensitive_unknown_and_nested_payloads_are_not_persisted(self):
        prohibited_keys = (
            "password",
            "access_token",
            "invitation_link",
            "verification_document",
            "duplicate_contact_evidence",
            "device_id",
            "payment_provider_payload",
            "request_body",
        )

        for field in ("context", "previous_state", "new_state"):
            for key in prohibited_keys:
                with self.subTest(field=field, key=key):
                    with self.assertRaises(ValidationError):
                        self.record_event(**{field: {key: "private"}})

        for fields in (
            {"context": {"decision": {"access_token": "private"}}},
            {"new_state": {"status": [{"password": "private"}]}},
            {"context": self.author},
            {"new_state": {"name": "x" * 2001}},
            {"context": {"report_ids": list(range(101))}},
            {"previous_state": {"status": float("nan")}},
        ):
            with self.subTest(fields=fields):
                with self.assertRaises(ValidationError):
                    self.record_event(**fields)

        self.assertFalse(AdminActivity.objects.exists())

    def test_event_and_state_change_roll_back_with_surrounding_transaction(self):
        with self.assertRaises(RuntimeError):
            with transaction.atomic():
                self.author.USER_STATUS = User.UserStatus.SUSPENDED
                self.author.save(update_fields=["USER_STATUS"])
                self.record_event(target_user=self.author)
                self.assertTrue(AdminActivity.objects.exists())
                raise RuntimeError("The administrative operation failed.")

        self.author.refresh_from_db()
        self.assertEqual(self.author.USER_STATUS, User.UserStatus.ACTIVE)
        self.assertFalse(AdminActivity.objects.exists())

    def test_audit_insertion_failure_propagates_and_rolls_back_state_change(self):
        with patch.object(
            AdminActivity.objects,
            "create",
            side_effect=IntegrityError("Audit insert failed"),
        ):
            with self.assertRaises(IntegrityError):
                with transaction.atomic():
                    self.author.USER_STATUS = User.UserStatus.SUSPENDED
                    self.author.save(update_fields=["USER_STATUS"])
                    self.record_event()

        self.author.refresh_from_db()
        self.assertEqual(self.author.USER_STATUS, User.UserStatus.ACTIVE)
        self.assertFalse(AdminActivity.objects.exists())


class AdminActivityTransactionTests(TransactionTestCase):
    """Require the standardized recorder to participate in its caller's transaction."""

    def test_standardized_recorder_rejects_autocommit_but_legacy_writer_remains_usable(self):
        admin = User.objects.create(
            USER_EMAIL="transaction-admin@example.com",
            USER_FNAME="Transaction",
            USER_LNAME="Admin",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
            password="!",
        )

        with self.assertRaises(ValidationError):
            AdminActivityService.record_event(
                actor=admin,
                action=AdminActivity.Action.USER_SUSPENDED,
                module=AdminActivity.Module.USER,
                target_type="user",
                target_id=admin.pk,
            )

        self.assertFalse(AdminActivity.objects.exists())
        legacy = AdminActivityService.record_user_action(
            actor=admin,
            target_user=admin,
            action=AdminActivity.Action.ADMIN_CREATED,
        )
        self.assertIsNotNone(legacy.pk)
