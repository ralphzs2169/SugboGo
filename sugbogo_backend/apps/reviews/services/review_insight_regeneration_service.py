"""Durable coordination primitives, intentionally unused by review lifecycle tasks."""

import re
from datetime import timedelta
from uuid import uuid4

from django.db import connection, models, transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from apps.business.models import Business
from apps.reviews.constants import (
    REVIEW_INSIGHT_MAX_WAIT_SECONDS,
    REVIEW_INSIGHT_QUIET_SECONDS,
)
from apps.reviews.models import ReviewInsightRegeneration


class ReviewInsightRegenerationService:
    """Serialize demand, commit observation, leases, and evaluation acknowledgements."""

    @staticmethod
    @transaction.atomic
    def get_or_create(
        business_id: int,
    ) -> ReviewInsightRegeneration:
        """Create an idle record without interpreting legacy summaries as evaluated."""
        try:
            business = Business.objects.get(BUSN_ID=business_id)
        except Business.DoesNotExist:
            raise NotFound("The business could not be found.") from None

        record, _ = (
            ReviewInsightRegeneration.objects
            .select_for_update()
            .get_or_create(BUSN_ID=business)
        )
        return record

    @staticmethod
    @transaction.atomic
    def record_change(
        business_id: int,
    ) -> int:
        """Persist one meaningful change inside its owning transaction before observation."""
        record = ReviewInsightRegenerationService.get_or_create(business_id)
        if record.RIRG_REQUESTED_REVISION == record.RIRG_COMPLETED_REVISION:
            record.RIRG_ATTEMPTS = 0
            record.RIRG_LAST_ERROR = ""

        record.RIRG_REQUESTED_REVISION += 1
        record.save(
            update_fields=[
                "RIRG_REQUESTED_REVISION",
                "RIRG_ATTEMPTS",
                "RIRG_LAST_ERROR",
                "RIRG_UPDATED_AT",
            ],
        )

        def observe():
            """Anchor timing after commit while retaining recoverable unobserved demand."""
            ReviewInsightRegenerationService.observe_changes(business_id)

        transaction.on_commit(observe, robust=True)
        return record.RIRG_REQUESTED_REVISION

    @staticmethod
    def outstanding_work():
        """Find demand without acknowledging, dispatching, or resetting its timestamps."""
        return ReviewInsightRegeneration.objects.filter(
            RIRG_REQUESTED_REVISION__gt=models.F("RIRG_COMPLETED_REVISION"),
        )

    @staticmethod
    def unobserved_work():
        """Find committed revisions whose callback was delayed or lost."""
        return (
            ReviewInsightRegenerationService.outstanding_work()
            .filter(RIRG_OBSERVED_REVISION__lt=models.F("RIRG_REQUESTED_REVISION"))
            .order_by("RIRG_UPDATED_AT", "RIRG_ID")
        )

    @staticmethod
    def due_work():
        """Find observed work past both its debounce and retry deadlines."""
        now = timezone.now()
        return (
            ReviewInsightRegenerationService.outstanding_work()
            .filter(
                RIRG_OBSERVED_REVISION=models.F("RIRG_REQUESTED_REVISION"),
                RIRG_DUE_AT__lte=now,
            )
            .filter(
                models.Q(RIRG_RETRY_NOT_BEFORE__isnull=True)
                | models.Q(RIRG_RETRY_NOT_BEFORE__lte=now),
            )
            .filter(
                models.Q(RIRG_ATTEMPT_TOKEN__isnull=True)
                | models.Q(RIRG_LEASE_EXPIRES_AT__lte=now),
            )
            .order_by("RIRG_DUE_AT", "RIRG_ID")
        )

    @staticmethod
    def _require_autocommit() -> None:
        """Prevent pre-commit observation or a claim whose lease is not yet durable."""
        if (
            connection.in_atomic_block
            or not connection.get_autocommit()
        ):
            raise ValidationError(
                "Review insight observation and claiming require an autocommit boundary.",
            )

    @staticmethod
    def _locked_record(
        business_id: int,
    ) -> ReviewInsightRegeneration | None:
        """Lock existing work without creating requests for missing or deleted businesses."""
        return (
            ReviewInsightRegeneration.objects
            .select_for_update()
            .filter(BUSN_ID_id=business_id)
            .first()
        )

    @staticmethod
    def _observe_locked(
        record: ReviewInsightRegeneration,
        now,
    ) -> None:
        """Start or extend timing only for newly observed committed revisions."""
        if record.RIRG_OBSERVED_REVISION == record.RIRG_REQUESTED_REVISION:
            return

        if record.RIRG_OBSERVED_REVISION == record.RIRG_COMPLETED_REVISION:
            record.RIRG_FIRST_CHANGED_AT = now

        record.RIRG_LATEST_CHANGED_AT = now
        record.RIRG_DUE_AT = min(
            now + timedelta(seconds=REVIEW_INSIGHT_QUIET_SECONDS),
            record.RIRG_FIRST_CHANGED_AT
            + timedelta(seconds=REVIEW_INSIGHT_MAX_WAIT_SECONDS),
        )
        record.RIRG_OBSERVED_REVISION = record.RIRG_REQUESTED_REVISION
        record.save(
            update_fields=[
                "RIRG_FIRST_CHANGED_AT",
                "RIRG_LATEST_CHANGED_AT",
                "RIRG_DUE_AT",
                "RIRG_OBSERVED_REVISION",
                "RIRG_UPDATED_AT",
            ],
        )

    @staticmethod
    def observe_changes(
        business_id: int,
    ) -> bool:
        """Recover commit observation without relying on the original callback delivery."""
        ReviewInsightRegenerationService._require_autocommit()
        with transaction.atomic():
            record = ReviewInsightRegenerationService._locked_record(business_id)
            if record is None:
                return False
            ReviewInsightRegenerationService._observe_locked(record, timezone.now())
        return True

    @staticmethod
    def claim(
        business_id: int,
        lease_seconds: int,
    ) -> ReviewInsightRegeneration | None:
        """Durably claim a due revision or leave its current owner undisturbed."""
        ReviewInsightRegenerationService._require_autocommit()
        if (
            type(lease_seconds) is not int
            or lease_seconds <= 0
        ):
            raise ValidationError(
                "The review insight lease must be a positive number of seconds.",
            )

        with transaction.atomic():
            record = ReviewInsightRegenerationService._locked_record(business_id)
            if record is None:
                return None
            now = timezone.now()
            ReviewInsightRegenerationService._observe_locked(record, now)
            if record.RIRG_REQUESTED_REVISION == record.RIRG_COMPLETED_REVISION:
                return None
            if (
                record.RIRG_ATTEMPT_TOKEN is not None
                and record.RIRG_LEASE_EXPIRES_AT > now
            ):
                return None
            if record.RIRG_DUE_AT > now:
                return None
            if (
                record.RIRG_RETRY_NOT_BEFORE is not None
                and record.RIRG_RETRY_NOT_BEFORE > now
            ):
                return None

            record.RIRG_ATTEMPT_TOKEN = uuid4()
            record.RIRG_CLAIMED_REVISION = record.RIRG_REQUESTED_REVISION
            record.RIRG_LEASE_EXPIRES_AT = now + timedelta(seconds=lease_seconds)
            record.RIRG_ATTEMPTS += 1
            record.save(
                update_fields=[
                    "RIRG_ATTEMPT_TOKEN",
                    "RIRG_CLAIMED_REVISION",
                    "RIRG_LEASE_EXPIRES_AT",
                    "RIRG_ATTEMPTS",
                    "RIRG_UPDATED_AT",
                ],
            )
            return record

    @staticmethod
    def _owns_attempt(
        record: ReviewInsightRegeneration | None,
        revision: int,
        attempt_token,
        now,
    ) -> bool:
        """Authenticate an unexpired lease independently of newer input demand."""
        return (
            record is not None
            and record.RIRG_ATTEMPT_TOKEN is not None
            and record.RIRG_ATTEMPT_TOKEN == attempt_token
            and record.RIRG_CLAIMED_REVISION == revision
            and record.RIRG_LEASE_EXPIRES_AT > now
        )

    @staticmethod
    def _clear_ownership(
        record: ReviewInsightRegeneration,
    ) -> None:
        """Clear all lease fields together without acknowledging any revision."""
        record.RIRG_ATTEMPT_TOKEN = None
        record.RIRG_CLAIMED_REVISION = None
        record.RIRG_LEASE_EXPIRES_AT = None

    @staticmethod
    @transaction.atomic
    def release_claim(
        business_id: int,
        revision: int,
        attempt_token,
    ) -> bool:
        """Release owned or superseded work while preserving demand and failure metadata."""
        record = ReviewInsightRegenerationService._locked_record(business_id)
        if not ReviewInsightRegenerationService._owns_attempt(
            record,
            revision,
            attempt_token,
            timezone.now(),
        ):
            return False
        ReviewInsightRegenerationService._clear_ownership(record)
        record.save(
            update_fields=[
                "RIRG_ATTEMPT_TOKEN",
                "RIRG_CLAIMED_REVISION",
                "RIRG_LEASE_EXPIRES_AT",
                "RIRG_UPDATED_AT",
            ],
        )
        return True

    @staticmethod
    @transaction.atomic
    def recover_expired(
        business_id: int,
    ) -> bool:
        """Release expired ownership without resetting debounce or retry deadlines."""
        record = ReviewInsightRegenerationService._locked_record(business_id)
        if (
            record is None
            or record.RIRG_ATTEMPT_TOKEN is None
            or record.RIRG_LEASE_EXPIRES_AT > timezone.now()
        ):
            return False
        ReviewInsightRegenerationService._clear_ownership(record)
        record.save(
            update_fields=[
                "RIRG_ATTEMPT_TOKEN",
                "RIRG_CLAIMED_REVISION",
                "RIRG_LEASE_EXPIRES_AT",
                "RIRG_UPDATED_AT",
            ],
        )
        return True

    @staticmethod
    @transaction.atomic
    def record_failure(
        business_id: int,
        revision: int,
        attempt_token,
        error_code: str,
        retry_after_seconds: int,
    ) -> bool:
        """Persist a controlled failure code and backoff only for the current owner."""
        if (
            not isinstance(error_code, str)
            or re.fullmatch(r"[A-Za-z0-9_.-]{1,64}", error_code) is None
        ):
            raise ValidationError("Provide a bounded review insight failure code.")
        if (
            type(retry_after_seconds) is not int
            or retry_after_seconds < 0
        ):
            raise ValidationError("The review insight retry delay cannot be negative.")

        record = ReviewInsightRegenerationService._locked_record(business_id)
        now = timezone.now()
        if not ReviewInsightRegenerationService._owns_attempt(
            record,
            revision,
            attempt_token,
            now,
        ):
            return False
        if record.RIRG_REQUESTED_REVISION != revision:
            return False

        record.RIRG_LAST_ERROR = error_code
        record.RIRG_RETRY_NOT_BEFORE = now + timedelta(seconds=retry_after_seconds)
        ReviewInsightRegenerationService._clear_ownership(record)
        record.save(
            update_fields=[
                "RIRG_LAST_ERROR",
                "RIRG_RETRY_NOT_BEFORE",
                "RIRG_ATTEMPT_TOKEN",
                "RIRG_CLAIMED_REVISION",
                "RIRG_LEASE_EXPIRES_AT",
                "RIRG_UPDATED_AT",
            ],
        )
        return True

    @staticmethod
    @transaction.atomic
    def acknowledge_evaluation(
        business_id: int,
        revision: int,
        attempt_token,
    ) -> bool:
        """Acknowledge an authorized current evaluation atomically with future publication."""
        record = ReviewInsightRegenerationService._locked_record(business_id)
        if not ReviewInsightRegenerationService._owns_attempt(
            record,
            revision,
            attempt_token,
            timezone.now(),
        ):
            return False
        if record.RIRG_REQUESTED_REVISION != revision:
            return False

        record.RIRG_COMPLETED_REVISION = revision
        record.RIRG_FIRST_CHANGED_AT = None
        record.RIRG_LATEST_CHANGED_AT = None
        record.RIRG_DUE_AT = None
        record.RIRG_RETRY_NOT_BEFORE = None
        record.RIRG_LAST_ERROR = ""
        ReviewInsightRegenerationService._clear_ownership(record)
        record.save(
            update_fields=[
                "RIRG_COMPLETED_REVISION",
                "RIRG_FIRST_CHANGED_AT",
                "RIRG_LATEST_CHANGED_AT",
                "RIRG_DUE_AT",
                "RIRG_RETRY_NOT_BEFORE",
                "RIRG_LAST_ERROR",
                "RIRG_ATTEMPT_TOKEN",
                "RIRG_CLAIMED_REVISION",
                "RIRG_LEASE_EXPIRES_AT",
                "RIRG_UPDATED_AT",
            ],
        )
        return True
