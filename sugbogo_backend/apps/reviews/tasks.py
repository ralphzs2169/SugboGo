import logging

from celery import shared_task
from django.conf import settings
from django.utils import timezone
from rest_framework.exceptions import NotFound

from apps.reviews.services.business_review_insights_service import (
    BusinessReviewInsightsService,
)
from apps.reviews.services.review_moderation_retry_service import (
    ReviewModerationRetryService,
)
from apps.reviews.services.review_sentiment_service import ReviewSentimentService
from apps.reviews.services.business_review_summary_service import BusinessReviewSummaryService
from apps.reviews.services.review_summary_batch_service import ReviewSummaryBatchService
from apps.reviews.services.review_media_cleanup_service import ReviewMediaCleanupService
from apps.reviews.services.review_insight_scheduling_service import ReviewInsightSchedulingService

logger = logging.getLogger(__name__)

TRANSIENT_RETRY_LIMIT = 3


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
    name="apps.reviews.tasks.retry_failed_review_moderation",
)
def retry_failed_review_moderation(
    review_id: int,
    expected_attempt: int | None = None,
) -> str:
    """Process initial or retry work and redispatch recoverable provider failures."""
    logger.info(
        "Review moderation retry started.",
        extra={
            "review_id": review_id,
            "expected_attempt": expected_attempt,
        },
    )
    outcome = ReviewModerationRetryService.retry(
        review_id=review_id,
        expected_attempt=expected_attempt,
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

    ReviewModerationRetryService.dispatch(review_id)
    return outcome


@shared_task(name="apps.reviews.tasks.recover_review_moderation_retries")
def recover_review_moderation_retries() -> int:
    """Recover initial and provider-failure moderation independently of message history."""
    return ReviewModerationRetryService.recover_pending()


@shared_task(name="apps.reviews.tasks.process_review_sentiment")
def process_review_sentiment(
    review_id: int,
    business_id: int,
) -> str:
    """Score one review and update sentiment independently of narrative scheduling."""
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
    return outcome


@shared_task(name="apps.reviews.tasks.recover_review_insight_regeneration")
def recover_review_insight_regeneration():
    """Publish due hints only after recovering durable observation and expired leases."""
    return ReviewInsightSchedulingService.recover_and_dispatch()


@shared_task(name="apps.reviews.tasks.reconcile_business_review_sentiment")
def reconcile_business_review_sentiment(
    business_id: int,
):
    """Preserve full refresh sentiment work without triggering narrative demand."""
    try:
        result = ReviewSentimentService.reconcile_business(business_id)
        BusinessReviewSummaryService.recompute_sentiment(business_id)
        return result
    except NotFound:
        return "missing"
    except Exception as exc:
        logger.warning(
            "Business sentiment refresh failed. business_id=%s error_type=%s",
            business_id,
            type(exc).__name__,
        )
        return "failed"


@shared_task(
    name="apps.reviews.tasks.process_review_insight_regeneration",
    acks_late=True,
    reject_on_worker_lost=True,
    soft_time_limit=settings.GEMINI_TIMEOUT_SECONDS + 60,
    time_limit=settings.GEMINI_TIMEOUT_SECONDS + 90,
)
def process_review_insight_regeneration(
    business_id: int,
):
    """Claim current due demand at execution time and publish through revision fencing."""
    return ReviewInsightSchedulingService.process(business_id)


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
    """Translate old queued messages into idempotent durable reconciliation requests."""
    return BusinessReviewInsightsService.refresh(
        business_id,
        retry_keywords_only=retry_keywords_only,
        reference_time=None,
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
    """Reconcile sentiment and durable narrative demand without running Gemini."""
    reference_time = timezone.now()
    result = ReviewSummaryBatchService.recompute(
        business_ids=business_ids,
        reference_time=reference_time,
    )
    summary = {"reference_time": reference_time.isoformat(), **result}
    summary["failed"] = len(result["failed_business_ids"])
    logger.info("Review summary reconciliation completed.", extra=summary)
    return summary
