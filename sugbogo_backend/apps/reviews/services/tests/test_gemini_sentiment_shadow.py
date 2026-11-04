import json
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from datetime import timedelta
from unittest.mock import patch

from django.db import transaction, connection, connections
from django.test import SimpleTestCase, TestCase, TransactionTestCase, override_settings
from django.utils import timezone

from apps.reviews.models import Review, ReviewSentimentShadow as Shadow, ReviewRatingResult, BusinessRating
from apps.reviews.services.gemini_sentiment_contract import contract_version, validate_output, normalize_provider_output
from apps.reviews.services.gemini_sentiment_shadow_service import GeminiSentimentShadowService as Service
from apps.reviews.services.review_service import ReviewService
from apps.reviews.services.tests.test_business_review_summary_service import SummaryFixtureMixin
from apps.shared.services.gemini_structured_service import PermanentGenerationError, TransientGenerationError

PAYLOAD = {'label': 'positive', 'score': 0.5, 'eligible': True, 'reason': 'evaluative'}
PROVIDER = 'apps.reviews.services.gemini_sentiment_shadow_service.GeminiStructuredService.generate'


class GeminiContractTests(SimpleTestCase):
    def test_exclusion_placeholder_is_dropped_without_creating_a_neutral_rating(self):
        original = dict(label='neutral', score=0, eligible=False, reason='factual')
        result, corrected = normalize_provider_output(original)
        self.assertTrue(corrected)
        self.assertIsNone(result['score'])
        self.assertFalse(result['eligible'])
        self.assertEqual(original['score'], 0)

    def test_placeholder_correction_rejects_other_contradictions(self):
        for score in (True, 0.5, -1):
            with self.subTest(score=score), self.assertRaises(ValueError):
                normalize_provider_output(dict(label='neutral', score=score, eligible=False, reason='factual'))
        with self.assertRaises(ValueError):
            normalize_provider_output(dict(label='positive', score=0, eligible=False, reason='factual'))

    def test_eligible_zero_remains_a_valid_balanced_rating(self):
        result, corrected = normalize_provider_output(dict(label='neutral', score=0, eligible=True, reason='evaluative'))
        self.assertFalse(corrected)
        self.assertEqual(result['score'], 0)

    def test_factual_zero_is_rejected_instead_of_becoming_three_stars(self):
        with self.assertRaisesRegex(ValueError, 'invalid_exclusion'):
            validate_output(dict(label='neutral', score=0, eligible=False, reason='factual'))

    def test_schema_change_invalidates_previously_scored_cohort(self):
        from apps.reviews.services import gemini_sentiment_contract as contract
        current = contract_version('gemini-test')
        previous_schema = {key: value for key, value in contract.SCHEMA.items() if key != 'anyOf'}
        with patch.object(contract, 'SCHEMA', previous_schema):
            self.assertNotEqual(current, contract_version('gemini-test'))

    def test_all_anchors_and_exclusions(self):
        for score in [-1, -0.5, 0, 0.5, 1]:
            label = 'positive' if score > 0 else 'negative' if score < 0 else 'neutral'
            self.assertEqual(validate_output(dict(PAYLOAD, score=score, label=label))['score'], score)
        for reason in ['factual', 'uncertain']:
            self.assertIsNone(validate_output(dict(label='neutral', score=None, eligible=False, reason=reason))['score'])

    def test_invalid_outputs_never_become_neutral(self):
        for value in [None, [], dict(PAYLOAD, score=True), dict(PAYLOAD, score=0.8), dict(PAYLOAD, score=float('nan')), dict(PAYLOAD, label='negative'), dict(PAYLOAD, extra='x'), dict(PAYLOAD, eligible='true'), dict(PAYLOAD, eligible=False), dict(PAYLOAD, score=None), dict(PAYLOAD, label=[]), dict(PAYLOAD, reason='factual')]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                validate_output(value)

    def test_model_changes_version(self):
        self.assertNotEqual(contract_version('a'), contract_version('b'))


@override_settings(GEMINI_SENTIMENT_SHADOW_ENABLED=True, GEMINI_SENTIMENT_SHADOW_MODEL='gemini-test')
class GeminiShadowTests(SummaryFixtureMixin, TestCase):
    def setUp(self):
        self.business = self.create_business()
        self.review = self.create_review(self.business, REVW_STATUS=Review.ReviewStatus.PUBLISHED)
        self.scope = override_settings(GEMINI_SENTIMENT_SHADOW_BUSINESS_IDS={self.business.pk})
        self.scope.enable()
        self.addCleanup(self.scope.disable)

    def job(self):
        """Queue without executing real broker callbacks in the test transaction."""
        return Service.request(self.review.pk)

    @override_settings(GEMINI_SENTIMENT_SHADOW_ENABLED=False)
    def test_disabled_never_reads_shadow_table(self):
        with self.assertNumQueries(0):
            self.assertIsNone(Service.request(self.review.pk))
            self.assertEqual(Service.process(1), 'disabled')
            self.assertEqual(Service.recover(), 0)

    def test_scope_status_and_empty_text(self):
        with override_settings(GEMINI_SENTIMENT_SHADOW_BUSINESS_IDS=set()):
            self.assertIsNone(self.job())
        Review.objects.filter(pk=self.review.pk).update(REVW_STATUS=Review.ReviewStatus.REJECTED)
        self.assertIsNone(self.job())
        Review.objects.filter(pk=self.review.pk).update(REVW_STATUS=Review.ReviewStatus.PUBLISHED, REVW_TEXT='  ')
        self.assertIsNone(self.job())
        self.assertEqual(Shadow.objects.count(), 0)

    def test_idempotence_and_legacy_isolation(self):
        job = self.job()
        self.assertEqual(self.job(), job)
        with patch(PROVIDER, return_value=(json.dumps(PAYLOAD), {'total_tokens': 10})) as provider:
            self.assertEqual(Service.process(job), 'ready')
            self.assertEqual(Service.process(job), 'ready')
            provider.assert_called_once()
        self.review.refresh_from_db()
        self.assertEqual(self.review.REVW_SENTIMENT_SCORE, 0.75)
        self.assertEqual(self.review.REVW_SENTIMENT_LABEL, 'positive')
        self.assertEqual(self.review.REVW_STATUS, Review.ReviewStatus.PUBLISHED)
        self.assertFalse(ReviewRatingResult.objects.exists())
        self.assertFalse(BusinessRating.objects.exists())
        self.assertEqual(Shadow.objects.get(pk=job).RSSH_SCORE, 0.5)

    def test_factual_null_is_not_legacy_zero(self):
        with patch(PROVIDER, return_value=(json.dumps(dict(label='neutral', score=None, eligible=False, reason='factual')), {})):
            job = self.job()
            self.assertEqual(Service.process(job), 'ready')
        result = Shadow.objects.get(pk=job)
        self.assertIsNone(result.RSSH_SCORE)
        self.assertFalse(result.RSSH_ELIGIBLE)
        self.review.refresh_from_db()
        self.assertEqual(self.review.REVW_SENTIMENT_SCORE, 0.75)

    def test_factual_zero_placeholder_records_correction_without_rating_input(self):
        with patch(PROVIDER, return_value=(json.dumps(dict(label='neutral', score=0, eligible=False, reason='factual')), {})):
            job = self.job()
            self.assertEqual(Service.process(job), 'ready')
        row = Shadow.objects.get(pk=job)
        self.assertIsNone(row.RSSH_SCORE)
        self.assertFalse(row.RSSH_ELIGIBLE)
        self.assertEqual(row.RSSH_USAGE['normalization'], 'excluded_zero_to_null')
        self.assertFalse(ReviewRatingResult.objects.exists())

    def test_edit_during_inference_discards_result(self):
        job = self.job()
        def edit(**kwargs):
            """Simulate a committed edit while the external call is in flight."""
            Review.objects.filter(pk=self.review.pk).update(REVW_TEXT='Different review.')
            return json.dumps(PAYLOAD), {}
        with patch(PROVIDER, side_effect=edit):
            self.assertEqual(Service.process(job), 'stale')
        self.assertIsNone(Shadow.objects.get(pk=job).RSSH_SCORE)
        self.assertNotEqual(self.job(), job)

    def test_rejection_during_inference_discards_result(self):
        job = self.job()
        def reject(**kwargs):
            """Simulate a moderator rejecting the review while inference is in flight."""
            Review.objects.filter(pk=self.review.pk).update(REVW_STATUS=Review.ReviewStatus.REJECTED)
            return json.dumps(PAYLOAD), {}
        with patch(PROVIDER, side_effect=reject):
            self.assertEqual(Service.process(job), 'stale')

    def test_retry_bound_and_no_provider_error_leak(self):
        job = self.job()
        with patch(PROVIDER, side_effect=TransientGenerationError('sensitive detail')) as provider:
            for attempt in range(3):
                Shadow.objects.filter(pk=job).update(RSSH_RETRY_AT=timezone.now()-timedelta(seconds=1))
                self.assertEqual(Service.process(job), 'failed')
            self.assertEqual(Service.process(job), 'failed')
            self.assertEqual(provider.call_count, 3)
        row = Shadow.objects.get(pk=job)
        self.assertEqual(row.RSSH_ERROR, 'TransientGenerationError')
        self.assertIsNone(row.RSSH_RETRY_AT)

    def test_permanent_failure_not_retried(self):
        job = self.job()
        with patch(PROVIDER, side_effect=PermanentGenerationError('private')) as provider:
            self.assertEqual(Service.process(job), 'failed')
            self.assertEqual(Service.process(job), 'failed')
            provider.assert_called_once()

    def test_malformed_response_retries_without_saving_scores(self):
        job = self.job()
        with patch(PROVIDER, return_value=(json.dumps(dict(PAYLOAD, score=0.8)), {})):
            self.assertEqual(Service.process(job), 'failed')
        row = Shadow.objects.get(pk=job)
        self.assertIsNone(row.RSSH_SCORE)
        self.assertIsNotNone(row.RSSH_RETRY_AT)

    def test_dispatch_is_after_commit_and_rollback_discards_demand(self):
        with patch.object(Service, 'dispatch') as dispatch:
            with self.captureOnCommitCallbacks(execute=True):
                job = self.job()
                dispatch.assert_not_called()
            dispatch.assert_called_once_with(job)
        Shadow.objects.all().delete()
        with self.captureOnCommitCallbacks(execute=True), patch.object(Service, 'dispatch') as dispatch:
            try:
                with transaction.atomic():
                    self.job()
                    raise ValueError('rollback')
            except ValueError:
                pass
            self.assertFalse(Shadow.objects.exists())
        dispatch.assert_not_called()

    def test_expired_lease_recovers_and_active_lease_deduplicates(self):
        job = self.job()
        Shadow.objects.filter(pk=job).update(RSSH_STATE='processing', RSSH_LEASE_UNTIL=timezone.now()+timedelta(seconds=100))
        with patch(PROVIDER) as provider:
            self.assertEqual(Service.process(job), 'busy')
            provider.assert_not_called()
        Shadow.objects.filter(pk=job).update(RSSH_LEASE_UNTIL=timezone.now()-timedelta(seconds=1))
        with patch(PROVIDER, return_value=(json.dumps(PAYLOAD), {})):
            self.assertEqual(Service.process(job), 'ready')

    def test_deletion_during_inference_discards_result(self):
        job = self.job()
        def deleted_review(**kwargs):
            """Simulate author deletion during inference."""
            Review.objects.filter(pk=self.review.pk).delete()
            return json.dumps(PAYLOAD), {}
        with patch(PROVIDER, side_effect=deleted_review):
            self.assertEqual(Service.process(job), 'superseded')
        self.assertFalse(Shadow.objects.exists())

    def test_contract_change_and_disabled_scope_prevent_provider_calls(self):
        job = self.job()
        with patch(PROVIDER) as provider:
            with override_settings(GEMINI_SENTIMENT_SHADOW_MODEL='different'):
                self.assertEqual(Service.process(job), 'superseded')
            with override_settings(GEMINI_SENTIMENT_SHADOW_BUSINESS_IDS=set()):
                self.assertEqual(Service.process(job), 'disabled')
            provider.assert_not_called()

    def test_broker_failure_keeps_durable_pending_demand(self):
        with patch('apps.reviews.tasks.process_gemini_sentiment_shadow.delay', side_effect=RuntimeError('broker')):
            with self.captureOnCommitCallbacks(execute=True):
                job = self.job()
        self.assertEqual(Shadow.objects.get(pk=job).RSSH_STATE, 'pending')

    def test_pause_during_inference_retains_recoverable_demand_without_result(self):
        job = self.job()
        pause = override_settings(GEMINI_SENTIMENT_SHADOW_ENABLED=False)
        def paused_provider(**kwargs):
            """Pause shadow processing after the external request has already started."""
            pause.enable()
            return json.dumps(PAYLOAD), {}
        try:
            with patch(PROVIDER, side_effect=paused_provider):
                self.assertEqual(Service.process(job), 'failed')
            row = Shadow.objects.get(pk=job)
            self.assertEqual(row.RSSH_ERROR, 'ShadowPaused')
            self.assertIsNone(row.RSSH_SCORE)
            self.assertIsNotNone(row.RSSH_RETRY_AT)
        finally:
            pause.disable()

    def test_recovery_dispatches_pending_without_inference(self):
        job = self.job()
        with patch.object(Service, 'dispatch') as dispatch, patch(PROVIDER) as provider:
            self.assertEqual(Service.recover(), 1)
            dispatch.assert_called_once_with(job)
            provider.assert_not_called()

    def test_legacy_enqueue_failure_does_not_skip_shadow_observer(self):
        with patch('apps.reviews.tasks.process_review_sentiment.delay', side_effect=RuntimeError('broker')), patch.object(Service, 'observe_after_commit') as observer:
            with self.captureOnCommitCallbacks(execute=True):
                ReviewService._queue_sentiment_after_commit(self.review.pk, self.business.pk)
            observer.assert_called_once_with(self.review.pk)


@override_settings(GEMINI_SENTIMENT_SHADOW_ENABLED=True, GEMINI_SENTIMENT_SHADOW_MODEL='gemini-test')
class GeminiShadowConcurrencyTests(SummaryFixtureMixin, TransactionTestCase):
    def setUp(self):
        if connection.vendor != 'postgresql':
            self.skipTest('Requires PostgreSQL locking.')
        self.business = self.create_business()
        self.review = self.create_review(self.business, REVW_STATUS=Review.ReviewStatus.PUBLISHED)
        self.scope = override_settings(GEMINI_SENTIMENT_SHADOW_BUSINESS_IDS={self.business.pk})
        self.scope.enable()
        self.addCleanup(self.scope.disable)
        with patch.object(Service, 'dispatch'):
            self.job_id = Service.request(self.review.pk)

    def worker(self):
        """Use an independent database connection for real overlapping deliveries."""
        try:
            return Service.process(self.job_id)
        finally:
            connections.close_all()

    def test_overlapping_delivery_calls_provider_once(self):
        entered, release = Event(), Event()
        def provider(**kwargs):
            """Pause inference after the durable claim commits."""
            entered.set()
            if not release.wait(10):
                raise RuntimeError('test timed out')
            return json.dumps(PAYLOAD), {}
        with patch(PROVIDER, side_effect=provider) as mocked, ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(self.worker)
            try:
                self.assertTrue(entered.wait(5))
                self.assertEqual(Service.process(self.job_id), 'busy')
            finally:
                release.set()
            self.assertEqual(future.result(timeout=10), 'ready')
            self.assertEqual(mocked.call_count, 1)

    def test_reclaimed_lease_fences_late_worker(self):
        entered, release = Event(), Event()
        def provider(**kwargs):
            """Return different scores from the old worker and its replacement."""
            if not entered.is_set():
                entered.set()
                if not release.wait(10):
                    raise RuntimeError('test timed out')
                return json.dumps(PAYLOAD), {}
            return json.dumps(dict(PAYLOAD, score=1)), {}
        with patch(PROVIDER, side_effect=provider), ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(self.worker)
            try:
                self.assertTrue(entered.wait(5))
                Shadow.objects.filter(pk=self.job_id).update(RSSH_LEASE_UNTIL=timezone.now()-timedelta(seconds=1))
                self.assertEqual(Service.process(self.job_id), 'ready')
            finally:
                release.set()
            self.assertEqual(future.result(timeout=10), 'superseded')
        self.assertEqual(Shadow.objects.get(pk=self.job_id).RSSH_SCORE, 1)
