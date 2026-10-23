from django.db import OperationalError, connection, transaction
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase

from apps.reviews.models import BusinessReviewSummary
from apps.reviews.services.tests.test_business_review_summary_service import (
    SummaryFixtureMixin,
)


class ReviewInsightRegenerationMigrationTests(SummaryFixtureMixin, TransactionTestCase):
    migrate_from = ("reviews", "0024_review_revw_published_at")
    migrate_to = ("reviews", "0025_review_insight_regeneration")

    def setUp(self):
        self.latest_targets = MigrationExecutor(connection).loader.graph.leaf_nodes()
        self.addCleanup(self.restore_schema)

    def restore_schema(self):
        MigrationExecutor(connection).migrate(self.latest_targets)

    def migrate(self, target):
        executor = MigrationExecutor(connection)
        executor.migrate([target])
        return executor.loader.project_state([target]).apps

    def test_publication_fence_roundtrip_preserves_existing_content_and_demand(self):
        business = self.create_business()
        summary = BusinessReviewSummary.objects.create(
            BUSN_ID=business,
            BRSU_NARRATIVE="Preserved legacy content.",
            BRSU_GENERATION_STATE="outdated",
        )
        before = BusinessReviewSummary.objects.values().get(pk=summary.pk)
        apps = self.migrate(self.migrate_to)
        work_model = apps.get_model("reviews", "ReviewInsightRegeneration")
        record = work_model.objects.create(BUSN_ID_id=business.pk)
        apps = self.migrate(("reviews", "0026_review_insight_publication_fence"))
        work_model = apps.get_model("reviews", "ReviewInsightRegeneration")
        upgraded = work_model.objects.get(pk=record.pk)
        self.assertEqual(upgraded.RIRG_REQUESTED_REVISION, 0)
        self.assertEqual(upgraded.RIRG_COMPLETED_REVISION, 0)
        self.assertEqual(upgraded.RIRG_INPUT_FINGERPRINT, "")
        self.assertIsNone(upgraded.RIRG_RECHECK_AT)
        self.assertEqual(BusinessReviewSummary.objects.values().get(pk=summary.pk), before)
        with self.assertRaises(OperationalError):
            with transaction.atomic():
                BusinessReviewSummary.objects.filter(pk=summary.pk).update(
                    BRSU_NARRATIVE="Unowned publication.",
                )

        self.migrate(self.migrate_to)
        BusinessReviewSummary.objects.filter(pk=summary.pk).update(
            BRSU_NARRATIVE="Preserved legacy content.",
        )
        self.migrate(("reviews", "0026_review_insight_publication_fence"))
        self.assertEqual(BusinessReviewSummary.objects.values().get(pk=summary.pk), before)
        self.assertEqual(work_model.objects.get(pk=record.pk).RIRG_REQUESTED_REVISION, 0)

    def test_forward_backward_forward_preserves_summaries_and_seeds_no_work(self):
        business = self.create_business()
        review = self.create_review(business)
        summary = BusinessReviewSummary.objects.create(
            BUSN_ID=business,
            BRSU_NARRATIVE="Original stored narrative.",
            BRSU_KEYWORD_TAGS=[{"text": "friendly service", "count": 2}],
            BRSU_GENERATION_STATE="outdated",
            BRSU_KEYWORDS_ATTEMPT_FINGERPRINT="original-attempt",
        )
        before = BusinessReviewSummary.objects.values().get(pk=summary.pk)
        self.migrate(self.migrate_from)
        self.assertNotIn(
            "REVIEW_INSIGHT_REGENERATION",
            connection.introspection.table_names(),
        )

        apps = self.migrate(self.migrate_to)
        work_model = apps.get_model("reviews", "ReviewInsightRegeneration")
        summary_model = apps.get_model("reviews", "BusinessReviewSummary")
        self.assertFalse(work_model.objects.exists())
        self.assertEqual(summary_model.objects.values().get(pk=summary.pk), before)
        record = work_model.objects.create(BUSN_ID_id=business.pk)
        self.assertEqual(record.RIRG_REQUESTED_REVISION, 0)
        self.assertEqual(record.RIRG_COMPLETED_REVISION, 0)
        self.assertEqual(record.RIRG_OBSERVED_REVISION, 0)
        self.assertIsNone(record.RIRG_DUE_AT)

        with connection.cursor() as cursor:
            constraints = connection.introspection.get_constraints(
                cursor,
                "REVIEW_INSIGHT_REGENERATION",
            )
        for name in (
            "rirg_revision_order",
            "rirg_observed_deadline",
            "rirg_complete_ownership",
            "rirg_idle_has_no_attempt",
            "rirg_outstanding_due",
            "rirg_unobserved_changes",
            "rirg_active_lease",
        ):
            self.assertIn(name, constraints)

        apps = self.migrate(self.migrate_from)
        self.assertTrue(
            apps.get_model('reviews', 'Review').objects.filter(pk=review.pk).exists(),
        )
        self.assertEqual(
            apps.get_model('reviews', 'BusinessReviewSummary').objects.values().get(
                pk=summary.pk,
            ),
            before,
        )
        apps = self.migrate(self.migrate_to)
        self.assertFalse(
            apps.get_model('reviews', 'ReviewInsightRegeneration').objects.exists(),
        )
        self.assertEqual(
            apps.get_model('reviews', 'BusinessReviewSummary').objects.values().get(
                pk=summary.pk,
            ),
            before,
        )
