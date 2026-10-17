import logging
from datetime import timedelta

from cloudinary.exceptions import AuthorizationRequired, BadRequest, NotAllowed
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from apps.review_disputes.models import MerchantReviewDisputeEvidence
from apps.reviews.models import ReplyPhoto, Review, ReviewMediaCleanup
from apps.shared.services.cloudinary_service import CloudinaryService

logger = logging.getLogger(__name__)


class ReviewMediaCleanupService:
    """Registers durable deletion work and processes assets with bounded retries."""

    MAX_ATTEMPTS = 4
    RETRY_BASE_SECONDS = 60
    RETRY_MAX_SECONDS = 300
    RECOVERY_BATCH_SIZE = 100

    @staticmethod
    def register_review_assets(review: Review) -> None:
        """Capture asset identifiers inside the review's locked deletion transaction."""
        assets = {
            (public_id, ReviewMediaCleanup.ResourceType.IMAGE)
            for public_id in review.photos.values_list("RPHO_PHOTO_PUBLIC_ID", flat=True)
            if public_id
        }
        assets.update(
            (public_id, ReviewMediaCleanup.ResourceType.IMAGE)
            for public_id in ReplyPhoto.objects.filter(
                RPLY_ID__REVW_ID_id=review.pk,
            ).values_list("RPHO_PHOTO_PUBLIC_ID", flat=True)
            if public_id
        )
        evidence = MerchantReviewDisputeEvidence.objects.filter(
            MRDSP_ID__REVW_ID_id=review.pk,
        ).values_list("MRDSE_PUBLIC_ID", "MRDSE_TYPE")
        for public_id, evidence_type in evidence:
            if not public_id:
                continue
            if evidence_type == MerchantReviewDisputeEvidence.EvidenceType.DOCUMENT:
                resource_type = ReviewMediaCleanup.ResourceType.RAW
            else:
                resource_type = ReviewMediaCleanup.ResourceType.IMAGE
            assets.add((public_id, resource_type))

        if not assets:
            return
        records = ReviewMediaCleanup.objects.bulk_create(
            [
                ReviewMediaCleanup(
                    RMCU_REVIEW_ID=review.pk,
                    RMCU_PUBLIC_ID=public_id,
                    RMCU_RESOURCE_TYPE=resource_type,
                )
                for public_id, resource_type in sorted(assets)
            ],
        )
        cleanup_ids = [record.pk for record in records]
        transaction.on_commit(
            lambda: ReviewMediaCleanupService.dispatch(cleanup_ids),
            robust=True,
        )

    @staticmethod
    def dispatch(cleanup_ids: list[int]) -> int:
        """Best-effort dispatch by row ID while PostgreSQL retains undelivered work."""
        from apps.reviews.tasks import cleanup_review_media_asset

        dispatched = 0
        for cleanup_id in cleanup_ids:
            try:
                cleanup_review_media_asset.apply_async(
                    args=[cleanup_id],
                    retry=False,
                )
                dispatched += 1
            except Exception as exc:
                logger.error(
                    "Review media cleanup dispatch failed; durable work remains pending.",
                    extra={"cleanup_id": cleanup_id, "error_type": type(exc).__name__},
                )
        return dispatched

    @staticmethod
    def recover_pending() -> int:
        """Redispatch a bounded batch of due records after lost delivery or restarts."""
        batch_size = ReviewMediaCleanupService.RECOVERY_BATCH_SIZE
        cleanup_ids = list(
            ReviewMediaCleanup.objects.filter(
                RMCU_STATUS=ReviewMediaCleanup.Status.PENDING,
                RMCU_NEXT_ATTEMPT_AT__lte=timezone.now(),
            )
            .order_by("RMCU_NEXT_ATTEMPT_AT", "RMCU_ID")
            .values_list("RMCU_ID", flat=True)[:batch_size]
        )
        return ReviewMediaCleanupService.dispatch(cleanup_ids)

    @staticmethod
    @transaction.atomic
    def process(cleanup_id: int) -> dict:
        """Serialize a bounded provider call on one independent cleanup row."""
        record = (
            ReviewMediaCleanup.objects
            .select_for_update(skip_locked=True)
            .filter(
                pk=cleanup_id,
                RMCU_STATUS=ReviewMediaCleanup.Status.PENDING,
                RMCU_NEXT_ATTEMPT_AT__lte=timezone.now(),
            )
            .first()
        )
        if record is None:
            return {"status": "skipped"}

        record.RMCU_ATTEMPTS += 1
        retry_after = 0
        try:
            CloudinaryService.destroy_asset(
                public_id=record.RMCU_PUBLIC_ID,
                resource_type=record.RMCU_RESOURCE_TYPE,
            )
        except Exception as exc:
            record.RMCU_LAST_ERROR = type(exc).__name__[:64]
            permanent = isinstance(
                exc,
                (AuthorizationRequired, BadRequest, NotAllowed, ValueError),
            )
            if (
                permanent
                or record.RMCU_ATTEMPTS >= ReviewMediaCleanupService.MAX_ATTEMPTS
            ):
                record.RMCU_STATUS = ReviewMediaCleanup.Status.FAILED
            else:
                retry_after = min(
                    ReviewMediaCleanupService.RETRY_BASE_SECONDS
                    * (2 ** (record.RMCU_ATTEMPTS - 1)),
                    ReviewMediaCleanupService.RETRY_MAX_SECONDS,
                )
                record.RMCU_NEXT_ATTEMPT_AT = timezone.now() + timedelta(seconds=retry_after)
            logger.warning(
                "Review media cleanup failed.",
                extra={
                    "cleanup_id": record.pk,
                    "attempt": record.RMCU_ATTEMPTS,
                    "cleanup_status": record.RMCU_STATUS,
                    "error_type": record.RMCU_LAST_ERROR,
                },
            )
        else:
            record.RMCU_STATUS = ReviewMediaCleanup.Status.SUCCEEDED
            record.RMCU_LAST_ERROR = ""
            record.RMCU_COMPLETED_AT = timezone.now()
        record.save(
            update_fields=[
                "RMCU_STATUS",
                "RMCU_ATTEMPTS",
                "RMCU_NEXT_ATTEMPT_AT",
                "RMCU_LAST_ERROR",
                "RMCU_COMPLETED_AT",
                "RMCU_UPDATED_AT",
            ],
        )
        return {"status": record.RMCU_STATUS, "retry_after": retry_after}

    @staticmethod
    @transaction.atomic
    def requeue_failed(cleanup_id: int) -> None:
        """Allow an operator to start a new bounded attempt cycle after intervention."""
        try:
            record = ReviewMediaCleanup.objects.select_for_update().get(pk=cleanup_id)
        except ReviewMediaCleanup.DoesNotExist:
            raise NotFound("The review media cleanup record could not be found.") from None
        if record.RMCU_STATUS != ReviewMediaCleanup.Status.FAILED:
            raise ValidationError("Only failed review media cleanup can be retried manually.")
        record.RMCU_STATUS = ReviewMediaCleanup.Status.PENDING
        record.RMCU_ATTEMPTS = 0
        record.RMCU_NEXT_ATTEMPT_AT = timezone.now()
        record.RMCU_LAST_ERROR = ""
        record.save(
            update_fields=[
                "RMCU_STATUS",
                "RMCU_ATTEMPTS",
                "RMCU_NEXT_ATTEMPT_AT",
                "RMCU_LAST_ERROR",
                "RMCU_UPDATED_AT",
            ],
        )
        transaction.on_commit(
            lambda: ReviewMediaCleanupService.dispatch([record.pk]),
            robust=True,
        )
