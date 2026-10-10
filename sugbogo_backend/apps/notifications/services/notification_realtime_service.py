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
    def schedule(user_id):
        """Schedule an inbox signal only after transaction commit."""
        transaction.on_commit(partial(NotificationRealtimeService.publish, user_id))

    @staticmethod
    def publish(user_id):
        """Preserve committed operations when the channel layer is unavailable."""
        try:
            async_to_sync(NotificationRealtimeService._send)(user_id)
        except Exception:
            # Provider exception text can contain Redis credentials.
            logger.warning("Notification realtime publication failed; REST inbox remains available.")

    @staticmethod
    async def _send(user_id):
        """Bound Redis publication time without introducing durable retry semantics."""
        await asyncio.wait_for(
            get_channel_layer().group_send(
                NotificationRealtimeService.group_name(user_id),
                {"type": "inbox.changed"},
            ),
            timeout=2,
        )
