from datetime import timedelta
from unittest.mock import patch
from uuid import uuid4

from django.db import IntegrityError, connection, transaction
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from apps.reviews.models import BusinessReviewSummary, ReviewInsightRegeneration
from apps.reviews.services.review_insight_regeneration_service import (
    ReviewInsightRegenerationService,
)
from apps.reviews.services.tests.test_business_review_summary_service import (
    SummaryFixtureMixin,
)


class ReviewInsightRegenerationServiceTests(SummaryFixtureMixin, TransactionTestCase):
    def setUp(self):
        self.business = self.create_business()
        self.started_at = timezone.now()

    def clock(
        self,
        seconds,
    ):
        return patch(
            "apps.reviews.services.review_insight_regeneration_service.timezone.now",
            return_value=self.started_at + timedelta(seconds=seconds),
        )

    def change(
        self,
        seconds=0,
    ):
        with self.clock(seconds):
            return ReviewInsightRegenerationService.record_change(self.business.pk)

    def state(self):
        return ReviewInsightRegeneration.objects.get(BUSN_ID=self.business)

    def claim(
        self,
        seconds=120,
        lease_seconds=60,
    ):
        with self.clock(seconds):
            return ReviewInsightRegenerationService.claim(
                self.business.pk,
                lease_seconds=lease_seconds,
            )

    def acknowledge(
        self,
        claim,
        seconds=121,
    ):
        with self.clock(seconds):
            return ReviewInsightRegenerationService.acknowledge_evaluation(
                self.business.pk,
                claim.RIRG_CLAIMED_REVISION,
                claim.RIRG_ATTEMPT_TOKEN,
            )

    def test_initial_state_does_not_acknowledge_or_copy_legacy_summary(self):
        summary = BusinessReviewSummary.objects.create(
            BUSN_ID=self.business,
            BRSU_NARRATIVE="Existing generated content.",
            BRSU_GENERATION_STATE="ready",
            BRSU_GENERATED_AT=self.started_at,
        )
        before = BusinessReviewSummary.objects.values().get(pk=summary.pk)
        record = ReviewInsightRegenerationService.get_or_create(self.business.pk)

        self.assertEqual(record.RIRG_REQUESTED_REVISION, 0)
        self.assertEqual(record.RIRG_COMPLETED_REVISION, 0)
        self.assertEqual(record.RIRG_OBSERVED_REVISION, 0)
        self.assertIsNone(record.RIRG_FIRST_CHANGED_AT)
        self.assertIsNone(record.RIRG_DUE_AT)
        self.assertIsNone(record.RIRG_ATTEMPT_TOKEN)
        self.assertFalse(ReviewInsightRegenerationService.outstanding_work().exists())
        self.assertEqual(
            BusinessReviewSummary.objects.values().get(
                pk=summary.pk,
            ),
            before,
        )

    def test_initial_state_without_summary_is_lazy_and_idle(self):
        self.assertFalse(ReviewInsightRegeneration.objects.exists())
        first = ReviewInsightRegenerationService.get_or_create(self.business.pk)
        second = ReviewInsightRegenerationService.get_or_create(self.business.pk)
        self.assertEqual(first.pk, second.pk)
        self.assertFalse(BusinessReviewSummary.objects.exists())
        self.assertIsNone(self.claim())

    def test_missing_business_does_not_create_work(self):
        with self.assertRaises(NotFound):
            ReviewInsightRegenerationService.record_change(self.business.pk + 100)
        self.assertFalse(ReviewInsightRegeneration.objects.exists())

    def test_first_change_is_observed_after_commit_and_due_in_120_seconds(self):
        self.assertEqual(self.change(), 1)
        record = self.state()
        self.assertEqual(record.RIRG_COMPLETED_REVISION, 0)
        self.assertEqual(record.RIRG_OBSERVED_REVISION, 1)
        self.assertEqual(record.RIRG_FIRST_CHANGED_AT, self.started_at)
        self.assertEqual(record.RIRG_LATEST_CHANGED_AT, self.started_at)
        self.assertEqual(record.RIRG_DUE_AT, self.started_at + timedelta(seconds=120))
        self.assertTrue(timezone.is_aware(record.RIRG_DUE_AT))

    def test_rapid_changes_reset_quiet_deadline_without_resetting_first_change(self):
        self.change()
        self.assertEqual(self.change(90), 2)
        record = self.state()
        self.assertEqual(record.RIRG_FIRST_CHANGED_AT, self.started_at)
        self.assertEqual(
            record.RIRG_LATEST_CHANGED_AT,
            self.started_at + timedelta(seconds=90),
        )
        self.assertEqual(record.RIRG_DUE_AT, self.started_at + timedelta(seconds=210))
        self.assertIsNone(self.claim(209))
        self.assertIsNotNone(self.claim(210))

    def test_continuous_changes_cannot_extend_deadline_past_600_seconds(self):
        for seconds in (0, 100, 200, 300, 400, 500, 590):
            self.change(seconds)
        self.assertEqual(
            self.state().RIRG_DUE_AT,
            self.started_at + timedelta(seconds=600),
        )
        self.assertIsNone(self.claim(599))
        self.assertIsNotNone(self.claim(600))

    def test_long_mutation_transaction_does_not_consume_quiet_period(self):
        with self.clock(0) as now:
            with transaction.atomic():
                ReviewInsightRegenerationService.record_change(self.business.pk)
                record = self.state()
                self.assertEqual(record.RIRG_REQUESTED_REVISION, 1)
                self.assertEqual(record.RIRG_OBSERVED_REVISION, 0)
                self.assertIsNone(record.RIRG_DUE_AT)
                now.return_value = self.started_at + timedelta(seconds=900)
            record = self.state()
        self.assertEqual(
            record.RIRG_FIRST_CHANGED_AT,
            self.started_at + timedelta(seconds=900),
        )
        self.assertEqual(record.RIRG_DUE_AT, self.started_at + timedelta(seconds=1020))

    def test_multiple_changes_in_one_transaction_coalesce_commit_observation(self):
        with self.clock(0):
            with transaction.atomic():
                ReviewInsightRegenerationService.record_change(self.business.pk)
                ReviewInsightRegenerationService.record_change(self.business.pk)
                self.assertEqual(self.state().RIRG_OBSERVED_REVISION, 0)
        record = self.state()
        self.assertEqual(record.RIRG_REQUESTED_REVISION, 2)
        self.assertEqual(record.RIRG_OBSERVED_REVISION, 2)
        self.assertEqual(record.RIRG_DUE_AT, self.started_at + timedelta(seconds=120))

    def test_lost_commit_callback_leaves_discoverable_recoverable_demand(self):
        with patch.object(
            ReviewInsightRegenerationService,
            "observe_changes",
            side_effect=RuntimeError("Observer unavailable"),
        ):
            with self.assertLogs("django.db.backends.base", level="ERROR"):
                self.change()
        self.assertEqual(ReviewInsightRegenerationService.unobserved_work().count(), 1)
        self.assertFalse(ReviewInsightRegenerationService.due_work().exists())

        with self.clock(900):
            ReviewInsightRegenerationService.observe_changes(self.business.pk)
        self.assertEqual(
            self.state().RIRG_DUE_AT,
            self.started_at + timedelta(seconds=1020),
        )
        self.assertFalse(ReviewInsightRegenerationService.unobserved_work().exists())

    def test_duplicate_observation_and_early_delivery_do_not_reset_deadline(self):
        self.change()
        before = self.state()
        with self.clock(90):
            ReviewInsightRegenerationService.observe_changes(self.business.pk)
            list(ReviewInsightRegenerationService.outstanding_work())
            list(ReviewInsightRegenerationService.due_work())
            self.assertIsNone(self.claim(90))
        after = self.state()
        self.assertEqual(after.RIRG_REQUESTED_REVISION, before.RIRG_REQUESTED_REVISION)
        self.assertEqual(after.RIRG_FIRST_CHANGED_AT, before.RIRG_FIRST_CHANGED_AT)
        self.assertEqual(after.RIRG_DUE_AT, before.RIRG_DUE_AT)

    def test_due_query_observes_retry_and_live_ownership_boundaries(self):
        self.change()
        with self.clock(119):
            self.assertFalse(ReviewInsightRegenerationService.due_work().exists())
        with self.clock(120):
            self.assertTrue(ReviewInsightRegenerationService.due_work().exists())
        claim = self.claim()
        self.assertEqual(claim.RIRG_ATTEMPTS, 1)
        self.assertIsNone(self.claim(121))
        with self.clock(179):
            self.assertFalse(ReviewInsightRegenerationService.due_work().exists())
        with self.clock(180):
            self.assertTrue(ReviewInsightRegenerationService.due_work().exists())

    def test_expired_claim_can_be_recovered_and_reclaimed_with_new_token(self):
        self.change()
        old = self.claim()
        with self.clock(179):
            self.assertFalse(
                ReviewInsightRegenerationService.recover_expired(
                    self.business.pk,
                ),
            )
        with self.clock(180):
            self.assertTrue(
                ReviewInsightRegenerationService.recover_expired(
                    self.business.pk,
                ),
            )
            self.assertFalse(
                ReviewInsightRegenerationService.recover_expired(
                    self.business.pk,
                ),
            )
        new = self.claim(180)
        self.assertNotEqual(new.RIRG_ATTEMPT_TOKEN, old.RIRG_ATTEMPT_TOKEN)
        self.assertEqual(new.RIRG_ATTEMPTS, 2)
        self.assertFalse(self.acknowledge(old, 181))
        self.assertTrue(self.acknowledge(new, 181))

    def test_claim_itself_recovers_expired_ownership(self):
        self.change()
        old = self.claim()
        self.assertFalse(self.acknowledge(old, 180))
        new = self.claim(180)
        self.assertIsNotNone(new)
        self.assertNotEqual(new.RIRG_ATTEMPT_TOKEN, old.RIRG_ATTEMPT_TOKEN)

    def test_stale_token_and_wrong_revision_cannot_acknowledge(self):
        self.change()
        claim = self.claim()
        with self.clock(121):
            self.assertFalse(ReviewInsightRegenerationService.acknowledge_evaluation(
                self.business.pk,
                claim.RIRG_CLAIMED_REVISION,
                uuid4(),
            ))
            self.assertFalse(ReviewInsightRegenerationService.acknowledge_evaluation(
                self.business.pk,
                claim.RIRG_CLAIMED_REVISION + 1,
                claim.RIRG_ATTEMPT_TOKEN,
            ))
        self.assertEqual(self.state().RIRG_COMPLETED_REVISION, 0)

    def test_new_revision_during_generation_prevents_old_completion_and_failure(self):
        self.change()
        claim = self.claim()
        self.change(130)
        self.assertFalse(self.acknowledge(claim, 131))
        with self.clock(131):
            self.assertFalse(ReviewInsightRegenerationService.record_failure(
                self.business.pk,
                claim.RIRG_CLAIMED_REVISION,
                claim.RIRG_ATTEMPT_TOKEN,
                error_code="old_provider_failure",
                retry_after_seconds=300,
            ))
            self.assertTrue(ReviewInsightRegenerationService.release_claim(
                self.business.pk,
                claim.RIRG_CLAIMED_REVISION,
                claim.RIRG_ATTEMPT_TOKEN,
            ))
        record = self.state()
        self.assertEqual(record.RIRG_FIRST_CHANGED_AT, self.started_at)
        self.assertEqual(record.RIRG_DUE_AT, self.started_at + timedelta(seconds=250))
        self.assertEqual(record.RIRG_LAST_ERROR, "")
        self.assertEqual(record.RIRG_COMPLETED_REVISION, 0)
        self.assertTrue(self.acknowledge(self.claim(250), 251))

    def test_superseded_attempt_does_not_restart_maximum_wait_period(self):
        for seconds in (0, 110, 220, 330, 440, 550):
            self.change(seconds)
        claim = self.claim(600)
        self.change(610)
        with self.clock(611):
            ReviewInsightRegenerationService.release_claim(
                self.business.pk,
                claim.RIRG_CLAIMED_REVISION,
                claim.RIRG_ATTEMPT_TOKEN,
            )
        self.assertEqual(
            self.state().RIRG_DUE_AT,
            self.started_at + timedelta(seconds=600),
        )
        self.assertIsNotNone(self.claim(611))

    def test_failure_persists_backoff_without_advancing_or_resetting_demand(self):
        self.change()
        claim = self.claim()
        with self.clock(121):
            self.assertTrue(ReviewInsightRegenerationService.record_failure(
                self.business.pk,
                claim.RIRG_CLAIMED_REVISION,
                claim.RIRG_ATTEMPT_TOKEN,
                error_code="provider_timeout",
                retry_after_seconds=300,
            ))
        record = self.state()
        self.assertEqual(record.RIRG_REQUESTED_REVISION, 1)
        self.assertEqual(record.RIRG_COMPLETED_REVISION, 0)
        self.assertEqual(record.RIRG_FIRST_CHANGED_AT, self.started_at)
        self.assertEqual(record.RIRG_DUE_AT, self.started_at + timedelta(seconds=120))
        self.assertEqual(
            record.RIRG_RETRY_NOT_BEFORE,
            self.started_at + timedelta(seconds=421),
        )
        self.assertEqual(record.RIRG_LAST_ERROR, "provider_timeout")
        self.assertIsNone(record.RIRG_ATTEMPT_TOKEN)
        self.assertIsNone(self.claim(420))
        with self.clock(420):
            self.assertFalse(ReviewInsightRegenerationService.due_work().exists())
        self.assertEqual(self.claim(421).RIRG_ATTEMPTS, 2)

    def test_new_change_preserves_recovery_backoff_and_due_uses_later_deadline(self):
        self.change()
        claim = self.claim()
        with self.clock(121):
            ReviewInsightRegenerationService.record_failure(
                self.business.pk,
                claim.RIRG_CLAIMED_REVISION,
                claim.RIRG_ATTEMPT_TOKEN,
                error_code="provider_timeout",
                retry_after_seconds=20,
            )
        self.change(130)
        self.assertIsNone(self.claim(249))
        self.assertIsNotNone(self.claim(250))

    def test_old_failure_after_newer_success_cannot_change_completion_metadata(self):
        self.change()
        old = self.claim()
        new = self.claim(180)
        self.assertTrue(self.acknowledge(new, 181))
        before = ReviewInsightRegeneration.objects.values().get(BUSN_ID=self.business)
        with self.clock(182):
            self.assertFalse(ReviewInsightRegenerationService.record_failure(
                self.business.pk,
                old.RIRG_CLAIMED_REVISION,
                old.RIRG_ATTEMPT_TOKEN,
                error_code="obsolete_failure",
                retry_after_seconds=300,
            ))
        self.assertFalse(self.acknowledge(old, 182))
        self.assertEqual(
            ReviewInsightRegeneration.objects.values().get(
                BUSN_ID=self.business,
            ),
            before,
        )

    def test_old_token_cannot_release_or_fail_a_new_revision_after_success(self):
        self.change()
        old = self.claim()
        self.change(130)
        new = self.claim(250)
        self.assertTrue(self.acknowledge(new, 251))
        before = ReviewInsightRegeneration.objects.values().get(BUSN_ID=self.business)
        with self.clock(252):
            self.assertFalse(ReviewInsightRegenerationService.release_claim(
                self.business.pk,
                old.RIRG_CLAIMED_REVISION,
                old.RIRG_ATTEMPT_TOKEN,
            ))
            self.assertFalse(ReviewInsightRegenerationService.record_failure(
                self.business.pk,
                old.RIRG_CLAIMED_REVISION,
                old.RIRG_ATTEMPT_TOKEN,
                error_code="late_failure",
                retry_after_seconds=300,
            ))
        self.assertEqual(
            ReviewInsightRegeneration.objects.values().get(BUSN_ID=self.business),
            before,
        )

    def test_failure_transaction_rollback_preserves_the_original_claim(self):
        self.change()
        claim = self.claim()
        with self.clock(121):
            with self.assertRaises(RuntimeError):
                with transaction.atomic():
                    self.assertTrue(ReviewInsightRegenerationService.record_failure(
                        self.business.pk,
                        claim.RIRG_CLAIMED_REVISION,
                        claim.RIRG_ATTEMPT_TOKEN,
                        error_code="provider_timeout",
                        retry_after_seconds=60,
                    ))
                    raise RuntimeError("Rollback")
        record = self.state()
        self.assertEqual(record.RIRG_ATTEMPT_TOKEN, claim.RIRG_ATTEMPT_TOKEN)
        self.assertIsNone(record.RIRG_RETRY_NOT_BEFORE)
        self.assertEqual(record.RIRG_LAST_ERROR, "")

    def test_deleted_business_is_ignored_by_recovery_and_late_workers(self):
        self.change()
        claim = self.claim()
        business_id = self.business.pk
        self.business.delete()
        self.assertFalse(ReviewInsightRegeneration.objects.exists())
        self.assertFalse(ReviewInsightRegenerationService.observe_changes(business_id))
        self.assertFalse(ReviewInsightRegenerationService.recover_expired(business_id))
        self.assertIsNone(ReviewInsightRegenerationService.claim(
            business_id,
            lease_seconds=60,
        ))
        self.assertFalse(ReviewInsightRegenerationService.acknowledge_evaluation(
            business_id,
            claim.RIRG_CLAIMED_REVISION,
            claim.RIRG_ATTEMPT_TOKEN,
        ))

    def test_success_ends_period_and_next_change_starts_a_new_one(self):
        self.change()
        claim = self.claim()
        self.assertTrue(self.acknowledge(claim))
        self.assertFalse(self.acknowledge(claim))
        record = self.state()
        self.assertEqual(record.RIRG_COMPLETED_REVISION, 1)
        self.assertIsNone(record.RIRG_FIRST_CHANGED_AT)
        self.assertIsNone(record.RIRG_DUE_AT)
        self.assertFalse(ReviewInsightRegenerationService.outstanding_work().exists())
        self.assertEqual(self.change(300), 2)
        self.assertEqual(
            self.state().RIRG_FIRST_CHANGED_AT,
            self.started_at + timedelta(seconds=300),
        )
        self.assertEqual(self.state().RIRG_ATTEMPTS, 0)

    def test_mutation_rollback_discards_revision_and_commit_observation(self):
        with patch.object(ReviewInsightRegenerationService, "observe_changes") as observe:
            with self.assertRaises(RuntimeError):
                with transaction.atomic():
                    ReviewInsightRegenerationService.record_change(self.business.pk)
                    raise RuntimeError("Rollback")
        self.assertFalse(ReviewInsightRegeneration.objects.exists())
        observe.assert_not_called()

    def test_acknowledgement_rolls_back_with_publication_transaction(self):
        self.change()
        claim = self.claim()
        with self.assertRaises(RuntimeError):
            with transaction.atomic():
                self.assertTrue(self.acknowledge(claim))
                raise RuntimeError("Publication failed")
        self.assertEqual(self.state().RIRG_COMPLETED_REVISION, 0)
        self.assertEqual(self.state().RIRG_ATTEMPT_TOKEN, claim.RIRG_ATTEMPT_TOKEN)

    def test_claim_and_observation_reject_precommit_calls(self):
        with transaction.atomic():
            with self.assertRaises(ValidationError):
                ReviewInsightRegenerationService.observe_changes(self.business.pk)
            with self.assertRaises(ValidationError):
                ReviewInsightRegenerationService.claim(
                    self.business.pk,
                    lease_seconds=60,
                )
        self.assertFalse(connection.in_atomic_block)

    def test_invalid_lease_and_failure_inputs_are_rejected(self):
        for seconds in (0, -1, True):
            with self.subTest(seconds=seconds), self.assertRaises(ValidationError):
                ReviewInsightRegenerationService.claim(
                    self.business.pk,
                    lease_seconds=seconds,
                )
        with self.assertRaises(ValidationError):
            ReviewInsightRegenerationService.record_failure(
                self.business.pk,
                1,
                uuid4(),
                error_code="Do not store provider URLs or secrets here",
                retry_after_seconds=10,
            )

    def test_database_enforces_revision_deadline_ownership_and_uniqueness(self):
        record = ReviewInsightRegenerationService.get_or_create(self.business.pk)
        invalid_updates = [
            {"RIRG_COMPLETED_REVISION": 1},
            {"RIRG_OBSERVED_REVISION": 1},
            {"RIRG_ATTEMPT_TOKEN": uuid4()},
            {"RIRG_RETRY_NOT_BEFORE": self.started_at},
            {"RIRG_DUE_AT": self.started_at},
        ]
        for values in invalid_updates:
            with self.subTest(values=values):
                with self.assertRaises(IntegrityError), transaction.atomic():
                    ReviewInsightRegeneration.objects.filter(pk=record.pk).update(
                        **values,
                    )
        with self.assertRaises(IntegrityError), transaction.atomic():
            ReviewInsightRegeneration.objects.create(BUSN_ID=self.business)

        self.change()
        with self.assertRaises(IntegrityError), transaction.atomic():
            ReviewInsightRegeneration.objects.filter(pk=record.pk).update(
                RIRG_DUE_AT=self.started_at + timedelta(seconds=121),
            )
