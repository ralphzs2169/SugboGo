from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory

from apps.admin_operations.analytics.views import DiscoveryScoreRecomputeView
from apps.business.services.discovery_score_service import (
    DiscoveryScoreRecomputeInProgress,
    DiscoveryScoreService,
)
from apps.business.tasks import recompute_discovery_scores
from core.exceptions import custom_exception_handler


class DiscoveryScoreBatchGuardTests(SimpleTestCase):
    """Verify shared batch ownership without connecting to a database."""

    def setUp(self):
        """Replace only connection ownership and the unchanged scoring body."""
        self.owner = MagicMock()
        self.cursor = self.owner.cursor.return_value.__enter__.return_value
        self.cursor.fetchone.return_value = [True]
        self.connections = patch(
            "apps.business.services.discovery_score_service.connections",
        ).start()
        self.connections.__getitem__.return_value.copy.return_value = self.owner
        self.body = patch.object(
            DiscoveryScoreService,
            "_recompute_business_scores",
            return_value=SimpleNamespace(
                considered_count=1,
                updated_count=1,
                stale_count=0,
                failed_count=0,
                failures=[],
            ),
        ).start()
        self.addCleanup(patch.stopall)

    def assert_released(self):
        """Require explicit unlock on the owning session and connection disposal."""
        sql = [call.args[0] for call in self.cursor.execute.call_args_list]
        self.assertEqual(len(sql), 2)
        self.assertIn("pg_try_advisory_lock", sql[0])
        self.assertIn("pg_advisory_unlock", sql[1])
        self.assertEqual(
            self.cursor.execute.call_args_list[0].args[1],
            self.cursor.execute.call_args_list[1].args[1],
        )
        self.owner.close.assert_called_once_with()

    def test_success_releases_its_private_session(self):
        """Keep successful calculations scoped to one explicitly owned session."""
        DiscoveryScoreService.recompute_business_scores(business_ids=[1])
        self.body.assert_called_once_with(
            business_ids=[1],
            reference_time=None,
        )
        self.assert_released()

    def test_failure_releases_its_private_session(self):
        """Do not retain a batch lock when scoring raises."""
        self.body.side_effect = RuntimeError("Scoring failed")
        with self.assertRaises(RuntimeError):
            DiscoveryScoreService.recompute_business_scores()
        self.assert_released()

    def test_concurrent_attempt_never_starts_or_unlocks_another_batch(self):
        """A busy session must return a controlled conflict without calculation."""
        self.cursor.fetchone.return_value = [False]
        with self.assertRaises(DiscoveryScoreRecomputeInProgress) as raised:
            DiscoveryScoreService.recompute_business_scores()
        self.body.assert_not_called()
        self.assertEqual(self.cursor.execute.call_count, 1)
        self.owner.close.assert_called_once_with()
        response = custom_exception_handler(raised.exception, {})
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["code"], "RECOMPUTATION_IN_PROGRESS")

    def test_api_and_scheduled_task_share_the_guard(self):
        """Both execution paths must reject the same held global lock."""
        self.cursor.fetchone.return_value = [False]
        request = APIRequestFactory().post("/recompute/")
        with self.assertRaises(DiscoveryScoreRecomputeInProgress):
            DiscoveryScoreRecomputeView().post(request)
        with self.assertRaises(DiscoveryScoreRecomputeInProgress):
            recompute_discovery_scores.run()
        self.body.assert_not_called()
        self.assertEqual(self.cursor.execute.call_count, 2)
        self.assertEqual(self.owner.close.call_count, 2)

    def test_unlock_failure_still_disposes_the_owner(self):
        """Disposal prevents a reusable locked session after an unlock error."""
        self.cursor.execute.side_effect = [None, RuntimeError("Unlock failed")]
        with self.assertRaises(RuntimeError):
            DiscoveryScoreService.recompute_business_scores()
        self.owner.close.assert_called_once_with()
