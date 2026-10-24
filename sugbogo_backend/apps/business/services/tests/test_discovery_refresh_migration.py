from decimal import Decimal

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase
from django.utils import timezone

from apps.business.services.tests import test_discovery_score_service as fixtures


class DiscoveryRefreshMigrationTests(TransactionTestCase):
    """Preserve successful legacy scores while adding refresh provenance."""

    def test_existing_successful_scores_are_not_reinitialized(self):
        fixtures.DiscoveryScoreServiceTests.setUpTestData.__func__(type(self))
        executor = MigrationExecutor(connection)
        latest = executor.loader.graph.leaf_nodes()
        self.addCleanup(lambda: MigrationExecutor(connection).migrate(latest))
        previous = [("business", "0031_businessvouch_withdrawn_at")]
        executor.migrate(previous)
        old_apps = executor.loader.project_state(previous).apps
        score = old_apps.get_model("business", "DiscoveryScore").objects.create(
            BUSN_ID_id=self.business.pk,
            DSC_S_SCORE=Decimal("0.40000"),
            DSC_V_SCORE=Decimal("0.30000"),
            DSC_D_SCORE=Decimal("0.38000"),
            DSC_COMPUTED_AT=timezone.now(),
        )
        original = old_apps.get_model("business", "DiscoveryScore").objects.values().get(pk=score.pk)
        target = [("business", "0032_discovery_score_refresh_state")]
        executor = MigrationExecutor(connection)
        executor.migrate(target)
        new_apps = executor.loader.project_state(target).apps
        migrated = new_apps.get_model("business", "DiscoveryScore").objects.get(pk=score.pk)

        for field, value in original.items():
            self.assertEqual(getattr(migrated, field), value)
        self.assertFalse(migrated.DSC_IS_PROVISIONAL)
        self.assertIsNone(migrated.DSC_REFRESH_REQUESTED_AT)
        self.assertEqual(migrated.DSC_REFRESH_VERSION, 0)
        self.assertEqual(migrated.DSC_LAST_ERROR, "")
