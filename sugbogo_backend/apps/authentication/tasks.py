from celery import shared_task
from django.db import OperationalError

from apps.authentication.services.login_history_service import LoginHistoryService


@shared_task(
    name="apps.authentication.tasks.prune_login_history",
    autoretry_for=(OperationalError,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def prune_login_history():
    """Removes expired login events through the existing Celery scheduler."""
    return LoginHistoryService.prune()
