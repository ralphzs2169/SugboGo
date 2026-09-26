from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase

from apps.reviews.services.tests.test_business_review_summary_service import (
    SummaryFixtureMixin,
)


class BusinessReviewSummaryMigrationTests(SummaryFixtureMixin, TransactionTestCase):
    """Verifies summary-table migration reversibility and source preservation."""

    migrate_from = ("reviews", "0005_replytemplate")
    migrate_to = ("reviews", "0006_businessreviewsummary")

    def setUp(self):
        super().setUp()
        self.latest_targets = MigrationExecutor(connection).loader.graph.leaf_nodes()
        self.addCleanup(self.restore_schema)

    def restore_schema(self):
        MigrationExecutor(connection).migrate(self.latest_targets)

    def migrate(self, target):
        executor = MigrationExecutor(connection)
        executor.migrate([target])
        return executor.loader.project_state([target]).apps

    def test_forward_backward_and_forward_preserve_business_and_reviews(self):
        self.migrate(self.migrate_from)
        self.assertNotIn("BUSINESS_REVIEW_SUMMARY", connection.introspection.table_names())
        business = self.create_business()
        review = self.create_review(business)

        apps = self.migrate(self.migrate_to)
        summary_model = apps.get_model("reviews", "BusinessReviewSummary")
        summary = summary_model.objects.create(
            BUSN_ID_id=business.pk,
            BRSU_POSITIVE_COUNT=1,
            BRSU_CLASSIFIED_REVIEW_COUNT=1,
            BRSU_REVIEW_COUNT=1,
            BRSU_KEYWORD_TAGS=[{"text": "friendly service", "count": 1}],
        )
        stored = summary_model.objects.get(pk=summary.pk)
        self.assertEqual(stored.BRSU_KEYWORD_TAGS, [{"text": "friendly service", "count": 1}])
        with connection.cursor() as cursor:
            constraints = connection.introspection.get_constraints(
                cursor, "BUSINESS_REVIEW_SUMMARY",
            )
        self.assertTrue(any(
            item["unique"] and item["columns"] == ["BUSN_ID"]
            for item in constraints.values()
        ))
        self.assertIn("brsu_classified_matches_counts", constraints)
        self.assertIn("brsu_classified_lte_reviews", constraints)

        apps = self.migrate(self.migrate_from)
        self.assertNotIn("BUSINESS_REVIEW_SUMMARY", connection.introspection.table_names())
        self.assertTrue(apps.get_model("business", "Business").objects.filter(pk=business.pk).exists())
        self.assertTrue(apps.get_model("reviews", "Review").objects.filter(pk=review.pk).exists())

        apps = self.migrate(self.migrate_to)
        self.assertFalse(apps.get_model("reviews", "BusinessReviewSummary").objects.exists())

    def test_keyword_tracking_migration_preserves_existing_summary(self):
        apps = self.migrate(self.migrate_to)
        business = self.create_business()
        summary_model = apps.get_model("reviews", "BusinessReviewSummary")
        original = summary_model.objects.create(
            BUSN_ID_id=business.pk,
            BRSU_KEYWORD_TAGS=[{"text": "friendly service", "count": 2}],
        )
        target = ("reviews", "0007_businessreviewsummary_keyword_tracking")
        apps = self.migrate(target)
        stored = apps.get_model("reviews", "BusinessReviewSummary").objects.get(pk=original.pk)
        self.assertEqual(stored.BRSU_KEYWORDS_FINGERPRINT, "")
        self.assertIsNone(stored.BRSU_KEYWORDS_ATTEMPTED_AT)
        self.assertFalse(stored.BRSU_KEYWORDS_RETRYABLE)
        self.assertEqual(stored.BRSU_KEYWORD_TAGS, original.BRSU_KEYWORD_TAGS)
        apps = self.migrate(self.migrate_to)
        restored = apps.get_model("reviews", "BusinessReviewSummary").objects.get(pk=original.pk)
        self.assertEqual(restored.BRSU_KEYWORD_TAGS, original.BRSU_KEYWORD_TAGS)

    def test_narrative_fields_migration_preserves_existing_summary(self):
        keyword_target = (
            "reviews",
            "0007_businessreviewsummary_keyword_tracking",
        )
        apps = self.migrate(keyword_target)
        business = self.create_business()
        summary_model = apps.get_model("reviews", "BusinessReviewSummary")
        original = summary_model.objects.create(
            BUSN_ID_id=business.pk,
            BRSU_KEYWORD_TAGS=[{"text": "friendly service", "count": 2}],
        )

        narrative_target = (
            "reviews",
            "0008_businessreviewsummary_narrative_fields",
        )
        apps = self.migrate(narrative_target)
        stored = apps.get_model("reviews", "BusinessReviewSummary").objects.get(
            pk=original.pk,
        )
        self.assertEqual(stored.BRSU_KEYWORD_TAGS, original.BRSU_KEYWORD_TAGS)
        self.assertEqual(stored.BRSU_NARRATIVE, "")
        self.assertEqual(stored.BRSU_SUPPORTING_REVIEW_REFERENCES, {})
        self.assertEqual(stored.BRSU_ELIGIBLE_REVIEW_COUNT, 0)
        self.assertEqual(stored.BRSU_ANALYZED_REVIEW_COUNT, 0)
        self.assertEqual(stored.BRSU_GENERATION_STATE, "pending")
        self.assertIsNone(stored.BRSU_GENERATED_AT)

        apps = self.migrate(keyword_target)
        restored = apps.get_model("reviews", "BusinessReviewSummary").objects.get(
            pk=original.pk,
        )
        self.assertEqual(restored.BRSU_KEYWORD_TAGS, original.BRSU_KEYWORD_TAGS)
