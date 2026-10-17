"""Policy safety, revision history, request consistency, and PostgreSQL concurrency."""

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch

from django.db import close_old_connections, connection, IntegrityError, transaction
from django.test import TestCase, TransactionTestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.shared.analytics.policy import current_policy, policy_scope
from apps.users.models import User

from ...analytics_policy_definitions import POLICY_FIELDS
from ...models import AnalyticsPolicyChange, AnalyticsPolicyConfiguration
from ..analytics_policy_service import AnalyticsPolicyConflict, AnalyticsPolicyService, AnalyticsPolicyUnavailable


def create_policy_admin():
    """Create a disposable active administrator for settings commands."""
    return User.objects.create_user(email="policy-super@example.com", password=None,
        USER_FNAME="Policy", USER_LNAME="Admin", USER_ROLE=User.UserRole.SUPER_ADMIN,
        USER_STATUS=User.UserStatus.ACTIVE)


class AnalyticsPolicyServiceTests(TestCase):
    def setUp(self):
        self.actor = create_policy_admin()

    def update(self, values, **overrides):
        return AnalyticsPolicyService.update(actor=self.actor, expected_version=1,
            reason="Review approved sample policy.", values=values, **overrides)

    def test_seeded_defaults_match_approved_analytics_behavior_and_reads_do_not_write(self):
        with CaptureQueriesContext(connection) as queries:
            policy = AnalyticsPolicyService.read()
        self.assertEqual(dict(policy.values), {
            "sentiment_min_classified_reviews": 5, "narrative_min_eligible_reviews": 5,
            "mention_min_supporting_reviews": 2, "peer_min_businesses": 5,
            "peer_positive_share_min_reviews": 5, "low_exposure_max_profile_visits": 4,
            "low_exposure_min_distinct_supporters": 5, "onboarding_comparison_min_sample": 10,
        })
        self.assertEqual(policy.version, 1)
        self.assertEqual(len(queries), 1)
        self.assertTrue(queries[0]["sql"].lstrip().upper().startswith("SELECT"))
        self.assertEqual(AnalyticsPolicyChange.objects.get(APCH_VERSION=1).APCH_AFTER, dict(policy.values))

    def test_missing_policy_fails_closed_and_does_not_reinitialize(self):
        AnalyticsPolicyConfiguration.objects.all().delete()
        with self.assertRaises(AnalyticsPolicyUnavailable):
            AnalyticsPolicyService.read()
        self.assertEqual(AnalyticsPolicyConfiguration.objects.count(), 0)

    def test_database_failure_is_sanitized(self):
        from django.db import OperationalError
        with patch.object(AnalyticsPolicyConfiguration.objects, "get", side_effect=OperationalError("private connection details")):
            with self.assertRaises(AnalyticsPolicyUnavailable) as error:
                AnalyticsPolicyService.read()
        self.assertNotIn("private", str(error.exception))

    def test_rejects_all_out_of_bounds_and_coerced_rules_before_writes(self):
        for name, spec in POLICY_FIELDS.items():
            for value in (spec.minimum - 1, spec.maximum + 1, True, "5", 5.5):
                with self.subTest(name=name, value=value), self.assertRaises(ValidationError):
                    self.update({name: value})
        self.assertEqual(AnalyticsPolicyService.read().version, 1)
        self.assertEqual(AnalyticsPolicyChange.objects.count(), 1)

    def test_database_constraints_also_protect_the_safety_floors(self):
        for spec in POLICY_FIELDS.values():
            with self.subTest(field=spec.model_field), self.assertRaises(IntegrityError), transaction.atomic():
                AnalyticsPolicyConfiguration.objects.filter(pk=1).update(**{spec.model_field: spec.minimum - 1})

    def test_forbids_coverage_scoring_and_entitlement_controls(self):
        for name in ("coverage_verified", "low_exposure_window_days", "specialty_score_weight", "merchant_plus_enforced"):
            with self.subTest(name=name), self.assertRaises(ValidationError):
                self.update({name: 1})

    def test_change_is_atomic_audited_and_preserves_admin_identity(self):
        before = dict(AnalyticsPolicyService.read().values)
        configuration, changed = self.update({"peer_min_businesses": 6})
        self.assertTrue(changed)
        self.assertEqual(configuration.APC_VERSION, 2)
        audit = AnalyticsPolicyChange.objects.get(APCH_VERSION=2)
        self.assertEqual(audit.APCH_BEFORE, before)
        self.assertEqual(audit.APCH_AFTER["peer_min_businesses"], 6)
        self.assertEqual(audit.APCH_ACTOR_ID_SNAPSHOT, self.actor.pk)

    def test_noop_keeps_version_timestamp_and_history_unchanged(self):
        before = AnalyticsPolicyService.read()
        configuration, changed = self.update({"peer_min_businesses": 5})
        self.assertFalse(changed)
        self.assertEqual(configuration.APC_VERSION, before.version)
        self.assertEqual(configuration.APC_UPDATED_AT, before.updated_at)
        self.assertEqual(AnalyticsPolicyChange.objects.count(), 1)

    def test_stale_update_cannot_overwrite_a_newer_revision(self):
        self.update({"peer_min_businesses": 6})
        with self.assertRaises(AnalyticsPolicyConflict):
            self.update({"peer_min_businesses": 7})
        self.assertEqual(AnalyticsPolicyService.read()["peer_min_businesses"], 6)

    def test_failed_audit_rolls_back_policy_change(self):
        with patch.object(AnalyticsPolicyChange.objects, "create", side_effect=RuntimeError("audit failed")):
            with self.assertRaises(RuntimeError):
                self.update({"peer_min_businesses": 6})
        self.assertEqual(AnalyticsPolicyService.read().version, 1)
        self.assertEqual(AnalyticsPolicyService.read()["peer_min_businesses"], 5)

    def test_non_super_or_inactive_actor_cannot_update_directly(self):
        self.actor.USER_ROLE = User.UserRole.ADMIN
        with self.assertRaises(PermissionDenied):
            self.update({"peer_min_businesses": 6})
        self.actor.USER_ROLE = User.UserRole.SUPER_ADMIN
        self.actor.USER_STATUS = User.UserStatus.DISABLED
        with self.assertRaises(PermissionDenied):
            self.update({"peer_min_businesses": 6})

    def test_requires_a_reason_and_integer_version(self):
        for reason, version in (("", 1), (" ", 1), ("x" * 1001, 1), ("reason", True), ("reason", "1")):
            with self.subTest(reason=reason[:8], version=version), self.assertRaises(ValidationError):
                AnalyticsPolicyService.update(actor=self.actor, expected_version=version, reason=reason, values={"peer_min_businesses": 6})

    def test_request_snapshot_is_immutable_and_consistent_until_scope_ends(self):
        with policy_scope():
            original = current_policy()
            with self.assertRaises(TypeError):
                original.values["peer_min_businesses"] = 1
            self.update({"peer_min_businesses": 6})
            self.assertIs(current_policy(), original)
            self.assertEqual(current_policy()["peer_min_businesses"], 5)
        self.assertEqual(current_policy().version, 2)

    def test_nested_scopes_read_once_and_exceptions_do_not_leak_policy(self):
        with self.assertNumQueries(1), policy_scope():
            first = current_policy()
            with policy_scope():
                self.assertIs(current_policy(), first)
        with self.assertRaises(RuntimeError), policy_scope():
            current_policy()
            raise RuntimeError("request failed")
        with self.assertNumQueries(1):
            current_policy()


class AnalyticsPolicyConcurrencyTests(TransactionTestCase):
    def setUp(self):
        if connection.vendor != "postgresql":
            self.skipTest("Policy update locking must be verified with PostgreSQL.")
        self.actor = create_policy_admin()
        AnalyticsPolicyConfiguration.objects.get_or_create(APC_ID=1)
        AnalyticsPolicyChange.objects.get_or_create(APCH_VERSION=1, defaults={
            "APCH_REASON": "Disposable concurrency baseline.", "APCH_BEFORE": {},
            "APCH_AFTER": dict(AnalyticsPolicyService.read().values)})

    def test_two_same_version_writers_produce_one_revision_and_one_conflict(self):
        barrier = Barrier(2)
        actor_id = self.actor.pk

        def write(value):
            close_old_connections()
            try:
                actor = User.objects.get(pk=actor_id)
                barrier.wait(timeout=10)
                AnalyticsPolicyService.update(actor=actor, expected_version=1,
                    reason="Concurrent settings update.", values={"peer_min_businesses": value})
                return "updated"
            except AnalyticsPolicyConflict:
                return "conflict"
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(write, value) for value in (6, 7)]
            results = [future.result(timeout=20) for future in futures]
        self.assertCountEqual(results, ["updated", "conflict"])
        self.assertEqual(AnalyticsPolicyService.read().version, 2)
        self.assertEqual(AnalyticsPolicyChange.objects.filter(APCH_VERSION=2).count(), 1)
