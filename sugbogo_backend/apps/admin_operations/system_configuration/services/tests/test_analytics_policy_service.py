"""Verify persisted policy reads, safety, and request consistency."""

from unittest.mock import patch

from django.db import connection, IntegrityError, transaction
from django.test import TestCase
from django.test.utils import CaptureQueriesContext

from apps.admin_operations.activity_management.models import AdminActivity
from apps.shared.analytics.policy import current_policy, policy_scope
from apps.users.models import User

from ...analytics_policy_definitions import POLICY_FIELDS
from ...models import AnalyticsPolicyConfiguration
from ..analytics_policy_service import AnalyticsPolicyService, AnalyticsPolicyUnavailable


def create_policy_admin():
    """Create a disposable active administrator for settings commands."""
    return User.objects.create_user(email="policy-super@example.com", password=None,
        USER_FNAME="Policy", USER_LNAME="Admin", USER_ROLE=User.UserRole.SUPER_ADMIN,
        USER_STATUS=User.UserStatus.ACTIVE)


class AnalyticsPolicyServiceTests(TestCase):
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
        initial_revision = AdminActivity.objects.get(
            AACT_SOURCE_TYPE=AdminActivity.POLICY_REVISION_SOURCE,
            AACT_CONTEXT__version=1,
        )
        self.assertEqual(initial_revision.AACT_NEW_STATE, dict(policy.values))
        self.assertIsNone(initial_revision.ACTOR_ID)
        self.assertIsNone(initial_revision.AACT_CONTEXT["actor_id_snapshot"])

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

    def test_database_constraints_also_protect_the_safety_floors(self):
        for spec in POLICY_FIELDS.values():
            with self.subTest(field=spec.model_field), self.assertRaises(IntegrityError), transaction.atomic():
                AnalyticsPolicyConfiguration.objects.filter(pk=1).update(**{spec.model_field: spec.minimum - 1})

    def test_request_snapshot_is_immutable_and_consistent_until_scope_ends(self):
        with policy_scope():
            original = current_policy()
            with self.assertRaises(TypeError):
                original.values["peer_min_businesses"] = 1
            AnalyticsPolicyConfiguration.objects.filter(pk=1).update(
                APC_PEER_MIN_BUSINESSES=6,
                APC_VERSION=2,
            )
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
