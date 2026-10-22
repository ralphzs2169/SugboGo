import asyncio
import logging
from functools import partial

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction

logger = logging.getLogger(__name__)


class NotificationRealtimeService:
    """Publish best-effort recipient signals after durable changes commit."""

    @staticmethod
    def group_name(user_id):
        """Derive a group from the server's authenticated recipient identity."""
        return f"notifications.user.{user_id}"

    @staticmethod
    def schedule(
        user_id,
        notification_id=None,
    ):
        """Schedule an inbox signal only after transaction commit."""
        if notification_id is None:
            transaction.on_commit(
                partial(
                    NotificationRealtimeService.publish,
                    user_id,
                ),
            )
        else:
            transaction.on_commit(
                partial(
                    NotificationRealtimeService.publish,
                    user_id,
                    notification_id=notification_id,
                ),
            )

    @staticmethod
    def publish(
        user_id,
        notification_id=None,
    ):
        """Preserve committed operations when the channel layer is unavailable."""
        try:
            async_to_sync(NotificationRealtimeService._send)(
                user_id,
                notification_id,
            )
        except Exception:
            # Provider exception text can contain Redis credentials.
            logger.warning("Notification realtime publication failed; REST inbox remains available.")

    @staticmethod
    async def _send(
        user_id,
        notification_id=None,
    ):
        """Bound Redis publication time without introducing durable retry semantics."""
        event = {"type": "inbox.changed"}
        if notification_id is not None:
            event = {
                "type": "notification.created",
                "notification_id": notification_id,
            }
        await asyncio.wait_for(
            get_channel_layer().group_send(
                NotificationRealtimeService.group_name(user_id),
                event,
            ),
            timeout=2,
        )
