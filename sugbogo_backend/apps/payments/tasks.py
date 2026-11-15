"""Dispatch and recover durable Maya webhook work with Celery."""

import logging

from celery import shared_task

from .services.maya_webhook_service import due_maya_event_ids, process_maya_delivery


logger = logging.getLogger(__name__)


@shared_task(
    name="apps.payments.tasks.process_maya_event",
    acks_late=True,
    reject_on_worker_lost=True,
    soft_time_limit=35,
    time_limit=50,
)
def process_maya_event(event_id):
    """Process one event using its database-backed processing lease."""
    process_maya_delivery(event_id)


def dispatch_maya_event(event_id):
    """Publish once after commit and leave undelivered work in the durable inbox."""
    app = process_maya_event.app
    transport_options = {
        **app.conf.broker_transport_options,
        "socket_connect_timeout": 1,
        "socket_timeout": 1,
        "retry_on_timeout": False,
        "max_retries": 0,
    }
    try:
        if not app.conf.broker_url:
            return False
        with app.connection_for_write(
            connect_timeout=1,
            transport_options=transport_options,
        ) as connection:
            connection.ensure_connection(max_retries=0, timeout=1)
            process_maya_event.apply_async(
                args=[event_id],
                connection=connection,
                retry=False,
            )
    except Exception as exc:
        logger.warning(
            "Maya event dispatch failed; the durable inbox will recover it.",
            extra={"event_id": event_id, "error_type": type(exc).__name__},
        )
        return False
    return True


@shared_task(name="apps.payments.tasks.recover_maya_events")
def recover_maya_events():
    """Redispatch due Sandbox work after broker loss or worker interruption."""
    for event_id in due_maya_event_ids():
        if not dispatch_maya_event(event_id):
            break
