from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase

from apps.review_disputes.models import (
    MerchantReviewDispute,
    MerchantReviewDisputeEvidence,
    MerchantReviewDisputeSnapshot,
)
from apps.review_disputes.services.tests.test_review_snapshots import SnapshotFixtures


class ReviewSnapshotMigrationTests(SnapshotFixtures, TransactionTestCase):
    def test_existing_attempts_keep_identities_and_evidence_without_a_snapshot(self):
        targets = MigrationExecutor(connection).loader.graph.leaf_nodes()
        self.addCleanup(lambda: MigrationExecutor(connection).migrate(targets))
        executor = MigrationExecutor(connection)
        old_target = [("review_disputes", "0004_alter_merchantreviewdispute_mrdsp_reason")]
        executor.migrate(old_target)
        old_apps = executor.loader.project_state(old_target).apps
        legacy = old_apps.get_model("review_disputes", "MerchantReviewDispute").objects.create(
            REVW_ID_id=self.review.pk,
            BUSN_ID_id=self.business.pk,
            USER_ID_id=self.merchant.pk,
            MRDSP_REASON="fake_review",
            MRDSP_DESCRIPTION="Legacy evidence must remain historical.",
        )
        evidence = old_apps.get_model(
            "review_disputes",
            "MerchantReviewDisputeEvidence",
        ).objects.create(
            MRDSP_ID_id=legacy.pk,
            MRDSE_TYPE="image",
            MRDSE_URL="https://example.com/legacy-evidence.jpg",
            MRDSE_PUBLIC_ID="dispute/legacy-evidence",
        )
        MigrationExecutor(connection).migrate(targets)
        restored = MerchantReviewDispute.objects.get(pk=legacy.pk)
        self.assertEqual(restored.MRDSP_ORIGINAL_REVIEW_ID, self.review.pk)
        self.assertEqual(restored.MRDSP_ORIGINAL_BUSINESS_ID, self.business.pk)
        self.assertEqual(restored.MRDSP_ORIGINAL_MERCHANT_ID, self.merchant.pk)
        self.assertEqual(restored.MRDSP_CREATED_AT, legacy.MRDSP_CREATED_AT)
        self.assertEqual(restored.MRDSP_STATUS, "pending")
        self.assertTrue(MerchantReviewDisputeEvidence.objects.filter(pk=evidence.pk).exists())
        self.assertFalse(MerchantReviewDisputeSnapshot.objects.exists())
        self.assertTrue(self.detail(restored)["filing_snapshot_unavailable"])
