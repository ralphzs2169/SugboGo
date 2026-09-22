import logging
from datetime import datetime

from celery import shared_task
from django.utils import timezone

from apps.reviews.services.business_review_insights_service import (
    BusinessReviewInsightsService,
)
from apps.reviews.services.review_keyword_service import RetryableKeywordError
from apps.reviews.services.review_summary_batch_service import ReviewSummaryBatchService

logger = logging.getLogger(__name__)

TRANSIENT_RETRY_LIMIT = 3
TRANSIENT_RETRY_BASE_SECONDS = 60
TRANSIENT_RETRY_MAX_SECONDS = 300


@shared_task(
    bind=True,
    name="apps.reviews.tasks.refresh_business_review_insights",
    max_retries=TRANSIENT_RETRY_LIMIT,
)
def refresh_business_review_insights(
    task,
    business_id: int,
    retry_keywords_only: bool = False,
) -> dict:
    """Refreshes one business and retries transient keyword failures only."""
    try:
        return BusinessReviewInsightsService.refresh(
            business_id,
            retry_keywords_only=retry_keywords_only,
        )
    except RetryableKeywordError as exc:
        countdown = min(
            TRANSIENT_RETRY_BASE_SECONDS * (2 ** task.request.retries),
            TRANSIENT_RETRY_MAX_SECONDS,
        )
        logger.warning(
            "Business review insights keywords will retry after a transient failure.",
            extra={
                "business_id": business_id,
                "retry_countdown_seconds": countdown,
            },
        )
        raise task.retry(
            exc=exc,
            countdown=countdown,
            kwargs={
                "business_id": business_id,
                "retry_keywords_only": True,
            },
        )


@shared_task(
    bind=True,
    name="apps.reviews.tasks.recompute_review_summaries",
    max_retries=TRANSIENT_RETRY_LIMIT,
)
def recompute_review_summaries(
    task,
    reference_time_iso: str | None = None,
    business_ids: list[int] | None = None,
    previous_summary: dict | None = None,
) -> dict:
    """Runs daily summaries and retries only transiently failed keyword requests."""
    if reference_time_iso is None:
        reference_time_iso = timezone.now().isoformat()
    else:
        reference_time = datetime.fromisoformat(reference_time_iso)
        if timezone.is_naive(reference_time):
            raise ValueError("The run reference time must include a timezone.")

    logger.info(
        "Review summary recomputation started.",
        extra={"reference_time": reference_time_iso, "retry_number": task.request.retries},
    )
    try:
        result = ReviewSummaryBatchService.recompute(business_ids=business_ids)
    except Exception:
        logger.exception("Review summary batch could not be completed.")
        raise

    summary = {"reference_time": reference_time_iso, **result}
    if previous_summary is not None:
        # Retried IDs already belong to the original considered-business count.
        summary["considered"] = previous_summary["considered"]
        for key in (
            "sentiment_updated", "keywords_updated", "keywords_cleared", "keywords_skipped",
        ):
            summary[key] += previous_summary[key]
        summary["failed_business_ids"] = sorted(set(
            previous_summary["failed_business_ids"] + result["failed_business_ids"],
        ))
    summary["failed"] = len(summary["failed_business_ids"]) + len(summary["retry_business_ids"])

    if summary["retry_business_ids"]:
        countdown = min(
            TRANSIENT_RETRY_BASE_SECONDS * (2 ** task.request.retries),
            TRANSIENT_RETRY_MAX_SECONDS,
        )
        logger.warning(
            "Review summary keywords will retry after transient failures.",
            extra={**summary, "retry_countdown_seconds": countdown},
        )
        raise task.retry(
            exc=RetryableKeywordError("Some business keyword requests remain unavailable."),
            countdown=countdown,
            kwargs={
                "reference_time_iso": reference_time_iso,
                "business_ids": summary["retry_business_ids"],
                "previous_summary": summary,
            },
        )

    if summary["failed"]:
        logger.warning("Review summary recomputation completed with failures.", extra=summary)
    else:
        logger.info("Review summary recomputation completed.", extra=summary)
    return summary
