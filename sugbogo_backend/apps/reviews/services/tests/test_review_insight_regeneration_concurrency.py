from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier, Event
from unittest.mock import patch

from django.db import connection, connections, transaction
from django.test import TransactionTestCase
from django.utils import timezone

from apps.reviews.models import ReviewInsightRegeneration
from apps.reviews.services.review_insight_regeneration_service import (
    ReviewInsightRegenerationService,
)
from apps.reviews.services.tests.test_business_review_summary_service import (
    SummaryFixtureMixin,
)


class ReviewInsightRegenerationConcurrencyTests(SummaryFixtureMixin, TransactionTestCase):
    def setUp(self):
        if connection.vendor != "postgresql":
            self.skipTest("This test requires independent PostgreSQL sessions.")
        self.business = self.create_business()

    def run_competing(
        self,
        operation,
    ):
        barrier = Barrier(2)

        def run():
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT pg_backend_pid()")
                    backend_pid = cursor.fetchone()[0]
                barrier.wait(timeout=10)
                return backend_pid, operation()
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as executor:
            first = executor.submit(run)
            second = executor.submit(run)
            results = [first.result(timeout=15), second.result(timeout=15)]
        self.assertNotEqual(results[0][0], results[1][0])
        return [result[1] for result in results]

    def make_due(self):
        ReviewInsightRegenerationService.record_change(self.business.pk)
        return timezone.now() + timedelta(seconds=121)

    def test_concurrent_first_changes_create_one_row_without_lost_revisions(self):
        revisions = self.run_competing(
            lambda: ReviewInsightRegenerationService.record_change(self.business.pk),
        )
        self.assertEqual(sorted(revisions), [1, 2])
        self.assertEqual(ReviewInsightRegeneration.objects.count(), 1)
        record = ReviewInsightRegeneration.objects.get(BUSN_ID=self.business)
        self.assertEqual(record.RIRG_REQUESTED_REVISION, 2)
        self.assertEqual(record.RIRG_OBSERVED_REVISION, 2)

    def test_concurrent_updates_of_existing_work_do_not_lose_revisions(self):
        ReviewInsightRegenerationService.record_change(self.business.pk)
        revisions = self.run_competing(
            lambda: ReviewInsightRegenerationService.record_change(self.business.pk),
        )
        self.assertEqual(sorted(revisions), [2, 3])
        self.assertEqual(
            ReviewInsightRegeneration.objects.get(BUSN_ID=self.business).RIRG_REQUESTED_REVISION,
            3,
        )

    def test_competing_workers_can_claim_only_one_current_lease(self):
        with patch(
            "apps.reviews.services.review_insight_regeneration_service.timezone.now",
            return_value=self.make_due(),
        ):
            claims = self.run_competing(
                lambda: ReviewInsightRegenerationService.claim(self.business.pk, lease_seconds=60),
            )
        winners = [claim for claim in claims if claim is not None]
        self.assertEqual(len(winners), 1)
        self.assertEqual(winners[0].RIRG_ATTEMPTS, 1)

    def test_competing_recovery_of_expired_lease_has_one_new_owner(self):
        due = self.make_due()
        with patch(
            "apps.reviews.services.review_insight_regeneration_service.timezone.now",
            return_value=due,
        ):
            old = ReviewInsightRegenerationService.claim(
                self.business.pk,
                lease_seconds=60,
            )
        with patch(
            "apps.reviews.services.review_insight_regeneration_service.timezone.now",
            return_value=due + timedelta(seconds=60),
        ):
            claims = self.run_competing(
                lambda: ReviewInsightRegenerationService.claim(self.business.pk, lease_seconds=60),
            )
        winners = [claim for claim in claims if claim is not None]
        self.assertEqual(len(winners), 1)
        self.assertNotEqual(winners[0].RIRG_ATTEMPT_TOKEN, old.RIRG_ATTEMPT_TOKEN)
        self.assertEqual(winners[0].RIRG_ATTEMPTS, 2)

    def test_change_committing_before_completion_fences_the_older_worker(self):
        due = self.make_due()
        with patch(
            "apps.reviews.services.review_insight_regeneration_service.timezone.now",
            return_value=due,
        ):
            claim = ReviewInsightRegenerationService.claim(
                self.business.pk,
                lease_seconds=60,
            )
        attempted = Event()

        def complete():
            try:
                attempted.set()
                return ReviewInsightRegenerationService.acknowledge_evaluation(
                    self.business.pk,
                    claim.RIRG_CLAIMED_REVISION,
                    claim.RIRG_ATTEMPT_TOKEN,
                )
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=1) as executor:
            with transaction.atomic():
                ReviewInsightRegenerationService.record_change(self.business.pk)
                completion = executor.submit(complete)
                self.assertTrue(attempted.wait(5))
            self.assertFalse(completion.result(timeout=10))
        record = ReviewInsightRegeneration.objects.get(BUSN_ID=self.business)
        self.assertEqual(record.RIRG_REQUESTED_REVISION, 2)
        self.assertEqual(record.RIRG_COMPLETED_REVISION, 0)
