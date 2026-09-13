import logging
from datetime import datetime

from celery import shared_task
from django.utils import timezone

from apps.business.services.discovery_score_service import (
    DiscoveryScoreService,
)
from apps.business.services.visibility_event_service import (
    VisibilityTrackingUnavailable,
)

logger = logging.getLogger(__name__)

TRANSIENT_RETRY_LIMIT = 3
TRANSIENT_RETRY_BASE_SECONDS = 60
TRANSIENT_RETRY_MAX_SECONDS = 300


@shared_task(
    bind=True,
    name="apps.business.tasks.recompute_discovery_scores",
    max_retries=TRANSIENT_RETRY_LIMIT,
)
def recompute_discovery_scores(
    task,
    reference_time_iso: str | None = None,
) -> dict:
    """Recomputes current Discovery Scores for all active businesses."""

    if reference_time_iso is None:
        reference_time = timezone.now()
        reference_time_iso = reference_time.isoformat()
    else:
        reference_time = datetime.fromisoformat(
            reference_time_iso,
        )

    logger.info(
        "Discovery score recomputation started.",
        extra={
            "reference_time": reference_time_iso,
        },
    )

    try:
        batch_result = DiscoveryScoreService.recompute_business_scores(
            reference_time=reference_time,
        )
    except VisibilityTrackingUnavailable as exc:
        retry_countdown = min(
            TRANSIENT_RETRY_BASE_SECONDS
            * (2 ** task.request.retries),
            TRANSIENT_RETRY_MAX_SECONDS,
        )
        logger.warning(
            "Discovery score recomputation will retry after a visibility failure.",
            extra={
                "reference_time": reference_time_iso,
                "retry_number": task.request.retries + 1,
                "retry_countdown_seconds": retry_countdown,
            },
        )
        raise task.retry(
            exc=exc,
            countdown=retry_countdown,
            kwargs={
                "reference_time_iso": reference_time_iso,
            },
        )
    except Exception:
        logger.exception(
            "Discovery score recomputation failed.",
            extra={
                "reference_time": reference_time_iso,
            },
        )
        raise

    failed_business_ids = [
        failure.business_id
        for failure in batch_result.failures
    ]
    summary = {
        "reference_time": reference_time_iso,
        "considered": batch_result.considered_count,
        "updated": batch_result.updated_count,
        "skipped_stale": batch_result.stale_count,
        "failed": batch_result.failed_count,
        "failed_business_ids": failed_business_ids,
    }

    if batch_result.failures:
        logger.warning(
            "Discovery score recomputation completed with business failures.",
            extra=summary,
        )
    else:
        logger.info(
            "Discovery score recomputation completed.",
            extra=summary,
        )

    return summary
