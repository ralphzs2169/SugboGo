from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase

from apps.reviews.models import BusinessReviewSummary
from apps.reviews.services.tests.test_business_review_summary_service import (
    SummaryFixtureMixin,
)


class SentimentProvenanceMigrationTests(SummaryFixtureMixin, TransactionTestCase):
    """Keep legacy sentiment and independent narrative metadata during migration."""

    def setUp(self):
        self.latest_targets = MigrationExecutor(connection).loader.graph.leaf_nodes()
        self.addCleanup(self.restore_schema)

    def restore_schema(self):
        MigrationExecutor(connection).migrate(self.latest_targets)

    def migrate(self, target):
        executor = MigrationExecutor(connection)
        executor.migrate([target])
        return executor.loader.project_state([target]).apps

    def test_forward_reverse_and_forward_leave_legacy_sources_unverified(self):
        business = self.create_business()
        review = self.create_review(business)
        summary = BusinessReviewSummary.objects.create(
            BUSN_ID=business,
            BRSU_REVIEW_COUNT=1,
            BRSU_CLASSIFIED_REVIEW_COUNT=1,
            BRSU_POSITIVE_COUNT=1,
            BRSU_NARRATIVE="Preserve existing narrative.",
            BRSU_KEYWORDS_FINGERPRINT="independent-narrative-source",
        )
        before = BusinessReviewSummary.objects.values().get(pk=summary.pk)
        before.pop("BRSU_SENTIMENT_SOURCES")
        old_target = ("reviews", "0026_review_insight_publication_fence")
        new_target = ("reviews", "0027_business_review_summary_sentiment_sources")
        self.migrate(old_target)
        for target in (new_target, old_target, new_target):
            apps = self.migrate(target)
            stored = apps.get_model("reviews", "BusinessReviewSummary").objects.values().get(
                pk=summary.pk,
            )
            if target == new_target:
                self.assertEqual(stored.pop("BRSU_SENTIMENT_SOURCES"), {})
            self.assertEqual(stored, before)
            self.assertTrue(
                apps.get_model("reviews", "Review").objects.filter(pk=review.pk).exists(),
            )
