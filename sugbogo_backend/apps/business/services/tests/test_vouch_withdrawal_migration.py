from decimal import Decimal

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase
from django.utils import timezone

from apps.business.services.tests import test_vouch_service as fixtures


class VouchWithdrawalMigrationTests(TransactionTestCase):
    """Keep historical retained endorsements active without changing their evidence."""

    def test_existing_identity_and_evidence_survive_withdrawal_field_migration(self):
        fixtures.BusinessVouchServiceTests.setUpTestData.__func__(type(self))
        executor = MigrationExecutor(connection)
        latest_targets = executor.loader.graph.leaf_nodes()
        self.addCleanup(
            lambda: MigrationExecutor(connection).migrate(latest_targets),
        )
        before_target = [("business", "0030_backfill_pocket_favorites")]
        executor.migrate(before_target)
        old_apps = executor.loader.project_state(before_target).apps
        old_vouch = old_apps.get_model("business", "BusinessVouch")
        invalidated_at = timezone.now()
        vouch = old_vouch.objects.create(
            BUSN_ID_id=self.business.pk,
            USER_ID_id=self.user.pk,
            TAG_ID_id=self.spicy_tag.pk,
            VOUCH_REPUTATION_SNAPSHOT=Decimal("0.37000"),
            VOUCH_EVIDENCE_IS_VALID=False,
            VOUCH_EVIDENCE_INVALIDATED_AT=invalidated_at,
            VOUCH_FLAG_SUSPICIOUS=True,
            VOUCH_INSTALLATION_ID="legacy-installation",
        )
        original = old_vouch.objects.values().get(pk=vouch.pk)

        executor = MigrationExecutor(connection)
        after_target = [("business", "0031_businessvouch_withdrawn_at")]
        executor.migrate(after_target)
        new_apps = executor.loader.project_state(after_target).apps
        new_vouch = new_apps.get_model("business", "BusinessVouch")
        actual = new_vouch.objects.values().get(pk=vouch.pk)

        self.assertIsNone(actual.pop("VOUCH_WITHDRAWN_AT"))
        self.assertEqual(actual, original)
        self.assertTrue(
            any(
                constraint.name == "unique_business_user_tag_vouch"
                for constraint in new_vouch._meta.constraints
            ),
        )
