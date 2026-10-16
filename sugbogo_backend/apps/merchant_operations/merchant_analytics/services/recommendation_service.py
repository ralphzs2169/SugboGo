"""Coordinate explicit refreshes, bounded background work, and read-only stored results."""

import logging
from datetime import timedelta

from django.conf import settings
from django.db import connection, transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, PermissionDenied

from apps.authentication.permissions import user_has_role
from apps.business.models import Business
from apps.merchant_operations.business_profile.services.business_profile_service import BusinessProfileService
from apps.shared.analytics.policy import policy_scope
from apps.shared.services.gemini_structured_service import PermanentGenerationError, TransientGenerationError
from apps.users.models import User

from .. import entitlements
from ..models import MerchantRecommendation
from .premium_common import owned_business_data
from .recommendation_evidence_service import (
    PROMPT_VERSION, SCHEMA_VERSION, RecommendationEvidenceService,
    period_data, restore_period, selection_key,
)
from .recommendation_provider_service import InvalidRecommendation, RecommendationProviderService

logger = logging.getLogger(__name__)
ACTIVE_STATES = (MerchantRecommendation.State.PENDING, MerchantRecommendation.State.RUNNING)
JOB_TIMEOUT = timedelta(minutes=15)
MAX_ATTEMPTS = 4


class RecommendationRefreshConflict(APIException):
    """Reject a competing period refresh while one business job is active."""

    status_code = 409
    default_detail = "A recommendation refresh is already in progress. Read its state before requesting another period."
    default_code = "RECOMMENDATION_REFRESH_IN_PROGRESS"


def provenance():
    """Identify the exact provider, prompt, schema, and restricted generation mode."""
    return {
        "provider": "gemini", "model": settings.GEMINI_KEYWORD_MODEL,
        "prompt_version": PROMPT_VERSION, "schema_version": SCHEMA_VERSION,
        "mode": "restricted_selection",
    }


class RecommendationService:
    """Keep ownership, idempotency, source validation, and generation lifecycle together."""

    @staticmethod
    def _evidence(user, period):
        """Resolve a fresh policy boundary outside an earlier background snapshot."""
        with policy_scope():
            return RecommendationEvidenceService.build(user, period)

    @classmethod
    def refresh(cls, user, period):
        """Persist one explicit request and enqueue only after its transaction commits."""
        business = BusinessProfileService.get_business_for_merchant(user)
        evidence = cls._evidence(user, period)
        key = selection_key(period)
        now = timezone.now()
        with transaction.atomic():
            # Serialize requests across all selections for this business, including an initially empty job table.
            try:
                Business.objects.select_for_update().get(pk=business.pk, USER_ID=user)
            except Business.DoesNotExist:
                raise PermissionDenied("Business ownership changed. Reload before requesting recommendations.") from None
            active = MerchantRecommendation.objects.filter(BUSN_ID=business, MREC_STATE__in=ACTIVE_STATES)
            active.filter(MREC_CREATED_AT__lte=now - JOB_TIMEOUT).update(
                MREC_STATE=MerchantRecommendation.State.FAILED, MREC_ERROR_CODE="job_timeout",
                MREC_FINISHED_AT=now, MREC_UPDATED_AT=now,
            )
            existing = active.first()
            if existing is not None:
                if existing.USER_ID_id != user.pk or existing.MREC_SELECTION_KEY != key:
                    raise RecommendationRefreshConflict()
                return existing, False
            latest = MerchantRecommendation.objects.filter(
                BUSN_ID=business, USER_ID=user, MREC_SELECTION_KEY=key,
            ).first()
            # New elapsed boundaries are material: repeating a historical selection can reuse its result.
            if (latest is not None and latest.MREC_PERIOD["end_exclusive"] == period.end.isoformat()
                    and RecommendationEvidenceService.equivalent(latest, evidence)
                    and cls._provenance_matches(latest)
                    and (latest.MREC_STATE in (MerchantRecommendation.State.READY, MerchantRecommendation.State.INSUFFICIENT)
                         or latest.MREC_CREATED_AT > now - JOB_TIMEOUT)):
                return latest, False
            job = MerchantRecommendation.objects.create(
                BUSN_ID=business, USER_ID=user, MREC_SELECTION_KEY=key,
                MREC_PERIOD=period_data(period), MREC_SNAPSHOT=evidence["snapshot"],
                MREC_FINGERPRINT=evidence["fingerprint"], MREC_POLICY_VERSION=evidence["policy_version"],
                MREC_POLICY_VALUES=evidence["policy_values"], MREC_PROVENANCE=provenance(),
                MREC_STATE=(MerchantRecommendation.State.PENDING if evidence["snapshot"]["candidates"]
                            else MerchantRecommendation.State.INSUFFICIENT),
            )
            if job.MREC_STATE == MerchantRecommendation.State.PENDING:
                transaction.on_commit(lambda: cls._enqueue(job.pk))
        return job, True

    @staticmethod
    def _enqueue(job_id):
        """Record a controlled queue failure without allowing a GET to retry the mutation."""
        from ..tasks import generate_merchant_recommendations

        try:
            generate_merchant_recommendations.delay(str(job_id))
        except Exception as exc:
            logger.warning("Recommendation enqueue failed.", extra={"error_type": type(exc).__name__})
            MerchantRecommendation.objects.filter(pk=job_id, MREC_STATE=MerchantRecommendation.State.PENDING).update(
                MREC_STATE=MerchantRecommendation.State.FAILED, MREC_ERROR_CODE="queue_unavailable",
                MREC_FINISHED_AT=timezone.now(), MREC_UPDATED_AT=timezone.now(),
            )

    @staticmethod
    def _provenance_matches(job):
        """Require the current restricted renderer and model to match the original generation contract."""
        return all(job.MREC_PROVENANCE.get(key) == value for key, value in provenance().items())

    @classmethod
    def read(cls, user, period):
        """Read stored state and current deterministic fallback without scheduling or writing anything."""
        business = BusinessProfileService.get_business_for_merchant(user)
        job = MerchantRecommendation.objects.filter(
            BUSN_ID=business, USER_ID=user, MREC_SELECTION_KEY=selection_key(period),
        ).first()
        now = timezone.now()
        live_period = restore_period(job.MREC_PERIOD, checked_at=now) if job else period
        evidence = cls._evidence(user, live_period)
        state = "not_requested" if job is None else job.MREC_STATE
        error_code = None if job is None else job.MREC_ERROR_CODE or None
        output = []
        matches = job is not None and RecommendationEvidenceService.equivalent(job, evidence)
        if job:
            if not matches or not cls._provenance_matches(job):
                state = "invalidated"
            elif state in ACTIVE_STATES and job.MREC_CREATED_AT <= now - JOB_TIMEOUT:
                state, error_code = "failed", "job_timeout"
            elif state == MerchantRecommendation.State.READY:
                try:
                    # Re-render server wording rather than trusting stored/provider-authored text.
                    choices = [{key: item[key] for key in ("action_code", "evidence_codes", "explanation_code")}
                               for item in job.MREC_OUTPUT]
                    output = RecommendationProviderService.validate({"recommendations": choices}, evidence["snapshot"])
                except (InvalidRecommendation, TypeError, KeyError):
                    state, error_code = "invalidated", "stored_output_invalid"
        return {
            "business": owned_business_data(business), "state": state,
            "stored_state": None if job is None else job.MREC_STATE,
            "request_id": None if job is None else job.pk,
            "source_period": None if job is None else job.MREC_PERIOD,
            "requested_selection": {"start_date": period.start_date.isoformat(), "end_date": period.end_date.isoformat()},
            "requested_at": None if job is None else job.MREC_CREATED_AT,
            "generated_at": None if job is None else job.MREC_GENERATED_AT,
            "checked_at": now, "evidence_matches": matches,
            "snapshot_only": True, "content_available": bool(output), "ai_recommendations": output,
            "generation_policy": None if job is None else {
                "original_version": job.MREC_POLICY_VERSION, "current_version": evidence["policy_version"],
                "relevant_rules_match": job.MREC_POLICY_VALUES == evidence["policy_values"],
                "original_rules": job.MREC_POLICY_VALUES,
            },
            "provenance": None if job is None else job.MREC_PROVENANCE,
            "error_code": error_code, "key_findings": evidence["key_findings"],
            "recommended_actions": evidence["recommended_actions"], "meta": evidence["meta"],
            "measurement_note": (
                "AI selects and orders approved actions and wording; facts remain deterministic. "
                "Stored recommendations cover their exact source snapshot, not later activity in the selected dates. "
                "Fallback findings use current retained evidence within those bounds. "
                "Source reads are not a cross-database transactional snapshot."
            ),
        }

    @staticmethod
    def _eligible(job):
        """Recheck the current owner, active merchant account, and server-side Premium access."""
        user = job.USER_ID
        return (
            user.is_active and user_has_role(user, User.UserRole.MERCHANT)
            and job.BUSN_ID.USER_ID_id == user.pk and entitlements.merchant_has_plus_access(user)
        )

    @staticmethod
    def _finish(job_id, state, error_code="", **values):
        """Atomically finish only an active attempt without overwriting a replacement or timed-out job."""
        now = timezone.now()
        return MerchantRecommendation.objects.filter(pk=job_id, MREC_STATE__in=ACTIVE_STATES).update(
            MREC_STATE=state, MREC_ERROR_CODE=error_code, MREC_FINISHED_AT=now,
            MREC_UPDATED_AT=now, **values,
        )

    @classmethod
    def generate(cls, job_id):
        """Run a job under a nonblocking business lock and always release the session lock."""
        job = MerchantRecommendation.objects.filter(pk=job_id).first()
        if job is None:
            return "missing"
        lock_name = f"merchant-recommendations:{job.BUSN_ID_id}"
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_try_advisory_lock(hashtextextended(%s, 0))", [lock_name])
            acquired = cursor.fetchone()[0]
        if not acquired:
            return "busy"
        try:
            return cls._generate_locked(job_id)
        finally:
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_advisory_unlock(hashtextextended(%s, 0))", [lock_name])

    @classmethod
    def _generate_locked(cls, job_id):
        """Validate fresh source gates around a bounded provider attempt and publish atomically."""
        job = MerchantRecommendation.objects.select_related("USER_ID", "BUSN_ID").get(pk=job_id)
        if job.MREC_STATE not in ACTIVE_STATES:
            return "unchanged"
        if job.MREC_CREATED_AT <= timezone.now() - JOB_TIMEOUT:
            cls._finish(job_id, MerchantRecommendation.State.FAILED, "job_timeout")
            return "failed"
        if job.MREC_ATTEMPTS >= MAX_ATTEMPTS:
            cls._finish(job_id, MerchantRecommendation.State.FAILED, "retry_exhausted")
            return "failed"
        if not cls._eligible(job) or not cls._provenance_matches(job):
            cls._finish(job_id, MerchantRecommendation.State.INVALIDATED, "access_or_contract_changed")
            return "invalidated"
        try:
            evidence = cls._evidence(job.USER_ID, restore_period(job.MREC_PERIOD, checked_at=timezone.now()))
            if not RecommendationEvidenceService.equivalent(job, evidence):
                cls._finish(job_id, MerchantRecommendation.State.INVALIDATED, "source_or_policy_changed")
                return "invalidated"
            changed = MerchantRecommendation.objects.filter(pk=job_id, MREC_STATE__in=ACTIVE_STATES).update(
                MREC_STATE=MerchantRecommendation.State.RUNNING, MREC_ATTEMPTS=job.MREC_ATTEMPTS + 1,
                MREC_STARTED_AT=timezone.now(), MREC_UPDATED_AT=timezone.now(), MREC_ERROR_CODE="",
            )
            if not changed:
                return "unchanged"
            output, usage = RecommendationProviderService.generate(evidence["snapshot"])
            job.refresh_from_db()
            job.USER_ID.refresh_from_db()
            job.BUSN_ID.refresh_from_db()
            if job.MREC_CREATED_AT <= timezone.now() - JOB_TIMEOUT:
                cls._finish(job_id, MerchantRecommendation.State.FAILED, "job_timeout")
                return "failed"
            if not cls._eligible(job) or not cls._provenance_matches(job):
                cls._finish(job_id, MerchantRecommendation.State.INVALIDATED, "access_or_contract_changed")
                return "invalidated"
            # Resolve policy again after the provider call, after verifying the owner still exists.
            evidence = cls._evidence(job.USER_ID, restore_period(job.MREC_PERIOD, checked_at=timezone.now()))
            if not RecommendationEvidenceService.equivalent(job, evidence):
                cls._finish(job_id, MerchantRecommendation.State.INVALIDATED, "source_or_policy_changed")
                return "invalidated"
            updated = cls._finish(
                job_id, MerchantRecommendation.State.READY, MREC_OUTPUT=output,
                MREC_GENERATED_AT=timezone.now(), MREC_PROVENANCE={**job.MREC_PROVENANCE, "usage": usage},
            )
            return "ready" if updated else "unchanged"
        except TransientGenerationError:
            if job.MREC_ATTEMPTS + 1 >= MAX_ATTEMPTS:
                cls._finish(job_id, MerchantRecommendation.State.FAILED, "retry_exhausted")
                return "failed"
            MerchantRecommendation.objects.filter(pk=job_id, MREC_STATE=MerchantRecommendation.State.RUNNING).update(
                MREC_STATE=MerchantRecommendation.State.PENDING, MREC_ERROR_CODE="provider_temporarily_unavailable",
                MREC_UPDATED_AT=timezone.now(),
            )
            raise
        except InvalidRecommendation:
            cls._finish(job_id, MerchantRecommendation.State.FAILED, "unsupported_provider_output")
            return "failed"
        except PermanentGenerationError as exc:
            code = str(exc)
            if code not in {"provider_not_configured", "provider_rejected_request"}:
                code = "generation_unavailable"
            cls._finish(job_id, MerchantRecommendation.State.FAILED, code)
            return "failed"
        except Exception as exc:
            logger.warning("Recommendation generation failed.", extra={"error_type": type(exc).__name__})
            cls._finish(job_id, MerchantRecommendation.State.FAILED, "generation_unavailable")
            return "failed"
