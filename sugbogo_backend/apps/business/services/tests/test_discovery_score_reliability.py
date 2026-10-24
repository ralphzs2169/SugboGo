from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from celery.exceptions import Retry
from django.db import transaction
from django.test import TestCase
from django.utils import timezone

from apps.business.models import Business, DiscoveryScore
from apps.business.services.discovery_score_refresh_service import DiscoveryScoreRefreshService
from apps.business.services.discovery_score_service import (
    DiscoveryScoreRecomputeStatus,
    DiscoveryScoreService,
)
from apps.business.services.tests import test_discovery_score_service as fixtures
from apps.business.services.visibility_event_service import VisibilityTrackingUnavailable
from apps.business.services.visibility_gap_service import VisibilityGapService
from apps.business.services.vouch_service import VouchService
from apps.business.tasks import recompute_business_discovery_score, recompute_discovery_scores
from apps.explorer_operations.explore_businesses.services.discovery_feed_service import DiscoveryFeedService
from apps.admin_operations.analytics.services.discovery_score_monitoring_service import (
    DiscoveryScoreMonitoringService,
)
from apps.admin_operations.system_configuration.serializers import DiscoveryAlgorithmConfigurationSerializer
from apps.business.services.business_specialty_service import BusinessSpecialtyService


class DiscoveryScoreReliabilityTests(TestCase):
    """Protect provisional initialization, recoverable refresh state, and stale writes."""

    REFERENCE_TIME = fixtures.DiscoveryScoreServiceTests.REFERENCE_TIME
    _visibility_result = fixtures.DiscoveryScoreServiceTests._visibility_result

    @classmethod
    def setUpTestData(cls):
        fixtures.DiscoveryScoreServiceTests.setUpTestData.__func__(cls)

    def setUp(self):
        fixtures.DiscoveryScoreServiceTests.setUp(self)
        self.reference_time = timezone.now() + timedelta(seconds=1)
        self.publisher = patch("apps.business.tasks.recompute_business_discovery_score.delay")
        self.publish = self.publisher.start()
        self.addCleanup(self.publisher.stop)

    def _compute(
        self,
        reference_time=None,
        only_if_pending=False,
    ):
        if reference_time is None:
            reference_time = self.reference_time
        with patch.object(
            VisibilityGapService,
            "calculate_business_visibility_gap",
            return_value=self._visibility_result(Decimal("1")),
        ):
            return DiscoveryScoreService.recompute_business_score(
                self.business.pk,
                reference_time=reference_time,
                only_if_pending=only_if_pending,
            )

    def test_initialization_uses_configured_weights_and_does_not_assert_visibility(self):
        self.configuration.DAC_SPECIALTY_SCORE_WEIGHT = Decimal("0.65")
        self.configuration.DAC_VISIBILITY_GAP_WEIGHT = Decimal("0.35")
        self.configuration.save()
        with patch.object(
            VisibilityGapService,
            "calculate_business_visibility_gap",
        ) as telemetry, self.captureOnCommitCallbacks(execute=True):
            DiscoveryScoreRefreshService.request_refresh(self.business.pk)
            self.publish.assert_not_called()

        score = DiscoveryScore.objects.get()
        self.assertTrue(score.DSC_IS_PROVISIONAL)
        self.assertIsNone(score.DSC_COMPUTED_AT)
        self.assertEqual(score.DSC_D_SCORE, Decimal("0.35000"))
        self.assertEqual(DiscoveryScoreRefreshService.initialize(self.business.pk).pk, score.pk)
        telemetry.assert_not_called()
        self.publish.assert_called_once_with(business_id=self.business.pk)

    def test_initial_calculation_failure_preserves_provisional_and_pending_state(self):
        with patch.object(
            VisibilityGapService,
            "calculate_business_visibility_gap",
            side_effect=VisibilityTrackingUnavailable(),
        ), self.assertRaises(VisibilityTrackingUnavailable):
            DiscoveryScoreService.recompute_business_score(self.business.pk)

        score = DiscoveryScore.objects.get()
        self.assertTrue(score.DSC_IS_PROVISIONAL)
        self.assertIsNone(score.DSC_COMPUTED_AT)
        self.assertEqual(score.DSC_LAST_ERROR, "VisibilityTrackingUnavailable")
        self.assertIsNotNone(score.DSC_REFRESH_REQUESTED_AT)

    def test_initialization_and_publication_are_rolled_back_with_admission(self):
        with self.captureOnCommitCallbacks(execute=True):
            with self.assertRaises(RuntimeError):
                with transaction.atomic():
                    DiscoveryScoreRefreshService.request_refresh(self.business.pk)
                    raise RuntimeError("admission rollback")
        self.assertFalse(DiscoveryScore.objects.exists())
        self.publish.assert_not_called()

    def test_publish_failure_is_durable_and_hourly_reconciliation_republishes(self):
        self.publish.side_effect = RuntimeError("broker unavailable")
        with patch(
            "apps.business.services.discovery_score_refresh_service.logger.exception",
        ), self.captureOnCommitCallbacks(execute=True):
            DiscoveryScoreRefreshService.request_refresh(self.business.pk)
        score = DiscoveryScore.objects.get()
        self.assertEqual(score.DSC_LAST_ERROR, "DISPATCH_FAILED")
        version = score.DSC_REFRESH_VERSION
        self.publish.side_effect = None
        with self.captureOnCommitCallbacks(execute=True):
            result = DiscoveryScoreRefreshService.reconcile()
        score.refresh_from_db()
        self.assertEqual(score.DSC_REFRESH_VERSION, version)
        self.assertEqual(result["requested"], 1)
        self._compute()
        score.refresh_from_db()
        self.assertFalse(score.DSC_IS_PROVISIONAL)
        self.assertEqual(score.DSC_LAST_ERROR, "")
        self.assertIsNone(score.DSC_REFRESH_REQUESTED_AT)

    def test_duplicate_targeted_tasks_do_not_repeat_a_completed_generation(self):
        self._compute()
        with patch.object(
            VisibilityGapService,
            "calculate_business_visibility_gap",
        ) as telemetry:
            result = DiscoveryScoreService.recompute_business_score(
                self.business.pk,
                reference_time=self.reference_time + timedelta(seconds=1),
                only_if_pending=True,
            )
        self.assertEqual(result.status, DiscoveryScoreRecomputeStatus.SKIPPED_STALE)
        telemetry.assert_not_called()

    def test_old_batch_retry_cannot_acknowledge_a_later_vouch_refresh(self):
        initial_time = self.reference_time
        vouch_time = initial_time + timedelta(minutes=1)
        targeted_time = vouch_time + timedelta(minutes=1)

        with patch.object(
            VisibilityGapService,
            "calculate_visibility_gaps",
            side_effect=VisibilityTrackingUnavailable(),
        ), patch.object(
            recompute_discovery_scores,
            "retry",
            return_value=Retry("retry visibility"),
        ) as retry, patch(
            "apps.business.tasks.logger.warning",
        ), self.assertRaises(Retry):
            recompute_discovery_scores.run(
                reference_time_iso=initial_time.isoformat(),
            )

        explorer = fixtures.DiscoveryScoreServiceTests._create_explorer(
            self,
            Decimal("0.20"),
        )
        with patch(
            "apps.business.services.discovery_score_refresh_service.timezone.now",
            return_value=vouch_time,
        ):
            vouch = VouchService.create_vouch(
                user=explorer,
                business_id=self.business.pk,
                tag_id=self.specialties[0].TAG_ID_id,
            )
        self.assertEqual(vouch.VOUCH_CREATED_AT, vouch_time)
        score = DiscoveryScore.objects.get()
        version = score.DSC_REFRESH_VERSION
        self.assertEqual(score.DSC_REFRESH_REQUESTED_AT, vouch_time)

        with patch.object(
            VisibilityGapService,
            "calculate_visibility_gaps",
            return_value=(self._visibility_result(Decimal("1")),),
        ):
            summary = recompute_discovery_scores.run(
                **retry.call_args.kwargs["kwargs"],
            )

        score.refresh_from_db()
        self.assertEqual(summary["updated"], 0)
        self.assertEqual(summary["skipped_stale"], 1)
        self.assertEqual(score.DSC_REFRESH_VERSION, version)
        self.assertEqual(score.DSC_REFRESH_REQUESTED_AT, vouch_time)
        self.assertIsNone(score.DSC_COMPUTED_AT)
        self.assertTrue(score.DSC_IS_PROVISIONAL)

        with patch(
            "apps.business.tasks.timezone.now",
            return_value=targeted_time,
        ), patch.object(
            VisibilityGapService,
            "calculate_business_visibility_gap",
            return_value=self._visibility_result(Decimal("1")),
        ):
            result = recompute_business_discovery_score.run(
                business_id=self.business.pk,
            )

        score.refresh_from_db()
        self.specialties[0].refresh_from_db()
        self.assertEqual(
            result["status"],
            DiscoveryScoreRecomputeStatus.UPDATED.value,
        )
        self.assertGreater(self.specialties[0].BST_TAG_SCORE, Decimal("0"))
        self.assertGreater(score.DSC_S_SCORE, Decimal("0"))
        self.assertEqual(score.DSC_COMPUTED_AT, targeted_time)
        self.assertIsNone(score.DSC_REFRESH_REQUESTED_AT)
        self.assertEqual(score.DSC_LAST_ERROR, "")
        self.assertFalse(score.DSC_IS_PROVISIONAL)

    def test_pending_requests_retain_the_latest_invalidation_generation_and_time(self):
        first_time = self.reference_time
        second_time = first_time + timedelta(minutes=1)
        global_time = second_time + timedelta(minutes=1)
        reconciliation_time = global_time + timedelta(minutes=1)

        for requested_at in (first_time, second_time):
            with patch(
                "apps.business.services.discovery_score_refresh_service.timezone.now",
                return_value=requested_at,
            ):
                DiscoveryScoreRefreshService.request_refresh(self.business.pk)

        score = DiscoveryScore.objects.get()
        self.assertEqual(score.DSC_REFRESH_VERSION, 2)
        self.assertEqual(score.DSC_REFRESH_REQUESTED_AT, second_time)

        with patch(
            "apps.business.services.discovery_score_refresh_service.timezone.now",
            return_value=global_time,
        ):
            DiscoveryScoreRefreshService.request_global_refresh()
        with patch(
            "apps.business.services.discovery_score_refresh_service.timezone.now",
            return_value=reconciliation_time,
        ):
            DiscoveryScoreRefreshService.request_refresh(
                self.business.pk,
                invalidate=False,
            )

        stale = self._compute(
            reference_time=second_time,
            only_if_pending=True,
        )
        score.refresh_from_db()
        self.assertEqual(stale.status, DiscoveryScoreRecomputeStatus.SKIPPED_STALE)
        self.assertEqual(score.DSC_REFRESH_VERSION, 3)
        self.assertEqual(score.DSC_REFRESH_REQUESTED_AT, global_time)
        self.assertIsNone(score.DSC_COMPUTED_AT)

        result = self._compute(
            reference_time=global_time,
            only_if_pending=True,
        )
        score.refresh_from_db()
        self.assertEqual(result.status, DiscoveryScoreRecomputeStatus.UPDATED)
        self.assertEqual(score.DSC_COMPUTED_AT, global_time)
        self.assertIsNone(score.DSC_REFRESH_REQUESTED_AT)

    def test_older_batch_cannot_overwrite_a_newer_completed_refresh(self):
        invalidation_time = self.reference_time
        older_time = invalidation_time + timedelta(minutes=1)
        newer_time = older_time + timedelta(minutes=1)
        with patch(
            "apps.business.services.discovery_score_refresh_service.timezone.now",
            return_value=invalidation_time,
        ):
            DiscoveryScoreRefreshService.request_refresh(self.business.pk)

        def complete_newer_refresh(**kwargs):
            self._compute(
                reference_time=newer_time,
                only_if_pending=True,
            )
            return (self._visibility_result(Decimal("0")),)

        with patch.object(
            VisibilityGapService,
            "calculate_visibility_gaps",
            side_effect=complete_newer_refresh,
        ):
            result = DiscoveryScoreService.recompute_business_scores(
                business_ids=[self.business.pk],
                reference_time=older_time,
            )

        score = DiscoveryScore.objects.get()
        self.assertEqual(result.updated_count, 0)
        self.assertEqual(result.stale_count, 1)
        self.assertEqual(score.DSC_COMPUTED_AT, newer_time)
        self.assertEqual(score.DSC_D_SCORE, Decimal("0.20000"))
        self.assertEqual(score.DSC_V_SCORE, Decimal("1.00000"))
        self.assertIsNone(score.DSC_REFRESH_REQUESTED_AT)
        self.assertEqual(score.DSC_LAST_ERROR, "")

    def test_mutation_during_visibility_calculation_invalidates_old_generation(self):
        before = self._compute()

        def change_evidence(**kwargs):
            DiscoveryScoreRefreshService.request_refresh(self.business.pk)
            return self._visibility_result(Decimal("0"))

        with patch.object(
            VisibilityGapService,
            "calculate_business_visibility_gap",
            side_effect=change_evidence,
        ):
            result = DiscoveryScoreService.recompute_business_score(
                self.business.pk,
                reference_time=self.reference_time + timedelta(seconds=1),
            )
        score = DiscoveryScore.objects.get()
        self.assertEqual(result.status, DiscoveryScoreRecomputeStatus.SKIPPED_STALE)
        self.assertEqual(score.DSC_D_SCORE, before.discovery_score)
        self.assertIsNotNone(score.DSC_REFRESH_REQUESTED_AT)

    def test_old_and_equal_results_cannot_overwrite_newer_success(self):
        result = self._compute()
        for time in [self.reference_time, self.reference_time - timedelta(seconds=1)]:
            stale = self._compute(time)
            self.assertEqual(stale.status, DiscoveryScoreRecomputeStatus.SKIPPED_STALE)
        self.assertEqual(DiscoveryScore.objects.get().DSC_D_SCORE, result.discovery_score)

    def test_old_failure_cannot_taint_a_newer_success(self):
        self._compute()
        score = DiscoveryScore.objects.get()
        DiscoveryScoreRefreshService.record_failure(
            self.business.pk,
            score.DSC_REFRESH_VERSION,
            self.reference_time - timedelta(seconds=1),
            RuntimeError(),
        )
        score.refresh_from_db()
        self.assertEqual(score.DSC_LAST_ERROR, "")

    def test_previous_success_survives_a_later_visibility_failure(self):
        previous = self._compute()
        with patch.object(
            VisibilityGapService,
            "calculate_business_visibility_gap",
            side_effect=VisibilityTrackingUnavailable(),
        ), self.assertRaises(VisibilityTrackingUnavailable):
            DiscoveryScoreService.recompute_business_score(
                self.business.pk,
                reference_time=self.reference_time + timedelta(seconds=1),
            )
        score = DiscoveryScore.objects.get()
        self.assertFalse(score.DSC_IS_PROVISIONAL)
        self.assertEqual(score.DSC_D_SCORE, previous.discovery_score)
        self.assertEqual(score.DSC_COMPUTED_AT, previous.reference_time)
        self.assertEqual(score.DSC_LAST_ERROR, "VisibilityTrackingUnavailable")

    def test_configuration_change_during_calculation_cannot_persist_old_inputs(self):
        before = self._compute()

        def change_configuration(**kwargs):
            self.configuration.DAC_DECAY_RATE = Decimal("0.15")
            self.configuration.save()
            return self._visibility_result(Decimal("0"))

        with patch.object(
            VisibilityGapService,
            "calculate_business_visibility_gap",
            side_effect=change_configuration,
        ):
            result = DiscoveryScoreService.recompute_business_score(
                self.business.pk,
                reference_time=self.reference_time + timedelta(seconds=1),
            )
        self.assertEqual(result.status, DiscoveryScoreRecomputeStatus.SKIPPED_STALE)
        self.assertEqual(DiscoveryScore.objects.get().DSC_D_SCORE, before.discovery_score)

    def test_monitoring_distinguishes_missing_provisional_failed_and_stale(self):
        self.assertEqual(DiscoveryScoreMonitoringService.coverage()["missing"], 1)
        DiscoveryScoreRefreshService.initialize(self.business.pk)
        self.assertEqual(DiscoveryScoreMonitoringService.coverage()["provisional"], 1)
        self._compute()
        DiscoveryScore.objects.update(
            DSC_COMPUTED_AT=timezone.now() - timedelta(hours=27),
            DSC_LAST_ERROR="OperationalError",
            DSC_REFRESH_REQUESTED_AT=timezone.now(),
        )
        coverage = DiscoveryScoreMonitoringService.coverage()
        self.assertEqual(coverage["stale"], 1)
        self.assertEqual(coverage["failed"], 1)
        self.assertEqual(coverage["pending"], 1)
        self.assertEqual(DiscoveryScoreMonitoringService.list_scores().get().score_state, "FAILED")

    def test_missing_ranking_uses_configuration_but_computed_zero_remains_zero(self):
        self.configuration.DAC_SPECIALTY_SCORE_WEIGHT = Decimal("0.65")
        self.configuration.DAC_VISIBILITY_GAP_WEIGHT = Decimal("0.35")
        self.configuration.save()
        ranked = DiscoveryFeedService.list_ranked_businesses().get(pk=self.business.pk)
        self.assertEqual(ranked.discovery_rank_score, Decimal("0.35"))
        self._compute()
        DiscoveryScore.objects.update(DSC_D_SCORE=0)
        ranked = DiscoveryFeedService.list_ranked_businesses().get(pk=self.business.pk)
        self.assertEqual(ranked.discovery_rank_score, 0)

    def test_reconciliation_is_bounded_and_skips_inactive_businesses(self):
        with patch.object(DiscoveryScoreRefreshService, "RECONCILIATION_LIMIT", 0):
            self.assertEqual(DiscoveryScoreRefreshService.reconcile()["requested"], 0)
        Business.objects.filter(pk=self.business.pk).update(BUSN_STATUS=Business.BusinessStatus.SUSPENDED)
        self.assertEqual(DiscoveryScoreRefreshService.reconcile()["requested"], 0)

    def test_configuration_refresh_only_for_changed_scoring_inputs(self):
        with patch.object(DiscoveryScoreRefreshService, "request_global_refresh") as refresh:
            for data, expected in [
                ({"decay_rate": "0.10"}, 0),
                ({"vouch_reputation_reward": "0.02"}, 0),
                ({"decay_rate": "0.15"}, 1),
            ]:
                serializer = DiscoveryAlgorithmConfigurationSerializer(
                    self.configuration,
                    data=data,
                    partial=True,
                )
                self.assertTrue(serializer.is_valid(), serializer.errors)
                serializer.save()
                self.assertEqual(refresh.call_count, expected)

    def test_partial_batch_failure_leaves_recoverable_pending_state(self):
        with patch.object(
            VisibilityGapService,
            "calculate_visibility_gaps",
            return_value=(self._visibility_result(Decimal("1")),),
        ), patch.object(
            DiscoveryScoreService,
            "_persist_business_score",
            side_effect=RuntimeError("per-business persistence failed"),
        ):
            result = DiscoveryScoreService.recompute_business_scores()
        self.assertEqual(result.failed_count, 1)
        self.assertEqual(DiscoveryScore.objects.get().DSC_LAST_ERROR, "RuntimeError")
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(DiscoveryScoreRefreshService.reconcile()["requested"], 1)

    def test_assignment_transitions_request_refresh_but_noops_do_not(self):
        with patch.object(DiscoveryScoreRefreshService, "request_refresh") as refresh:
            for _ in range(2):
                BusinessSpecialtyService.deactivate_specialty(
                    self.business.pk,
                    self.specialties[0].TAG_ID_id,
                )
            self.assertEqual(refresh.call_count, 1)
            for _ in range(2):
                BusinessSpecialtyService.reactivate_specialty(
                    self.business.pk,
                    self.specialties[0].TAG_ID_id,
                )
            self.assertEqual(refresh.call_count, 2)
