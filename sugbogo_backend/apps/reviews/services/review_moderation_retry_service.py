"""Recover reviews held only because content moderation could not complete."""

import logging
import math
from datetime import timedelta
from uuid import uuid4

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.reviews.models import Review
from apps.reviews.services.review_moderation_service import ReviewModerationService
from apps.reviews.services.review_service import ReviewService

logger = logging.getLogger(__name__)


class ReviewModerationRetryService:
    """Recover held provider checks using persisted attempts, due times, and claims."""

    MAX_RETRIES = 3
    RETRY_BASE_SECONDS = 60
    RETRY_MAX_SECONDS = 300
    CLAIM_SECONDS = 120
    RECOVERY_BATCH_SIZE = 100

    @staticmethod
    def _is_retryable(
        review: Review,
        expected_attempt: int | None = None,
    ) -> bool:
        """Exclude completed decisions and preserve legacy retry metadata defaults."""
        metadata = review.REVW_MODERATION_DATA
        if not isinstance(metadata, dict):
            return False

        findings = metadata.get("findings", [])
        if not isinstance(findings, list):
            return False

        attempt = metadata.get("retry_attempt", 0)
        return (
            review.REVW_STATUS == Review.ReviewStatus.UNDER_REVIEW
            and metadata.get("outcome") == "provider_failure"
            and metadata.get("retryable", True) is True
            and metadata.get("retry_exhausted", False) is False
            and type(attempt) is int
            and 0 <= attempt <= ReviewModerationRetryService.MAX_RETRIES
            and (
                expected_attempt is None
                or attempt == expected_attempt
            )
            and not any(
                finding.get("source") in ("text", "image")
                and finding.get("flagged") is True
                for finding in findings
                if isinstance(finding, dict)
            )
        )

    @staticmethod
    def _timestamp(value):
        """Read aware persisted timestamps without guessing malformed scheduling data."""
        if not isinstance(value, str):
            return None
        try:
            parsed = parse_datetime(value)
        except ValueError:
            return None
        if parsed is None or timezone.is_naive(parsed):
            return None
        return parsed

    @staticmethod
    def _next_due(metadata):
        """Use persisted deadlines or derive legacy backoff without resetting attempts."""
        if "retry_next_attempt_at" in metadata:
            return ReviewModerationRetryService._timestamp(
                metadata["retry_next_attempt_at"],
            )
        attempt = metadata.get("retry_attempt", 0)
        attempted_at = ReviewModerationRetryService._timestamp(
            metadata.get("last_attempted_at", metadata.get("checked_at")),
        )
        if attempt == 0:
            return timezone.now()
        if attempted_at is None:
            return None
        return attempted_at + timedelta(
            seconds=ReviewModerationRetryService._backoff(attempt - 1),
        )

    @staticmethod
    def _backoff(attempt):
        """Keep the established 60, 120, and 240 second retry delays."""
        return min(
            ReviewModerationRetryService.RETRY_BASE_SECONDS * (2 ** attempt),
            ReviewModerationRetryService.RETRY_MAX_SECONDS,
        )

    @staticmethod
    @transaction.atomic
    def _claim(
        review_id: int,
        expected_attempt: int | None,
        max_retries: int,
    ):
        """Commit exclusive, expiring ownership before making a provider request."""
        review = (
            Review.objects
            .select_for_update()
            .filter(REVW_ID=review_id)
            .first()
        )
        if review is None or not ReviewModerationRetryService._is_retryable(
            review,
            expected_attempt,
        ):
            return None

        metadata = review.REVW_MODERATION_DATA.copy()
        attempt = metadata.get("retry_attempt", 0)
        due = ReviewModerationRetryService._next_due(metadata)
        now = timezone.now()
        if attempt > max_retries or due is None or due > now:
            return None
        if metadata.get("retry_claim_token"):
            expires = ReviewModerationRetryService._timestamp(
                metadata.get("retry_claim_expires_at"),
            )
            if expires is None or expires > now:
                return None

        token = str(uuid4())
        expires = now + timedelta(seconds=ReviewModerationRetryService.CLAIM_SECONDS)
        metadata["retry_claim_token"] = token
        metadata["retry_claim_expires_at"] = expires.isoformat()
        metadata["retry_next_attempt_at"] = expires.isoformat()
        review.REVW_MODERATION_DATA = metadata
        review.save(update_fields=["REVW_MODERATION_DATA", "REVW_UPDATED_AT"])
        return {
            "token": token,
            "attempt": attempt,
            "text": review.REVW_TEXT,
            "photos": list(
                review.photos.order_by("RPHO_ID").values_list(
                    "RPHO_ID",
                    "RPHO_PHOTO_URL",
                    "RPHO_PHOTO_PUBLIC_ID",
                ),
            ),
        }

    @staticmethod
    def retry(
        review_id: int,
        expected_attempt: int | None = None,
        max_retries: int = MAX_RETRIES,
    ) -> str:
        """Assess one claimed stored snapshot and fence all result/publication writes."""
        claim = ReviewModerationRetryService._claim(
            review_id,
            expected_attempt,
            max_retries,
        )
        if claim is None:
            return "stale"

        # No database lock or service transaction surrounds the provider call.
        moderation = ReviewModerationService.moderate(
            text=claim["text"],
            image_urls=[
                photo[1]
                for photo in claim["photos"]
            ],
        )

        with transaction.atomic():
            current = (
                Review.objects
                .select_for_update()
                .filter(REVW_ID=review_id)
                .first()
            )
            if current is None or not ReviewModerationRetryService._is_retryable(
                current,
                claim["attempt"],
            ):
                return "stale"

            previous_metadata = current.REVW_MODERATION_DATA
            expires = ReviewModerationRetryService._timestamp(
                previous_metadata.get("retry_claim_expires_at"),
            )
            if (
                previous_metadata.get("retry_claim_token") != claim["token"]
                or expires is None
                or expires <= timezone.now()
            ):
                return "stale"

            current_photo_identity = list(
                current.photos
                .order_by("RPHO_ID")
                .values_list(
                    "RPHO_ID",
                    "RPHO_PHOTO_URL",
                    "RPHO_PHOTO_PUBLIC_ID",
                )
            )
            if (
                current.REVW_TEXT != claim["text"]
                or current_photo_identity != claim["photos"]
            ):
                metadata = previous_metadata.copy()
                metadata.pop("retry_claim_token", None)
                metadata.pop("retry_claim_expires_at", None)
                metadata["retry_next_attempt_at"] = timezone.now().isoformat()
                current.REVW_MODERATION_DATA = metadata
                current.save(update_fields=["REVW_MODERATION_DATA", "REVW_UPDATED_AT"])
                return "stale"

            for finding in moderation["findings"]:
                photo_index = finding["photo_index"]
                if photo_index is not None:
                    finding["photo_id"] = claim["photos"][photo_index][0]

            # Incomplete or positively flagged evidence can never authorize publication.
            if any(finding.get("flagged") is True for finding in moderation["findings"]):
                if moderation["outcome"] == "safe":
                    moderation["outcome"] = "flagged"
            if moderation["outcome"] == "safe" and moderation.get("incomplete") is True:
                moderation["outcome"] = "provider_failure"
                moderation["failure_type"] = "IncompleteModeration"

            attempt = claim["attempt"]
            moderation["retry_attempt"] = attempt + 1
            moderation["last_attempted_at"] = timezone.now().isoformat()
            moderation["last_provider_failure"] = previous_metadata.get(
                "last_provider_failure",
                previous_metadata.get("failure_type"),
            )

            if moderation["outcome"] == "provider_failure":
                exhausted = attempt >= max_retries
                moderation["retryable"] = not exhausted
                moderation["retry_exhausted"] = exhausted
                moderation["last_provider_failure"] = moderation["failure_type"]
            else:
                moderation["retryable"] = False
                moderation["retry_exhausted"] = False

            moderation["retry_next_attempt_at"] = None
            if moderation["retryable"]:
                moderation["retry_next_attempt_at"] = (
                    timezone.now() + timedelta(
                        seconds=ReviewModerationRetryService._backoff(attempt),
                    )
                ).isoformat()

            current.REVW_MODERATION_DATA = moderation
            current.save(
                update_fields=[
                    "REVW_MODERATION_DATA",
                    "REVW_UPDATED_AT",
                ],
            )

            if moderation["outcome"] == "safe":
                ReviewService.publish_under_review(current.REVW_ID)
                return "published"
            if moderation["outcome"] == "flagged":
                return "flagged"
            if moderation["retry_exhausted"]:
                return "exhausted"
            return "provider_failure"

    @staticmethod
    def dispatch(review_id: int) -> bool:
        """Send a retry hint while leaving due work durable after broker failure."""
        from apps.reviews.tasks import retry_failed_review_moderation

        review = Review.objects.filter(pk=review_id).first()
        if review is None or not ReviewModerationRetryService._is_retryable(review):
            return False
        metadata = review.REVW_MODERATION_DATA
        due = ReviewModerationRetryService._next_due(metadata)
        if due is None:
            return False
        countdown = max(0, math.ceil((due - timezone.now()).total_seconds()))
        try:
            retry_failed_review_moderation.apply_async(
                args=[review_id, metadata.get("retry_attempt", 0)],
                countdown=countdown,
                retry=False,
            )
        except Exception as exc:
            logger.error(
                "Review moderation delivery failed; persisted work remains recoverable.",
                extra={
                    "review_id": review_id,
                    "retry_attempt": metadata.get("retry_attempt", 0),
                    "error_type": type(exc).__name__,
                },
            )
            return False
        return True

    @staticmethod
    def recover_pending() -> int:
        """Redispatch a bounded batch of due or interrupted provider-failure checks."""
        candidates = (
            Review.objects
            .filter(
                REVW_STATUS=Review.ReviewStatus.UNDER_REVIEW,
                REVW_MODERATION_DATA__outcome="provider_failure",
            )
            .filter(
                Q(
                    REVW_MODERATION_DATA__retry_next_attempt_at__lte=timezone.now().isoformat(),
                )
                | ~Q(REVW_MODERATION_DATA__has_key="retry_next_attempt_at"),
            )
            .filter(
                Q(REVW_MODERATION_DATA__retryable=True)
                | ~Q(REVW_MODERATION_DATA__has_key="retryable"),
            )
            .filter(
                Q(REVW_MODERATION_DATA__retry_exhausted=False)
                | ~Q(REVW_MODERATION_DATA__has_key="retry_exhausted"),
            )
            .filter(
                Q(
                    REVW_MODERATION_DATA__retry_attempt__lte=ReviewModerationRetryService.MAX_RETRIES,
                )
                | ~Q(REVW_MODERATION_DATA__has_key="retry_attempt"),
            )
            .filter(
                ~Q(
                    REVW_MODERATION_DATA__findings__contains=[
                        {"source": "text", "flagged": True},
                    ],
                )
                | ~Q(REVW_MODERATION_DATA__has_key="findings"),
            )
            .filter(
                ~Q(
                    REVW_MODERATION_DATA__findings__contains=[
                        {"source": "image", "flagged": True},
                    ],
                )
                | ~Q(REVW_MODERATION_DATA__has_key="findings"),
            )
            .order_by("REVW_UPDATED_AT", "REVW_ID")
            .values_list("REVW_ID", flat=True)[:ReviewModerationRetryService.RECOVERY_BATCH_SIZE]
        )
        dispatched = 0
        for review_id in list(candidates):
            if ReviewModerationRetryService.dispatch(review_id):
                dispatched += 1
        return dispatched
