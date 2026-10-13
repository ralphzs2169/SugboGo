import asyncio
from datetime import timedelta
from unittest.mock import patch

from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from channels.routing import URLRouter
from channels.testing import HttpCommunicator, WebsocketCommunicator
from django.conf import settings
from django.test import TransactionTestCase, override_settings
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from apps.notifications.models import Notification
from apps.notifications.routing import websocket_urlpatterns
from apps.notifications.services.notification_realtime_service import NotificationRealtimeService
from apps.notifications.services.notification_service import NotificationService
from apps.notifications.tests.fixtures import NotificationFixtures
from apps.notifications.websocket_security import NotificationOriginValidator
from apps.users.models import User

MEMORY_LAYER = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}


@override_settings(CHANNEL_LAYERS=MEMORY_LAYER)
class NotificationSocketTests(NotificationFixtures, TransactionTestCase):
    def application(self):
        """Use the same routing and origin middleware as the production ASGI app."""
        return NotificationOriginValidator(
            URLRouter(websocket_urlpatterns), ["https://admin.example.com"],
        )

    async def open_socket(self, user=None, token=None, headers=None):
        """Open a native socket and authenticate with an access JWT."""
        socket = WebsocketCommunicator(
            self.application(), "/ws/notifications/", headers=headers or [],
        )
        accepted, _ = await socket.connect()
        self.assertTrue(accepted)
        await socket.send_json_to({
            "type": "authenticate",
            "access": token or str(AccessToken.for_user(user or self.user)),
        })
        return socket

    async def ready(self, socket):
        """Assert the socket requests authoritative REST synchronization."""
        self.assertEqual(
            await socket.receive_json_from(),
            {"type": "inbox.ready", "sync_required": True},
        )

    async def test_signed_authentication_and_reconnect_sync(self):
        for _ in range(2):
            socket = await self.open_socket()
            await self.ready(socket)
            await socket.disconnect()

    async def test_recipient_isolation_and_multiple_devices(self):
        first = await self.open_socket()
        second = await self.open_socket()
        other = await self.open_socket(self.other)
        for socket in (first, second, other):
            await self.ready(socket)
        await get_channel_layer().group_send(
            NotificationRealtimeService.group_name(self.user.pk), {"type": "inbox.changed"},
        )
        for socket in (first, second):
            self.assertEqual(
                await socket.receive_json_from(),
                {"type": "inbox.changed", "sync_required": True},
            )
        self.assertTrue(await other.receive_nothing(timeout=0.05))
        for socket in (first, second, other):
            await socket.disconnect()

    async def test_invalid_expired_and_refresh_tokens_are_rejected(self):
        expired = AccessToken.for_user(self.user)
        expired.set_exp(lifetime=timedelta(minutes=-1))
        refresh = await database_sync_to_async(RefreshToken.for_user)(self.user)
        for token in ("invalid", str(expired), str(refresh)):
            socket = await self.open_socket(token=token)
            event = await socket.receive_output()
            self.assertEqual(event["type"], "websocket.close")
            self.assertEqual(event["code"], 4401)
            await socket.disconnect()

    @override_settings(NOTIFICATION_WS_AUTH_TIMEOUT=0.03)
    async def test_unauthenticated_socket_times_out_without_private_signals(self):
        socket = WebsocketCommunicator(self.application(), "/ws/notifications/")
        self.assertTrue((await socket.connect())[0])
        await get_channel_layer().group_send(
            NotificationRealtimeService.group_name(self.user.pk), {"type": "inbox.changed"},
        )
        event = await socket.receive_output()
        self.assertEqual(event, {"type": "websocket.close", "code": 4401})
        await socket.disconnect()

    async def test_user_cannot_select_recipient_or_broadcast(self):
        socket = WebsocketCommunicator(self.application(), "/ws/notifications/")
        await socket.connect()
        await socket.send_json_to({
            "type": "authenticate",
            "access": str(AccessToken.for_user(self.user)),
            "user_id": self.other.pk,
        })
        self.assertEqual((await socket.receive_output())["code"], 4400)
        await socket.disconnect()
        authenticated = await self.open_socket()
        await self.ready(authenticated)
        await authenticated.send_json_to({"type": "broadcast", "user_id": self.other.pk})
        self.assertEqual((await authenticated.receive_output())["code"], 4400)
        await authenticated.disconnect()

    async def test_origins_allowlisted_native_allowed_and_query_tokens_rejected(self):
        for headers in (
            [(b"origin", b"https://evil.example.com")],
            [(b"origin", b"null")],
            [(b"origin", b"https://admin.example.com"),
             (b"origin", b"https://admin.example.com")],
        ):
            socket = WebsocketCommunicator(self.application(), "/ws/notifications/", headers=headers)
            self.assertEqual(await socket.connect(), (False, 4403))
            await socket.disconnect()
        allowed = await self.open_socket(headers=[(b"origin", b"https://admin.example.com")])
        await self.ready(allowed)
        await allowed.disconnect()
        query = WebsocketCommunicator(self.application(), "/ws/notifications/?access=token")
        self.assertEqual(await query.connect(), (False, 4400))
        await query.disconnect()

    async def test_disabled_account_rejected_before_authentication(self):
        token = str(AccessToken.for_user(self.user))
        await database_sync_to_async(User.objects.filter(pk=self.user.pk).update)(
            USER_STATUS=User.UserStatus.DISABLED,
        )
        socket = await self.open_socket(token=token)
        self.assertEqual((await socket.receive_output())["code"], 4401)
        await socket.disconnect()

    async def test_disabled_connected_user_receives_close_instead_of_signal(self):
        socket = await self.open_socket()
        await self.ready(socket)
        await database_sync_to_async(User.objects.filter(pk=self.user.pk).update)(
            USER_STATUS=User.UserStatus.DISABLED,
        )
        await get_channel_layer().group_send(
            NotificationRealtimeService.group_name(self.user.pk), {"type": "inbox.changed"},
        )
        self.assertEqual(await socket.receive_output(), {"type": "websocket.close", "code": 4403})
        await socket.disconnect()

    @override_settings(NOTIFICATION_WS_STATUS_INTERVAL=0.03)
    async def test_idle_disabled_account_is_disconnected(self):
        socket = await self.open_socket()
        await self.ready(socket)
        await database_sync_to_async(User.objects.filter(pk=self.user.pk).update)(
            USER_STATUS=User.UserStatus.DISABLED,
        )
        self.assertEqual((await socket.receive_output())["code"], 4403)
        await socket.disconnect()

    async def test_access_expiry_closes_idle_connection(self):
        token = AccessToken.for_user(self.user)
        token.set_exp(lifetime=timedelta(seconds=2))
        socket = await self.open_socket(token=str(token))
        await self.ready(socket)
        event = await socket.receive_output(timeout=3)
        self.assertEqual(event, {"type": "websocket.close", "code": 4401})
        await socket.disconnect()

    async def test_malformed_binary_and_oversized_messages_close_safely(self):
        for payload in ("not-json", "[]", "x" * 8193):
            socket = WebsocketCommunicator(self.application(), "/ws/notifications/")
            await socket.connect()
            await socket.send_to(text_data=payload)
            self.assertEqual((await socket.receive_output())["code"], 4400)
            await socket.disconnect()
        socket = WebsocketCommunicator(self.application(), "/ws/notifications/")
        await socket.connect()
        await socket.send_to(bytes_data=b"binary")
        self.assertEqual((await socket.receive_output())["code"], 4400)
        await socket.disconnect()

    async def test_committed_create_and_read_changes_signal_connected_device(self):
        socket = await self.open_socket()
        await self.ready(socket)
        notification = await database_sync_to_async(self.create_notification)()
        self.assertEqual((await socket.receive_json_from())["type"], "inbox.changed")
        await database_sync_to_async(NotificationService.mark_read)(self.user, notification.pk)
        self.assertEqual((await socket.receive_json_from())["type"], "inbox.changed")
        await database_sync_to_async(NotificationService.mark_read)(self.user, notification.pk)
        self.assertTrue(await socket.receive_nothing(timeout=0.05))
        await socket.disconnect()

    async def test_http_routing_preserved(self):
        from config.asgi import application

        request = HttpCommunicator(
            application, "GET", "/api/notifications/",
            headers=[(b"host", b"testserver")],
        )
        response = await request.get_response()
        self.assertEqual(response["status"], 401)
