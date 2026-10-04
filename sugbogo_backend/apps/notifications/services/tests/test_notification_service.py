from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from django.db import close_old_connections, transaction
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from apps.notifications.models import Notification
from apps.notifications.services.notification_service import NotificationService
from apps.notifications.tests.fixtures import NotificationFixtures


class NotificationServiceTests(NotificationFixtures, TestCase):
    def test_duplicate_preserves_content_and_read_state(self):
        original = self.create_notification()
        marked = NotificationService.mark_read(self.user, original.pk)
        repeated = self.create_notification(title="Replacement content")
        self.assertEqual(repeated.pk, original.pk)
        self.assertEqual(repeated.NOTF_TITLE, original.NOTF_TITLE)
        self.assertEqual(repeated.NOTF_READ_AT, marked.NOTF_READ_AT)
        self.assertEqual(Notification.objects.count(), 1)

    def test_same_event_key_is_independent_per_recipient(self):
        first = self.create_notification()
        second = self.create_notification(self.other)
        self.assertNotEqual(first.pk, second.pk)

    def test_rollback_discards_notification(self):
        with self.assertRaises(RuntimeError):
            with transaction.atomic():
                self.create_notification()
                raise RuntimeError("Business operation failed")
        self.assertFalse(Notification.objects.exists())

    def test_invalid_content_and_target_rejected_without_writes(self):
        for values in (
            {"title": ""}, {"title": "x" * 161},
            {"body": "x" * 2001}, {"event_type": ""},
            {"dedup_key": ""}, {"target_type": "review"},
            {"target_id": 1}, {"target_type": "review", "target_id": 0},
        ):
            with self.subTest(values=values):
                with self.assertRaises(ValidationError):
                    self.create_notification(**values)
        self.assertFalse(Notification.objects.exists())

    def test_target_is_stored_when_both_fields_provided(self):
        notification = self.create_notification(target_type="review", target_id=123)
        self.assertEqual(notification.NOTF_TARGET_TYPE, "review")
        self.assertEqual(notification.NOTF_TARGET_ID, 123)

    def test_mark_read_is_idempotent_and_recipient_scoped(self):
        notification = self.create_notification()
        first = NotificationService.mark_read(self.user, notification.pk)
        second = NotificationService.mark_read(self.user, notification.pk)
        self.assertEqual(first.NOTF_READ_AT, second.NOTF_READ_AT)
        with self.assertRaises(NotFound):
            NotificationService.mark_read(self.other, notification.pk)
        with self.assertRaises(NotFound):
            NotificationService.mark_read(self.user, 999999)

    def test_bulk_read_preserves_old_timestamp_and_other_recipient(self):
        old = self.create_notification(key="old")
        old = NotificationService.mark_read(self.user, old.pk)
        original_read_at = old.NOTF_READ_AT
        fresh = self.create_notification(key="fresh")
        other = self.create_notification(self.other)
        self.assertEqual(NotificationService.mark_all_read(self.user), 1)
        self.assertEqual(NotificationService.mark_all_read(self.user), 0)
        old.refresh_from_db()
        fresh.refresh_from_db()
        other.refresh_from_db()
        self.assertIsNotNone(fresh.NOTF_READ_AT)
        self.assertIsNone(other.NOTF_READ_AT)
        self.assertEqual(old.NOTF_READ_AT, original_read_at)
        self.assertLessEqual(old.NOTF_READ_AT, fresh.NOTF_READ_AT)
        self.assertEqual(NotificationService.unread_count(self.user), 0)
        self.assertEqual(NotificationService.unread_count(self.other), 1)

    def test_ordering_is_stable_when_creation_times_tie(self):
        first = self.create_notification(key="first")
        second = self.create_notification(key="second")
        Notification.objects.update(NOTF_CREATED_AT=timezone.now())
        self.assertEqual(
            list(NotificationService.queryset(self.user).values_list("pk", flat=True)),
            [second.pk, first.pk],
        )

    def test_user_deletion_cascades_only_their_notifications(self):
        self.create_notification()
        other = self.create_notification(self.other)
        self.user.delete()
        self.assertEqual(list(Notification.objects.values_list("pk", flat=True)), [other.pk])


class ConcurrentNotificationTests(NotificationFixtures, TransactionTestCase):
    def test_concurrent_creation_produces_one_event(self):
        barrier = Barrier(2)
        user_id = self.user.pk

        def create():
            close_old_connections()
            try:
                from apps.users.models import User
                user = User.objects.get(pk=user_id)
                barrier.wait(timeout=10)
                return NotificationService.create(
                    recipient=user, event_type="review_decision",
                    title="Review inspected", body="Your review was inspected.",
                    dedup_key="same-event",
                ).pk
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(lambda _: create(), range(2)))
        self.assertEqual(results[0], results[1])
        self.assertEqual(Notification.objects.count(), 1)
