import asyncio
import json
import time

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed, InvalidToken

from apps.notifications.services.notification_realtime_service import (
    NotificationRealtimeService,
)
from apps.users.models import User


class NotificationConsumer(AsyncWebsocketConsumer):
    """Authenticate one recipient and signal committed inbox changes."""

    async def connect(self):
        """Open a bounded authentication window without joining a recipient group."""
        self.user_id = None
        self.group = None
        self.session_task = None
        self.auth_task = None
        self.closing = False
        if self.scope.get("query_string"):
            await self.close(code=4400)
            return
        await self.accept()
        self.auth_task = asyncio.create_task(self._authentication_deadline())

    async def _authentication_deadline(self):
        """Close idle unauthenticated sockets at the authentication deadline."""
        await asyncio.sleep(settings.NOTIFICATION_WS_AUTH_TIMEOUT)
        if self.user_id is None:
            await self.close(code=4401)

    @database_sync_to_async
    def _authenticate(self, raw_token):
        """Validate the configured access JWT and load its active account."""
        authentication = JWTAuthentication()
        token = authentication.get_validated_token(raw_token)
        user = authentication.get_user(token)
        if user.USER_ROLE not in User.UserRole.values:
            raise AuthenticationFailed("This account cannot access notifications.")
        return user.pk, token["exp"]

    @database_sync_to_async
    def _active(self):
        """Read authoritative account state before recipient signals are sent."""
        return User.objects.filter(
            pk=self.user_id,
            USER_STATUS=User.UserStatus.ACTIVE,
            USER_ROLE__in=User.UserRole.values,
        ).exists()

    async def receive(self, text_data=None, bytes_data=None):
        """Accept one authentication frame without permitting client mutations."""
        if self.closing:
            return
        if self.user_id is not None or text_data is None or len(text_data) > 8192:
            await self.close(code=4400)
            return
        try:
            payload = json.loads(text_data)
        except (ValueError, TypeError):
            await self.close(code=4400)
            return
        if (
            not isinstance(payload, dict)
            or set(payload) != {"type", "access"}
            or payload.get("type") != "authenticate"
            or not isinstance(payload.get("access"), str)
        ):
            await self.close(code=4400)
            return
        try:
            user_id, expires_at = await self._authenticate(payload["access"])
        except (InvalidToken, AuthenticationFailed):
            await self.close(code=4401)
            return
        if self.auth_task.done():
            await self.close(code=4401)
            return
        self.auth_task.cancel()
        self.user_id = user_id
        self.expires_at = expires_at
        self.group = NotificationRealtimeService.group_name(user_id)
        try:
            await asyncio.wait_for(
                self.channel_layer.group_add(self.group, self.channel_name), timeout=2,
            )
        except Exception:
            await self.close(code=1011)
            return
        if not await self._authorized():
            return
        await self.send(text_data=json.dumps({"type": "inbox.ready", "sync_required": True}))
        self.session_task = asyncio.create_task(self._watch_session())

    async def _authorized(self):
        """Close expired or disabled sessions before recipient data is signaled."""
        if self.closing:
            return False
        if time.time() >= self.expires_at:
            await self.close(code=4401)
            return False
        if not await self._active():
            await self.close(code=4403)
            return False
        return True

    async def _watch_session(self):
        """Check idle account state periodically and close at access-token expiry."""
        while True:
            remaining = self.expires_at - time.time()
            if remaining <= 0:
                await self.close(code=4401)
                return
            await asyncio.sleep(min(settings.NOTIFICATION_WS_STATUS_INTERVAL, remaining))
            if not await self._authorized():
                return

    async def inbox_changed(self, event):
        """Prompt only a currently authorized recipient to refetch their inbox."""
        if self.user_id is not None and await self._authorized():
            await self.send(text_data=json.dumps({"type": "inbox.changed", "sync_required": True}))

    async def close(self, code=None, reason=None):
        """Prevent further signals or duplicate closes while disconnect is pending."""
        if not self.closing:
            self.closing = True
            await super().close(code=code, reason=reason)

    async def disconnect(self, close_code):
        """Cancel timers and remove this device from its recipient group."""
        self.closing = True
        tasks = [task for task in (self.auth_task, self.session_task) if task is not None]
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        if self.group:
            try:
                await asyncio.wait_for(
                    self.channel_layer.group_discard(self.group, self.channel_name), timeout=2,
                )
            except Exception:
                pass
