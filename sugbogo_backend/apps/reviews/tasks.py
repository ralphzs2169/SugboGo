import logging
from datetime import datetime

from celery import shared_task
from django.utils import timezone

from apps.reviews.services.business_review_insights_service import (
    BusinessReviewInsightsService,
)
from apps.reviews.services.review_keyword_service import (
    ReviewKeywordService,
    RetryableKeywordError,
)
from apps.reviews.services.review_moderation_retry_service import (
    ReviewModerationRetryService,
)
from apps.reviews.services.review_sentiment_service import ReviewSentimentService
from apps.reviews.services.review_summary_batch_service import ReviewSummaryBatchService
from apps.reviews.services.review_media_cleanup_service import ReviewMediaCleanupService

logger = logging.getLogger(__name__)

TRANSIENT_RETRY_LIMIT = 3
TRANSIENT_RETRY_BASE_SECONDS = 60
TRANSIENT_RETRY_MAX_SECONDS = 300


@shared_task(
    bind=True,
    name="apps.reviews.tasks.cleanup_review_media_asset",
    max_retries=TRANSIENT_RETRY_LIMIT,
)
def cleanup_review_media_asset(
    task,
    cleanup_id: int,
) -> str:
    """Process durable cleanup and accelerate due retries without relying on delivery."""
    outcome = ReviewMediaCleanupService.process(cleanup_id)
    if (
        outcome["status"] == "pending"
        and task.request.retries < task.max_retries
    ):
        raise task.retry(
            exc=RuntimeError("Review media cleanup remains pending."),
            countdown=outcome["retry_after"],
        )
    return outcome["status"]


@shared_task(name="apps.reviews.tasks.recover_review_media_cleanup")
def recover_review_media_cleanup() -> int:
    """Redispatch due cleanup independently of the original deletion callback."""
    return ReviewMediaCleanupService.recover_pending()


@shared_task(
    bind=True,
    name="apps.reviews.tasks.retry_failed_review_moderation",
    max_retries=TRANSIENT_RETRY_LIMIT,
)
def retry_failed_review_moderation(task, review_id: int) -> str:
    """Recover only a review held by a transient moderation failure."""
    logger.info(
        "Review moderation retry started.",
        extra={
            "review_id": review_id,
            "retry_number": task.request.retries,
        },
    )
    outcome = ReviewModerationRetryService.retry(
        review_id=review_id,
        expected_attempt=task.request.retries,
        max_retries=task.max_retries,
    )

    if outcome == "stale":
        logger.info(
            "Stale review moderation retry skipped.",
            extra={"review_id": review_id},
        )
        return outcome
    if outcome == "published":
        logger.info(
            "Review moderation retry published safe review.",
            extra={"review_id": review_id},
        )
        return outcome
    if outcome == "flagged":
        logger.info(
            "Review moderation retry found flagged content; review remains held.",
            extra={"review_id": review_id},
        )
        return outcome
    if outcome == "exhausted":
        logger.error(
            "Review moderation retries exhausted; review remains held.",
            extra={"review_id": review_id},
        )
        return outcome

    countdown = min(
        TRANSIENT_RETRY_BASE_SECONDS * (2 ** task.request.retries),
        TRANSIENT_RETRY_MAX_SECONDS,
    )
    logger.warning(
        "Review moderation provider failed again; retry scheduled.",
        extra={
            "review_id": review_id,
            "retry_countdown_seconds": countdown,
        },
    )
    raise task.retry(
        exc=RuntimeError("Review moderation provider remains unavailable."),
        countdown=countdown,
    )


@shared_task(name="apps.reviews.tasks.process_review_sentiment")
def process_review_sentiment(
    review_id: int,
    business_id: int,
) -> str:
    """Scores one review, updates sentiment, then queues generated insights."""
    try:
        outcome = ReviewSentimentService.process_review(review_id)
    except Exception as exc:
        logger.error(
            "Review sentiment processing failed.",
            extra={"review_id": review_id, "error_type": type(exc).__name__},
        )
        return "failed"

    if outcome == "missing":
        logger.info(
            "Review sentiment skipped; review is missing.",
            extra={"review_id": review_id},
        )
    elif outcome == "stale":
        logger.info(
            "Stale review sentiment discarded.",
            extra={"review_id": review_id},
        )
    elif outcome == "updated":
        logger.info(
            "Review sentiment updated.",
            extra={
                "review_id": review_id,
                "business_id": business_id,
            },
        )
        try:
            refresh_business_review_insights.delay(
                business_id,
            )
            logger.info(
                "Business review insights refresh queued after sentiment update.",
                extra={
                    "review_id": review_id,
                    "business_id": business_id,
                },
            )
        except Exception as exc:
            logger.error(
                "Business review insights refresh enqueue failed after sentiment update.",
                extra={
                    "review_id": review_id,
                    "business_id": business_id,
                    "error_type": type(exc).__name__,
                },
            )
    return outcome


@shared_task(
    bind=True,
    name="apps.reviews.tasks.refresh_business_review_insights",
    max_retries=TRANSIENT_RETRY_LIMIT,
)
def refresh_business_review_insights(
    task,
    business_id: int,
    retry_keywords_only: bool = False,
    reference_time_iso: str | None = None,
) -> dict:
    """Refreshes one business and reuses its window across transient retries."""
    if reference_time_iso is None:
        reference_time = timezone.now()
        reference_time_iso = reference_time.isoformat()
    else:
        reference_time = datetime.fromisoformat(reference_time_iso)
        if timezone.is_naive(reference_time):
            raise ValueError("The run reference time must include a timezone.")
    try:
        return BusinessReviewInsightsService.refresh(
            business_id,
            retry_keywords_only=retry_keywords_only,
            reference_time=reference_time,
        )
    except RetryableKeywordError as exc:
        if task.request.retries >= task.max_retries:
            ReviewKeywordService.mark_retry_exhausted(
                business_id,
                reference_time=reference_time,
            )
            logger.error(
                "Business review insights keyword retries were exhausted.",
                extra={"business_id": business_id},
            )
            raise

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
                "retry_keywords_only": True,
                "reference_time_iso": reference_time_iso,
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
        reference_time = timezone.now()
        reference_time_iso = reference_time.isoformat()
    else:
        reference_time = datetime.fromisoformat(reference_time_iso)
        if timezone.is_naive(reference_time):
            raise ValueError("The run reference time must include a timezone.")

    logger.info(
        "Review summary recomputation started.",
        extra={"reference_time": reference_time_iso, "retry_number": task.request.retries},
    )
    try:
        result = ReviewSummaryBatchService.recompute(
            business_ids=business_ids,
            reference_time=reference_time,
        )
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
        if task.request.retries >= task.max_retries:
            for business_id in summary["retry_business_ids"]:
                ReviewKeywordService.mark_retry_exhausted(
                    business_id,
                    reference_time=reference_time,
                )
            logger.error(
                "Review summary keyword retries were exhausted.",
                extra=summary,
            )
            raise RetryableKeywordError(
                "Some business keyword requests exhausted their retries."
            )

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
