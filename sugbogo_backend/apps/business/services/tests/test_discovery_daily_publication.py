from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from apps.admin_operations.system_configuration.serializers import (
    DiscoveryAlgorithmConfigurationSerializer,
)
from apps.admin_operations.taxonomy_management.services.category_service import CategoryService
from apps.business.models import BusinessSpecialtyTag, Cluster, DiscoveryScore, SpecialtyTag
from apps.business.services.business_specialty_service import BusinessSpecialtyService
from apps.business.services.discovery_score_refresh_service import DiscoveryScoreRefreshService
from apps.business.services.discovery_score_service import (
    DiscoveryScoreRecomputeStatus,
    DiscoveryScoreService,
)
from apps.business.services.tests import test_discovery_score_reliability as reliability
from apps.business.services.tests import test_discovery_score_service as fixtures
from apps.business.services.visibility_event_service import VisibilityTrackingUnavailable
from apps.business.services.visibility_gap_service import VisibilityGapService
from apps.business.services.vouch_service import VouchService
from apps.business.tasks import recompute_business_discovery_score
from apps.explorer_operations.explore_businesses.services.discovery_feed_service import (
    DiscoveryFeedService,
)


class DiscoveryDailyPublicationTests(TestCase):
    """Keep healthy evidence deferred while retaining due recovery and stale guards."""

    REFERENCE_TIME = fixtures.DiscoveryScoreServiceTests.REFERENCE_TIME
    _visibility_result = fixtures.DiscoveryScoreServiceTests._visibility_result
    _compute = reliability.DiscoveryScoreReliabilityTests._compute

    @classmethod
    def setUpTestData(cls):
        """Reuse one business with three scoreable specialties."""
        fixtures.DiscoveryScoreServiceTests.setUpTestData.__func__(cls)

    def setUp(self):
        """Isolate publication and choose monotonically increasing calculation times."""
        fixtures.DiscoveryScoreServiceTests.setUp(self)
        self.reference_time = timezone.now()
        self.explorer = fixtures.DiscoveryScoreServiceTests._create_explorer(
            self,
            Decimal("0.20"),
        )
        publisher = patch("apps.business.tasks.recompute_business_discovery_score.delay")
        self.publish = publisher.start()
        self.addCleanup(publisher.stop)

    def _vouch(self):
        """Create or reinstate evidence for the first active specialty."""
        return VouchService.create_vouch(
            user=self.explorer,
            business_id=self.business.pk,
            tag_id=self.specialties[0].TAG_ID_id,
        )

    def _batch(self):
        """Publish real specialty evidence at the next daily reference time."""
        with patch.object(
            VisibilityGapService,
            "calculate_visibility_gaps",
            return_value=(self._visibility_result(Decimal("1")),),
        ):
            return DiscoveryScoreService.recompute_business_scores(
                reference_time=self.reference_time + timedelta(days=1),
            )

    def test_vouch_creation_withdrawal_and_reinstatement_publish_only_in_batch(self):
        """Each ordinary transition preserves scores until its next batch."""
        self._compute()
        for action, expected_positive in (
            (self._vouch, True),
            (
                lambda: VouchService.remove_vouch(
                    user=self.explorer,
                    business_id=self.business.pk,
                    tag_id=self.specialties[0].TAG_ID_id,
                ),
                False,
            ),
            (self._vouch, True),
        ):
            before = DiscoveryScore.objects.get()
            with self.captureOnCommitCallbacks(execute=True):
                action()
                self.assertEqual(DiscoveryScoreRefreshService.reconcile()["requested"], 0)
            score = DiscoveryScore.objects.get()
            self.assertEqual(score.DSC_D_SCORE, before.DSC_D_SCORE)
            self.assertEqual(score.DSC_COMPUTED_AT, before.DSC_COMPUTED_AT)
            self.assertEqual(score.DSC_REFRESH_VERSION, before.DSC_REFRESH_VERSION + 1)
            self.assertTrue(score.DSC_REFRESH_DEFERRED)
            self.publish.assert_not_called()
            with patch.object(
                VisibilityGapService,
                "calculate_business_visibility_gap",
            ) as telemetry:
                result = recompute_business_discovery_score.run(
                    business_id=self.business.pk,
                )
            telemetry.assert_not_called()
            self.assertEqual(result["status"], DiscoveryScoreRecomputeStatus.SKIPPED_STALE)
            self.assertEqual(self._batch().updated_count, 1)
            score.refresh_from_db()
            self.assertEqual(score.DSC_S_SCORE > 0, expected_positive)
            self.assertFalse(score.DSC_REFRESH_DEFERRED)
            self.assertIsNone(score.DSC_REFRESH_REQUESTED_AT)
            self.reference_time += timedelta(days=1)

    def test_healthy_provisional_waits_for_batch_even_if_targeted_message_arrives(self):
        """Expected admission state is neither failed nor due targeted work."""
        DiscoveryScoreRefreshService.request_refresh(
            self.business.pk,
            defer_until_daily=True,
        )
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(DiscoveryScoreRefreshService.reconcile()["requested"], 0)
        result = recompute_business_discovery_score.run(business_id=self.business.pk)
        self.assertEqual(result["status"], DiscoveryScoreRecomputeStatus.SKIPPED_STALE)
        score = DiscoveryScore.objects.get()
        self.assertTrue(score.DSC_IS_PROVISIONAL)
        self.assertIsNone(score.DSC_COMPUTED_AT)
        self.assertEqual(list(DiscoveryFeedService.list_global_hidden_gem_ids()), [])
        self.publish.assert_not_called()
        self.assertEqual(self._batch().updated_count, 1)
        score.refresh_from_db()
        self.assertFalse(score.DSC_IS_PROVISIONAL)

    def test_missing_score_is_recovered_even_for_recent_business(self):
        """Admission is atomic, so an absent row remains a broken state."""
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(DiscoveryScoreRefreshService.reconcile()["requested"], 1)
        self.publish.assert_called_once_with(business_id=self.business.pk)
        self.assertFalse(DiscoveryScore.objects.get().DSC_REFRESH_DEFERRED)
        self._compute(only_if_pending=True)
        self.assertFalse(DiscoveryScore.objects.get().DSC_IS_PROVISIONAL)

    def test_failed_daily_computation_remains_recoverable_after_ordinary_vouch(self):
        """Ordinary invalidation must not defer a real calculation failure."""
        self._compute()
        with patch.object(
            VisibilityGapService,
            "calculate_visibility_gaps",
            side_effect=VisibilityTrackingUnavailable(),
        ), self.assertRaises(VisibilityTrackingUnavailable):
            DiscoveryScoreService.recompute_business_scores(
                reference_time=self.reference_time + timedelta(seconds=1),
            )
        self._vouch()
        score = DiscoveryScore.objects.get()
        self.assertFalse(score.DSC_REFRESH_DEFERRED)
        self.assertEqual(score.DSC_LAST_ERROR, "VisibilityTrackingUnavailable")
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(DiscoveryScoreRefreshService.reconcile()["requested"], 1)
        self._compute(
            reference_time=self.reference_time + timedelta(seconds=2),
            only_if_pending=True,
        )
        score.refresh_from_db()
        self.assertEqual(score.DSC_LAST_ERROR, "")
        self.assertGreater(score.DSC_S_SCORE, 0)

    def test_interrupted_attempt_remains_due_after_deferred_invalidation(self):
        """A worker's durable attempt marker survives later ordinary evidence."""
        self._compute()
        score = DiscoveryScore.objects.get()
        DiscoveryScoreRefreshService.record_attempt(
            self.business.pk,
            score.DSC_REFRESH_VERSION,
            self.reference_time + timedelta(seconds=1),
        )
        self._vouch()
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(DiscoveryScoreRefreshService.reconcile()["requested"], 1)
        self.publish.assert_called_once_with(business_id=self.business.pk)

    def test_overdue_computed_and_provisional_scores_are_recoverable(self):
        """A missed daily run cannot leave either score type waiting forever."""
        for provisional in (False, True):
            with self.subTest(provisional=provisional):
                DiscoveryScore.objects.all().delete()
                score = DiscoveryScoreRefreshService.initialize(self.business.pk)
                old_time = timezone.now() - timedelta(hours=27)
                computed_at = old_time
                if provisional:
                    computed_at = None
                DiscoveryScore.objects.filter(pk=score.pk).update(
                    DSC_CREATED_AT=old_time,
                    DSC_IS_PROVISIONAL=provisional,
                    DSC_COMPUTED_AT=computed_at,
                )
                with self.captureOnCommitCallbacks(execute=True):
                    self.assertEqual(DiscoveryScoreRefreshService.reconcile()["requested"], 1)
                self._compute(only_if_pending=True)
                self.assertFalse(DiscoveryScore.objects.get().DSC_IS_PROVISIONAL)

    def test_routine_specialty_changes_apply_live_without_score_publication(self):
        """Assignment matching changes immediately while persisted scores stay frozen."""
        self._vouch()
        self._compute(reference_time=self.reference_time + timedelta(seconds=1))
        before = DiscoveryScore.objects.get()
        for active in (False, True):
            if active:
                action = BusinessSpecialtyService.reactivate_specialty
            else:
                action = BusinessSpecialtyService.deactivate_specialty
            with self.captureOnCommitCallbacks(execute=True):
                action(self.business.pk, self.specialties[0].TAG_ID_id)
                self.assertEqual(DiscoveryScoreRefreshService.reconcile()["requested"], 0)
            self.specialties[0].refresh_from_db()
            self.assertEqual(self.specialties[0].BST_IS_ACTIVE, active)
            score = DiscoveryScore.objects.get()
            self.assertEqual(score.DSC_D_SCORE, before.DSC_D_SCORE)
            self.assertTrue(score.DSC_IS_PROVISIONAL)
            self.assertTrue(score.DSC_REFRESH_DEFERRED)
        self.publish.assert_not_called()

    def _publish_hidden_gem(self):
        """Compute qualifying scores from valid evidence on all three specialties."""
        for specialty in self.specialties:
            VouchService.create_vouch(
                user=self.explorer,
                business_id=self.business.pk,
                tag_id=specialty.TAG_ID_id,
            )
        self._compute(
            reference_time=self.reference_time + timedelta(seconds=1),
        )
        self.assertIn(
            self.business.pk,
            DiscoveryFeedService.list_global_hidden_gem_ids(),
        )
        return DiscoveryScore.objects.get()

    @staticmethod
    def _published_values(score):
        """Capture values that a deferred taxonomy transition must retain."""
        return (
            score.DSC_S_SCORE,
            score.DSC_V_SCORE,
            score.DSC_D_SCORE,
            score.DSC_COMPUTED_AT,
        )

    def _assert_provisional_hidden_gem_exclusion(
        self,
        before,
    ):
        """Check retained general ranking and immediate Hidden Gem exclusion."""
        score = DiscoveryScore.objects.get()
        self.assertEqual(self._published_values(score), self._published_values(before))
        self.assertTrue(score.DSC_IS_PROVISIONAL)
        self.assertTrue(score.DSC_REFRESH_DEFERRED)
        self.assertGreater(score.DSC_REFRESH_VERSION, before.DSC_REFRESH_VERSION)
        self.assertIsNotNone(score.DSC_REFRESH_REQUESTED_AT)
        self.assertNotIn(
            self.business.pk,
            DiscoveryFeedService.list_global_hidden_gem_ids(),
        )
        ranked = DiscoveryFeedService.list_ranked_businesses().get(pk=self.business.pk)
        self.assertEqual(ranked.discovery_rank_score, before.DSC_D_SCORE)
        self.assertEqual(DiscoveryScoreRefreshService.reconcile()["requested"], 0)
        self.publish.assert_not_called()

    def test_specialty_removal_withholds_hidden_gem_until_current_evidence_is_computed(self):
        """Retain published values while excluding materially stale qualification."""
        before = self._publish_hidden_gem()
        with self.captureOnCommitCallbacks(execute=True):
            BusinessSpecialtyService.deactivate_specialty(
                self.business.pk,
                self.specialties[0].TAG_ID_id,
            )
        self.specialties[0].refresh_from_db()
        self.assertFalse(self.specialties[0].BST_IS_ACTIVE)
        self.assertFalse(
            DiscoveryFeedService.list_discovery_businesses(
                user=self.explorer,
                specialty_tag_id=self.specialties[0].TAG_ID_id,
            ).exists(),
        )
        self._assert_provisional_hidden_gem_exclusion(before)
        self.assertEqual(self._batch().updated_count, 1)
        score = DiscoveryScore.objects.get()
        self.assertLess(score.DSC_S_SCORE, before.DSC_S_SCORE)
        self.assertFalse(score.DSC_IS_PROVISIONAL)
        self.assertFalse(score.DSC_REFRESH_DEFERRED)
        self.assertIsNone(score.DSC_REFRESH_REQUESTED_AT)
        self.assertIn(
            self.business.pk,
            DiscoveryFeedService.list_global_hidden_gem_ids(),
        )
        for specialty in self.specialties[1:]:
            BusinessSpecialtyService.deactivate_specialty(
                self.business.pk,
                specialty.TAG_ID_id,
            )
        self.reference_time += timedelta(days=1)
        self._batch()
        self.assertEqual(DiscoveryScore.objects.get().DSC_S_SCORE, 0)
        self.assertNotIn(
            self.business.pk,
            DiscoveryFeedService.list_global_hidden_gem_ids(),
        )

    def test_specialty_activation_requires_revalidation_even_after_removal_was_published(self):
        """Restoring a specialty cannot reuse the last aggregate as authoritative."""
        self._publish_hidden_gem()
        BusinessSpecialtyService.deactivate_specialty(
            self.business.pk,
            self.specialties[0].TAG_ID_id,
        )
        self._batch()
        before = DiscoveryScore.objects.get()
        self.assertFalse(before.DSC_IS_PROVISIONAL)
        with self.captureOnCommitCallbacks(execute=True):
            BusinessSpecialtyService.reactivate_specialty(
                self.business.pk,
                self.specialties[0].TAG_ID_id,
            )
        self._assert_provisional_hidden_gem_exclusion(before)
        self.assertTrue(
            DiscoveryFeedService.list_discovery_businesses(
                user=self.explorer,
                specialty_tag_id=self.specialties[0].TAG_ID_id,
            ).exists(),
        )

    def test_noop_specialty_transitions_preserve_published_authority(self):
        """Already-active and already-inactive assignments cause no invalidation."""
        self._publish_hidden_gem()
        inactive_tag = SpecialtyTag.objects.create(TAG_NAME="Inactive no-op specialty")
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=self.business,
            TAG_ID=inactive_tag,
            BST_IS_ACTIVE=False,
        )
        before = DiscoveryScore.objects.values().get()
        with self.captureOnCommitCallbacks(execute=True):
            BusinessSpecialtyService.reactivate_specialty(
                self.business.pk,
                self.specialties[0].TAG_ID_id,
            )
            BusinessSpecialtyService.deactivate_specialty(
                self.business.pk,
                inactive_tag.pk,
            )
        self.assertEqual(DiscoveryScore.objects.values().get(), before)
        self.assertIn(self.business.pk, DiscoveryFeedService.list_global_hidden_gem_ids())
        self.publish.assert_not_called()

    def test_category_cluster_move_withholds_hidden_gems_and_noop_metadata_does_not(self):
        """Admin reparenting invalidates comparison context without changing scores."""
        before = self._publish_hidden_gem()
        new_cluster = Cluster.objects.create(CLUS_NAME="Changed comparison cluster")
        with patch(
            "apps.business.tasks.recompute_discovery_scores.delay",
        ) as batch, self.captureOnCommitCallbacks(execute=True):
            CategoryService.update_category(
                self.category,
                {"CLUS_ID": new_cluster},
            )
        batch.assert_not_called()
        self._assert_provisional_hidden_gem_exclusion(before)
        self.assertTrue(
            DiscoveryFeedService.list_discovery_businesses(
                user=self.explorer,
                cluster_id=new_cluster.pk,
            ).exists(),
        )
        self._batch()
        before_noop = DiscoveryScore.objects.values().get()
        CategoryService.update_category(
            self.category,
            {
                "CLUS_ID": new_cluster,
                "CTGRY_DESCRIPTION": "Updated label metadata only.",
            },
        )
        self.assertEqual(DiscoveryScore.objects.values().get(), before_noop)

    def test_taxonomy_invalidation_keeps_failed_work_recoverable(self):
        """Provisional eligibility must not conceal a genuine dispatch failure."""
        before = self._publish_hidden_gem()
        self.publish.side_effect = RuntimeError("broker unavailable")
        with patch(
            "apps.business.services.discovery_score_refresh_service.logger.exception",
        ), self.captureOnCommitCallbacks(execute=True):
            DiscoveryScoreRefreshService.request_refresh(self.business.pk)
        self.publish.side_effect = None
        with self.captureOnCommitCallbacks(execute=True):
            BusinessSpecialtyService.deactivate_specialty(
                self.business.pk,
                self.specialties[0].TAG_ID_id,
            )
            CategoryService.update_category(
                self.category,
                {"CLUS_ID": Cluster.objects.create(CLUS_NAME="Recovery comparison cluster")},
            )
        score = DiscoveryScore.objects.get()
        self.assertEqual(self._published_values(score), self._published_values(before))
        self.assertTrue(score.DSC_IS_PROVISIONAL)
        self.assertFalse(score.DSC_REFRESH_DEFERRED)
        self.assertEqual(score.DSC_LAST_ERROR, "DISPATCH_FAILED")
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(DiscoveryScoreRefreshService.reconcile()["requested"], 1)

    def test_ordinary_evidence_cannot_restore_provisional_taxonomy_authority(self):
        """Further ordinary invalidations retain the existing eligibility safeguard."""
        before = self._publish_hidden_gem()
        BusinessSpecialtyService.deactivate_specialty(
            self.business.pk,
            self.specialties[0].TAG_ID_id,
        )
        with self.captureOnCommitCallbacks(execute=True):
            VouchService.remove_vouch(
                user=self.explorer,
                business_id=self.business.pk,
                tag_id=self.specialties[1].TAG_ID_id,
            )
        self._assert_provisional_hidden_gem_exclusion(before)

    def test_configuration_defers_computed_and_provisional_values_without_dispatch(self):
        """Configuration edits invalidate inputs without replacing either baseline."""
        for computed in (False, True):
            with self.subTest(computed=computed):
                DiscoveryScore.objects.all().delete()
                if computed:
                    self._compute()
                else:
                    DiscoveryScoreRefreshService.initialize(self.business.pk)
                before = DiscoveryScore.objects.get()
                visibility_weight = "0.30"
                if computed:
                    visibility_weight = "0.40"
                serializer = DiscoveryAlgorithmConfigurationSerializer(
                    self.configuration,
                    data={
                        "specialty_score_weight": str(1 - Decimal(visibility_weight)),
                        "visibility_gap_weight": visibility_weight,
                    },
                    partial=True,
                )
                self.assertTrue(serializer.is_valid(), serializer.errors)
                with patch(
                    "apps.business.tasks.recompute_discovery_scores.delay",
                ) as batch, self.captureOnCommitCallbacks(execute=True):
                    serializer.save()
                    self.assertEqual(DiscoveryScoreRefreshService.reconcile()["requested"], 0)
                batch.assert_not_called()
                score = DiscoveryScore.objects.get()
                self.assertEqual(score.DSC_D_SCORE, before.DSC_D_SCORE)
                self.assertEqual(score.DSC_COMPUTED_AT, before.DSC_COMPUTED_AT)
                self.assertTrue(score.DSC_REFRESH_DEFERRED)
                self.assertEqual(score.DSC_REFRESH_VERSION, before.DSC_REFRESH_VERSION + 1)
                self.assertEqual(self._batch().updated_count, 1)
                score.refresh_from_db()
                self.assertEqual(score.DSC_D_SCORE, Decimal(visibility_weight))

    def test_deferred_configuration_does_not_hide_recoverable_dispatch_failure(self):
        """Shared edits retain the urgency of already failed exceptional work."""
        self.publish.side_effect = RuntimeError("broker unavailable")
        with patch(
            "apps.business.services.discovery_score_refresh_service.logger.exception",
        ), self.captureOnCommitCallbacks(execute=True):
            DiscoveryScoreRefreshService.request_refresh(self.business.pk)
        DiscoveryScoreRefreshService.request_global_refresh(defer_until_daily=True)
        self.publish.side_effect = None
        score = DiscoveryScore.objects.get()
        self.assertFalse(score.DSC_REFRESH_DEFERRED)
        self.assertEqual(score.DSC_LAST_ERROR, "DISPATCH_FAILED")
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(DiscoveryScoreRefreshService.reconcile()["requested"], 1)

    def test_deferred_mutation_during_batch_rejects_the_old_generation(self):
        """Daily deferral preserves the existing generation and request-time guard."""
        before = self._compute()

        def invalidate(**kwargs):
            """Simulate ordinary evidence arriving during visibility calculation."""
            DiscoveryScoreRefreshService.request_refresh(
                self.business.pk,
                defer_until_daily=True,
            )
            return (self._visibility_result(Decimal("0")),)

        with patch.object(
            VisibilityGapService,
            "calculate_visibility_gaps",
            side_effect=invalidate,
        ):
            result = DiscoveryScoreService.recompute_business_scores(
                reference_time=self.reference_time + timedelta(seconds=1),
            )
        self.assertEqual(result.stale_count, 1)
        score = DiscoveryScore.objects.get()
        self.assertEqual(score.DSC_D_SCORE, before.discovery_score)
        self.assertIsNotNone(score.DSC_REFRESH_REQUESTED_AT)
        self.publish.assert_not_called()

    def test_reconciliation_rechecks_a_candidate_completed_after_selection(self):
        """A stale candidate list must not promote a newly healthy daily score."""
        self._compute()
        DiscoveryScore.objects.update(
            DSC_REFRESH_REQUESTED_AT=self.reference_time,
        )
        request_refresh = DiscoveryScoreRefreshService.request_refresh

        def complete_before_republish(*args, **kwargs):
            """Simulate another worker completing the selected recovery first."""
            self._compute(
                reference_time=self.reference_time + timedelta(seconds=1),
            )
            request_refresh(*args, **kwargs)

        with patch.object(
            DiscoveryScoreRefreshService,
            "request_refresh",
            side_effect=complete_before_republish,
        ), self.captureOnCommitCallbacks(execute=True):
            DiscoveryScoreRefreshService.reconcile()
        self.publish.assert_not_called()
        self.assertIsNone(DiscoveryScore.objects.get().DSC_REFRESH_REQUESTED_AT)

    def test_batch_predating_admission_does_not_make_healthy_provisional_recoverable(self):
        """A post-cutoff admission stays deferred when an older batch encounters it."""
        DiscoveryScoreRefreshService.request_refresh(
            self.business.pk,
            defer_until_daily=True,
        )
        score = DiscoveryScore.objects.get()
        reference_time = score.DSC_REFRESH_REQUESTED_AT - timedelta(seconds=1)
        with patch.object(
            VisibilityGapService,
            "calculate_visibility_gaps",
            return_value=(self._visibility_result(Decimal("1")),),
        ):
            result = DiscoveryScoreService.recompute_business_scores(
                reference_time=reference_time,
            )
        self.assertEqual(result.stale_count, 1)
        score.refresh_from_db()
        self.assertTrue(score.DSC_REFRESH_DEFERRED)
        self.assertIsNone(score.DSC_LAST_ATTEMPT_AT)
        self.assertEqual(DiscoveryScoreRefreshService.reconcile()["requested"], 0)
        self.publish.assert_not_called()
