"""Explicitly queued recommendation generation with bounded transient retries."""

from celery import shared_task

from apps.shared.services.gemini_structured_service import TransientGenerationError

from .models import MerchantRecommendation
from .services.recommendation_service import MAX_ATTEMPTS, RecommendationService


@shared_task(
    bind=True, name="apps.merchant_operations.merchant_analytics.tasks.generate_merchant_recommendations",
    max_retries=MAX_ATTEMPTS - 1,
)
def generate_merchant_recommendations(task, job_id):
    """Retry transient failures or lock contention without re-running completed work."""
    try:
        outcome = RecommendationService.generate(job_id)
        if outcome != "busy":
            return outcome
    except TransientGenerationError:
        outcome = "provider_temporarily_unavailable"
    if task.request.retries >= task.max_retries:
        RecommendationService._finish(job_id, MerchantRecommendation.State.FAILED, "retry_exhausted")
        return "failed"
    raise task.retry(
        exc=TransientGenerationError(outcome), countdown=min(60 * (2 ** task.request.retries), 300),
    )
