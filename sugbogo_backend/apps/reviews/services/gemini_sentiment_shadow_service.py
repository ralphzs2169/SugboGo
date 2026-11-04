"""Opt-in durable shadow processing with leases and no authoritative side effects."""
import json
import logging
from datetime import timedelta
from uuid import uuid4

from django.conf import settings
from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone

from apps.reviews.models import Review, ReviewSentimentShadow as Shadow
from apps.reviews.services.gemini_sentiment_contract import PROMPT, SCHEMA, contract_version, text_hash, normalize_provider_output
from apps.shared.services.gemini_structured_service import GeminiStructuredService, TransientGenerationError

logger = logging.getLogger(__name__)
MAX_ATTEMPTS = 3
LEASE_SECONDS = 600


class GeminiSentimentShadowService:
    """Keep Gemini results isolated while the old implementation remains authoritative."""

    @staticmethod
    def allowed(business_id):
        """Require both explicit enablement and a controlled business cohort."""
        from apps.reviews.services.gemini_sentiment_cutover_service import GeminiSentimentCutoverService
        if GeminiSentimentCutoverService.active_policy(business_id) is not None:
            return settings.GEMINI_SENTIMENT_CUTOVER_ENABLED
        return settings.GEMINI_SENTIMENT_SHADOW_ENABLED and business_id in settings.GEMINI_SENTIMENT_SHADOW_BUSINESS_IDS

    @staticmethod
    def dispatch(job_id):
        """Send a recoverable broker hint without logging review text or credentials."""
        try:
            from apps.reviews.tasks import process_gemini_sentiment_shadow
            process_gemini_sentiment_shadow.delay(job_id)
        except Exception as exc:
            logger.warning('Shadow dispatch failed: job=%s type=%s', job_id, type(exc).__name__)

    @classmethod
    def request(cls, review_id):
        """Create durable demand only for published nonblank reviews in the cohort."""
        if not (settings.GEMINI_SENTIMENT_SHADOW_ENABLED or settings.GEMINI_SENTIMENT_CUTOVER_ENABLED):
            return None
        return cls._request(review_id)

    @classmethod
    @transaction.atomic
    def _request(cls, review_id):
        """Serialize same-review demand creation after the opt-in gate."""
        review = Review.objects.select_for_update().filter(pk=review_id).first()
        if review is None or not cls.allowed(review.BUSN_ID_id):
            return None
        if review.REVW_STATUS != Review.ReviewStatus.PUBLISHED or not review.REVW_TEXT.strip():
            return None
        from apps.reviews.services.gemini_sentiment_cutover_service import GeminiSentimentCutoverService
        policy = GeminiSentimentCutoverService.active_policy(review.BUSN_ID_id)
        model = policy.BSPO_MODEL if policy else settings.GEMINI_SENTIMENT_SHADOW_MODEL
        if policy and policy.BSPO_VERSION != contract_version(model):
            return None
        version, digest = contract_version(model), text_hash(review.REVW_TEXT)
        job, _ = Shadow.objects.get_or_create(
            REVW_ID=review, RSSH_VERSION=version, RSSH_SOURCE_HASH=digest,
            defaults={'RSSH_SOURCE_TEXT': review.REVW_TEXT, 'RSSH_MODEL': model},
        )
        if job.RSSH_STATE == Shadow.State.PENDING:
            transaction.on_commit(lambda: cls.dispatch(job.pk), robust=True)
        elif policy and job.RSSH_STATE == Shadow.State.READY:
            if not GeminiSentimentCutoverService.has_projection(review, job):
                job.RSSH_PROMOTED_AT = None
                job.save(update_fields=['RSSH_PROMOTED_AT', 'RSSH_UPDATED_AT'])
                transaction.on_commit(lambda: GeminiSentimentCutoverService.promote_safely(job.pk), robust=True)
        return job.pk

    @classmethod
    def observe_after_commit(cls, review_id):
        """Isolate shadow scheduling failures from committed publication and legacy work."""
        if not (settings.GEMINI_SENTIMENT_SHADOW_ENABLED or settings.GEMINI_SENTIMENT_CUTOVER_ENABLED):
            return
        try:
            cls.request(review_id)
        except Exception as exc:
            logger.warning('Shadow observation failed: review=%s type=%s', review_id, type(exc).__name__)

    @classmethod
    def process(cls, job_id):
        """Claim once, infer outside locks and fence publication against edits and leases."""
        if not (settings.GEMINI_SENTIMENT_SHADOW_ENABLED or settings.GEMINI_SENTIMENT_CUTOVER_ENABLED):
            return 'disabled'
        hint = Shadow.objects.filter(pk=job_id).values('REVW_ID_id').first()
        if hint is None:
            return 'missing'
        now = timezone.now()
        with transaction.atomic():
            review = Review.objects.select_for_update().filter(pk=hint['REVW_ID_id']).first()
            job = Shadow.objects.select_for_update().filter(pk=job_id).first()
            if review is None or job is None:
                return 'missing'
            if not cls.allowed(review.BUSN_ID_id):
                return 'disabled'
            from apps.reviews.services.gemini_sentiment_cutover_service import GeminiSentimentCutoverService
            policy = GeminiSentimentCutoverService.active_policy(review.BUSN_ID_id)
            expected_model = policy.BSPO_MODEL if policy else settings.GEMINI_SENTIMENT_SHADOW_MODEL
            if job.RSSH_VERSION != contract_version(expected_model):
                return 'superseded'
            if review.REVW_STATUS != Review.ReviewStatus.PUBLISHED or review.REVW_TEXT != job.RSSH_SOURCE_TEXT:
                job.RSSH_STATE = Shadow.State.STALE
                job.RSSH_TOKEN = None
                job.save(update_fields=['RSSH_STATE', 'RSSH_TOKEN', 'RSSH_UPDATED_AT'])
                return 'stale'
            if job.RSSH_STATE in (Shadow.State.READY, Shadow.State.STALE):
                if policy and job.RSSH_STATE == Shadow.State.READY:
                    transaction.on_commit(lambda: GeminiSentimentCutoverService.promote_safely(job.pk), robust=True)
                return job.RSSH_STATE
            if job.RSSH_STATE == Shadow.State.PROCESSING and job.RSSH_LEASE_UNTIL and job.RSSH_LEASE_UNTIL > now:
                return 'busy'
            if job.RSSH_ATTEMPTS >= MAX_ATTEMPTS:
                job.RSSH_STATE = Shadow.State.FAILED
                job.RSSH_TOKEN = None
                job.RSSH_RETRY_AT = None
                job.save(update_fields=['RSSH_STATE', 'RSSH_TOKEN', 'RSSH_RETRY_AT', 'RSSH_UPDATED_AT'])
                return 'failed'
            if job.RSSH_STATE == Shadow.State.FAILED and (job.RSSH_RETRY_AT is None or job.RSSH_RETRY_AT > now):
                return 'failed'
            token = uuid4()
            job.RSSH_STATE = Shadow.State.PROCESSING
            job.RSSH_TOKEN = token
            job.RSSH_ATTEMPTS += 1
            job.RSSH_LEASE_UNTIL = now + timedelta(seconds=LEASE_SECONDS)
            job.RSSH_RETRY_AT = None
            job.RSSH_ERROR = ''
            job.save()
            source, model = job.RSSH_SOURCE_TEXT, job.RSSH_MODEL
        try:
            raw, usage = GeminiStructuredService.generate(
                model=model, instruction=PROMPT, evidence={'text': source}, schema=SCHEMA,
            )
            result, corrected = normalize_provider_output(json.loads(raw))
            if corrected:
                usage = dict(usage, normalization='excluded_zero_to_null')
        except Exception as exc:
            retryable = isinstance(exc, (TransientGenerationError, ValueError))
            # Never store raw provider errors, prompts or credentials in failure metadata.
            with transaction.atomic():
                current = Shadow.objects.select_for_update().filter(pk=job_id, RSSH_TOKEN=token).first()
                if current is not None:
                    current.RSSH_STATE = Shadow.State.FAILED
                    current.RSSH_TOKEN = None
                    current.RSSH_ERROR = type(exc).__name__
                    current.RSSH_RETRY_AT = timezone.now() + timedelta(seconds=30 * current.RSSH_ATTEMPTS) if retryable and current.RSSH_ATTEMPTS < MAX_ATTEMPTS else None
                    current.save()
            return 'failed'
        with transaction.atomic():
            review = Review.objects.select_for_update().filter(pk=hint['REVW_ID_id']).first()
            current = Shadow.objects.select_for_update().filter(pk=job_id, RSSH_TOKEN=token).first()
            if review is None or current is None:
                return 'superseded'
            policy = GeminiSentimentCutoverService.active_policy(review.BUSN_ID_id)
            expected_model = policy.BSPO_MODEL if policy else settings.GEMINI_SENTIMENT_SHADOW_MODEL
            if current.RSSH_VERSION != contract_version(expected_model):
                current.RSSH_STATE = Shadow.State.STALE
            elif not cls.allowed(review.BUSN_ID_id):
                current.RSSH_STATE = Shadow.State.FAILED
                current.RSSH_ERROR = 'ShadowPaused'
                current.RSSH_RETRY_AT = timezone.now() if current.RSSH_ATTEMPTS < MAX_ATTEMPTS else None
            elif review.REVW_STATUS != Review.ReviewStatus.PUBLISHED or review.REVW_TEXT != source:
                current.RSSH_STATE = Shadow.State.STALE
            elif current.RSSH_LEASE_UNTIL <= timezone.now():
                current.RSSH_STATE = Shadow.State.FAILED
                current.RSSH_ERROR = 'LeaseExpired'
                current.RSSH_RETRY_AT = timezone.now() if current.RSSH_ATTEMPTS < MAX_ATTEMPTS else None
            else:
                current.RSSH_STATE = Shadow.State.READY
                current.RSSH_LABEL = result['label']
                current.RSSH_SCORE = result['score']
                current.RSSH_ELIGIBLE = result['eligible']
                current.RSSH_REASON = result['reason']
                current.RSSH_USAGE = usage
            current.RSSH_TOKEN = None
            current.RSSH_LEASE_UNTIL = None
            current.save()
            if current.RSSH_STATE == Shadow.State.READY and policy:
                transaction.on_commit(lambda: GeminiSentimentCutoverService.promote_safely(job_id), robust=True)
            return current.RSSH_STATE

    @classmethod
    def recover(cls, limit=50):
        """Recover due jobs and missed active demand without backfilling shadow cohorts."""
        if not (settings.GEMINI_SENTIMENT_SHADOW_ENABLED or settings.GEMINI_SENTIMENT_CUTOVER_ENABLED):
            return 0
        from apps.reviews.models import BusinessSentimentPolicy
        from apps.reviews.services.gemini_sentiment_cutover_service import GeminiSentimentCutoverService
        now = timezone.now()
        due = Q(RSSH_STATE=Shadow.State.PENDING) | Q(RSSH_STATE=Shadow.State.FAILED, RSSH_RETRY_AT__lte=now) | Q(RSSH_STATE=Shadow.State.PROCESSING, RSSH_LEASE_UNTIL__lte=now)
        scope = Q(pk__in=[])
        if settings.GEMINI_SENTIMENT_SHADOW_ENABLED:
            scope |= Q(RSSH_VERSION=contract_version(settings.GEMINI_SENTIMENT_SHADOW_MODEL), REVW_ID__BUSN_ID_id__in=settings.GEMINI_SENTIMENT_SHADOW_BUSINESS_IDS) & ~Q(REVW_ID__BUSN_ID__sentiment_policy__BSPO_MODE=BusinessSentimentPolicy.Mode.GEMINI)
        if settings.GEMINI_SENTIMENT_CUTOVER_ENABLED:
            GeminiSentimentCutoverService.recover_requests(limit=limit)
            for policy in BusinessSentimentPolicy.objects.filter(BSPO_MODE=BusinessSentimentPolicy.Mode.GEMINI):
                scope |= Q(REVW_ID__BUSN_ID_id=policy.BUSN_ID_id, RSSH_VERSION=policy.BSPO_VERSION)
            ready = Shadow.objects.filter(
                scope, RSSH_STATE=Shadow.State.READY, RSSH_PROMOTED_AT__isnull=True,
                REVW_ID__BUSN_ID__sentiment_policy__BSPO_MODE=BusinessSentimentPolicy.Mode.GEMINI,
                RSSH_VERSION=F('REVW_ID__BUSN_ID__sentiment_policy__BSPO_VERSION'),
                RSSH_SOURCE_TEXT=F('REVW_ID__REVW_TEXT'),
                REVW_ID__REVW_STATUS=Review.ReviewStatus.PUBLISHED,
            ).order_by('pk').values_list('pk', flat=True)[:limit]
            for job_id in list(ready):
                GeminiSentimentCutoverService.promote_safely(job_id)
        jobs = Shadow.objects.filter(
            due, scope,
            REVW_ID__REVW_STATUS=Review.ReviewStatus.PUBLISHED,
            RSSH_SOURCE_TEXT=F('REVW_ID__REVW_TEXT'),
        ).order_by('RSSH_UPDATED_AT').values_list('pk', flat=True)[:limit]
        ids = list(jobs)
        for job_id in ids:
            cls.dispatch(job_id)
        return len(ids)
