from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from decimal import Decimal
from threading import Barrier
from types import SimpleNamespace
from unittest.mock import patch

from django.db import close_old_connections, connection
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from apps.business.models import BusinessVouch, DiscoveryScore
from apps.business.services.discovery_score_service import DiscoveryScoreService
from apps.business.services.tests import test_discovery_score_service as discovery_fixtures
from apps.business.services.tests.test_vouch_lifecycle import VouchLifecycleFixtures
from apps.business.services.vouch_service import VouchService
from apps.business.tasks import recompute_business_discovery_score
from apps.users.models import ReputationEvent


class ConcurrentVouchLifecycleTests(VouchLifecycleFixtures, TransactionTestCase):
    """Serialize competing endorsement transitions on real PostgreSQL connections."""

    def setUp(self):
        self.setUpTestData()
        super().setUp()
        if connection.vendor != "postgresql":
            self.skipTest("Endorsement concurrency requires PostgreSQL row locks.")

    def _compete(
        self,
        actions,
        tag_id=None,
    ):
        barrier = Barrier(len(actions))
        if tag_id is None:
            tag_id = self.spicy_tag.pk

        def perform(action):
            close_old_connections()
            try:
                barrier.wait(timeout=10)
                if action == "score":
                    DiscoveryScoreService.recompute_business_score(
                        business_id=self.business.pk,
                    )
                    return "scored"
                if action == "withdraw":
                    VouchService.remove_vouch(
                        user=self.user,
                        business_id=self.business.pk,
                        tag_id=tag_id,
                    )
                    return "withdrawn"
                VouchService.create_vouch(
                    user=self.user,
                    business_id=self.business.pk,
                    tag_id=tag_id,
                )
                return "endorsed"
            except ValidationError:
                return "duplicate"
            except NotFound:
                return "not_found"
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=len(actions)) as executor:
            futures = [
                executor.submit(perform, action)
                for action in actions
            ]
            return [
                future.result(timeout=20)
                for future in futures
            ]

    def test_concurrent_first_creation_keeps_one_identity_reward_and_counter(self):
        results = self._compete(["endorse", "endorse"])
        self.assertCountEqual(results, ["endorsed", "duplicate"])
        self.assertEqual(BusinessVouch.objects.count(), 1)
        self.assertEqual(ReputationEvent.objects.count(), 1)
        self._assert_counts(1)

    def test_concurrent_reinstatement_increments_only_once(self):
        vouch = self._create()
        self._withdraw()
        results = self._compete(["endorse", "endorse"])
        self.assertCountEqual(results, ["endorsed", "duplicate"])
        self.assertEqual(BusinessVouch.objects.get().pk, vouch.pk)
        self.assertEqual(ReputationEvent.objects.count(), 1)
        self._assert_counts(1)

    def test_concurrent_withdrawal_decrements_only_once(self):
        self._create()
        results = self._compete(["withdraw", "withdraw"])
        self.assertCountEqual(results, ["withdrawn", "not_found"])
        self.assertIsNotNone(BusinessVouch.objects.get().VOUCH_WITHDRAWN_AT)
        self._assert_counts(0)

    def test_mixed_withdrawal_and_reinstatement_match_serialized_final_state(self):
        vouch = self._create()
        results = self._compete(["withdraw", "endorse"])
        self.assertIn("withdrawn", results)
        self.assertTrue("endorsed" in results or "duplicate" in results)
        vouch.refresh_from_db()
        expected = int(vouch.VOUCH_WITHDRAWN_AT is None)
        self._assert_counts(expected)
        self.assertEqual(BusinessVouch.objects.count(), 1)
        self.assertEqual(ReputationEvent.objects.count(), 1)

    def test_withdrawal_and_score_refresh_converge_when_scoped_work_runs(self):
        self._create()
        visibility = discovery_fixtures.DiscoveryScoreServiceTests._visibility_result(
            SimpleNamespace(
                business=self.business,
                REFERENCE_TIME=timezone.now(),
            ),
            visibility_gap=Decimal("1"),
        )
        with patch(
            "apps.business.services.discovery_score_service."
            "VisibilityGapService.calculate_business_visibility_gap",
            return_value=visibility,
        ):
            results = self._compete(["withdraw", "score"])
            recompute_business_discovery_score.run(
                business_id=self.business.pk,
            )

        self.assertCountEqual(results, ["withdrawn", "scored"])
        self.assertEqual(DiscoveryScore.objects.get().DSC_S_SCORE, 0)
        self.spicy_business_tag.refresh_from_db()
        self.assertEqual(self.spicy_business_tag.BST_TAG_SCORE, 0)
        self._assert_counts(0)

    def test_targeted_and_global_refresh_keep_the_newer_result(self):
        self._create()
        older_time = timezone.now()
        newer_time = older_time + timedelta(seconds=1)
        barrier = Barrier(2)
        visibility = discovery_fixtures.DiscoveryScoreServiceTests._visibility_result(
            SimpleNamespace(
                business=self.business,
                REFERENCE_TIME=older_time,
            ),
            visibility_gap=Decimal("1"),
        )

        def read_visibility(**kwargs):
            barrier.wait(timeout=10)
            return (visibility,)

        def compute(targeted):
            close_old_connections()
            try:
                if targeted:
                    return DiscoveryScoreService.recompute_business_score(
                        self.business.pk,
                        reference_time=newer_time,
                    )
                return DiscoveryScoreService.recompute_business_scores(
                    reference_time=older_time,
                )
            finally:
                close_old_connections()

        with patch(
            "apps.business.services.visibility_gap_service."
            "VisibilityGapService.calculate_visibility_gaps",
            side_effect=read_visibility,
        ), ThreadPoolExecutor(max_workers=2) as executor:
            targeted = executor.submit(compute, True)
            scheduled = executor.submit(compute, False)
            targeted.result(timeout=20)
            scheduled.result(timeout=20)

        score = DiscoveryScore.objects.get()
        self.assertEqual(score.DSC_COMPUTED_AT, newer_time)
        self.assertFalse(score.DSC_IS_PROVISIONAL)
        self.assertIsNone(score.DSC_REFRESH_REQUESTED_AT)
