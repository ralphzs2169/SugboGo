from unittest.mock import AsyncMock, patch

from django.db import transaction
from django.test import TestCase, override_settings

from apps.notifications.models import Notification
from apps.notifications.services.notification_realtime_service import NotificationRealtimeService
from apps.notifications.services.notification_service import NotificationService
from apps.notifications.tests.fixtures import NotificationFixtures


@override_settings(CHANNEL_LAYERS={"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}})
class NotificationPublicationTests(NotificationFixtures, TestCase):
    def test_commit_emits_one_creation_signal_and_duplicate_emits_none(self):
        with patch.object(NotificationRealtimeService, "publish") as publish:
            with self.captureOnCommitCallbacks(execute=True):
                self.create_notification()
                self.create_notification()
                publish.assert_not_called()
            publish.assert_called_once_with(self.user.pk)

    def test_rollback_discards_publication_and_inbox_record(self):
        with patch.object(NotificationRealtimeService, "publish") as publish:
            with self.captureOnCommitCallbacks(execute=True):
                with self.assertRaises(RuntimeError):
                    with transaction.atomic():
                        self.create_notification()
                        raise RuntimeError("Decision failed")
            publish.assert_not_called()
        self.assertFalse(Notification.objects.exists())

    def test_read_signals_only_for_changed_recipient_items(self):
        item = self.create_notification()
        with patch.object(NotificationRealtimeService, "publish") as publish:
            with self.captureOnCommitCallbacks(execute=True):
                NotificationService.mark_read(self.user, item.pk)
                NotificationService.mark_read(self.user, item.pk)
                NotificationService.mark_all_read(self.user)
            publish.assert_called_once_with(self.user.pk)
        self.create_notification(key="next")
        with patch.object(NotificationRealtimeService, "publish") as publish:
            with self.captureOnCommitCallbacks(execute=True):
                self.assertEqual(NotificationService.mark_all_read(self.user), 1)
                self.assertEqual(NotificationService.mark_all_read(self.user), 0)
            publish.assert_called_once_with(self.user.pk)

    def test_publication_failure_preserves_saved_notification_without_credential_logs(self):
        layer = type("FailingLayer", (), {
            "group_send": AsyncMock(side_effect=RuntimeError("redis://secret@host")),
        })()
        with patch("apps.notifications.services.notification_realtime_service.get_channel_layer",
                   return_value=layer):
            with self.assertLogs("apps.notifications.services.notification_realtime_service",
                                 level="WARNING") as logs:
                with self.captureOnCommitCallbacks(execute=True):
                    self.create_notification()
        self.assertEqual(Notification.objects.count(), 1)
        self.assertNotIn("secret", str(logs.output))
