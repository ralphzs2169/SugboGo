from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier, Event
from unittest.mock import patch

from django.db import close_old_connections, connection, transaction
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.business.models import BusinessSpecialtyTag, BusinessVouch, SpecialtyTag
from apps.business.services.tests import test_vouch_service as vouch_fixtures
from apps.business.services.vouch_service import VouchService
from apps.notifications.models import Notification
from apps.notifications.services.notification_event_service import (
    NotificationEventService,
)
from apps.notifications.services.notification_service import NotificationService
from apps.notifications.services.vouch_notification_service import VouchNotificationService
from apps.users.models import User


class VouchNotificationFixtures:
    """Provide merchant-owned specialties and isolated notification side effects."""

    @classmethod
    def setUpTestData(cls):
        """Reuse the maintained vouch fixtures with a merchant business owner."""
        vouch_fixtures.BusinessVouchServiceTests.setUpTestData.__func__(cls)
        cls.business_owner.USER_ROLE = User.UserRole.MERCHANT
        cls.business_owner.save(update_fields=["USER_ROLE"])

    def setUp(self):
        """Isolate notification behavior from reputation configuration."""
        super().setUp()
        dispatch = patch(
            "apps.business.services.vouch_service.VouchService._dispatch_score_refresh",
        )
        dispatch.start()
        self.addCleanup(dispatch.stop)
        reward = patch(
            "apps.business.services.vouch_service.ReputationService.apply_vouch_reward",
        )
        reward.start()
        self.addCleanup(reward.stop)
        realtime = patch(
            "apps.notifications.services.notification_realtime_service.NotificationRealtimeService.publish",
        )
        realtime.start()
        self.addCleanup(realtime.stop)

    def create_vouch(
        self,
        tag=None,
    ):
        """Create an endorsement through the production transaction."""
        if tag is None:
            tag = self.spicy_tag
        return VouchService.create_vouch(
            user=self.user,
            business_id=self.business.pk,
            tag_id=tag.pk,
        )


class BusinessVouchNotificationTests(VouchNotificationFixtures, TestCase):
    """Cover fixed-window grouping, acknowledgement boundaries, and replay safety."""

    def test_same_explorer_specialties_share_one_unread_notification(self):
        first = self.create_vouch()
        original = Notification.objects.get()
        created_at = original.NOTF_CREATED_AT
        second = self.create_vouch(self.traditional_tag)
        notice = Notification.objects.get()
        self.assertEqual(notice.pk, original.pk)
        self.assertEqual(notice.NOTF_CREATED_AT, created_at)
        self.assertIsNone(notice.NOTF_READ_AT)
        self.assertEqual(
            notice.NOTF_BODY,
            f"{self.user.full_name} vouched for 2 of your specialties: Spicy and Traditional.",
        )
        self.assertCountEqual(notice.NOTF_METADATA["vouch_ids"], [first.pk, second.pk])
        self.assertEqual(NotificationService.unread_count(self.business_owner), 1)

    def test_three_specialties_are_named_and_larger_groups_have_bounded_copy(self):
        self.create_vouch()
        self.create_vouch(self.traditional_tag)
        for name in ("Handmade", "Locally Made"):
            tag = SpecialtyTag.objects.create(
                TAG_NAME=name,
                TAG_COLOR="red",
            )
            BusinessSpecialtyTag.objects.create(
                BUSN_ID=self.business,
                TAG_ID=tag,
            )
            self.create_vouch(tag)
            body = Notification.objects.get().NOTF_BODY
            if name == "Handmade":
                self.assertIn("Spicy, Traditional, and Handmade.", body)
            else:
                self.assertIn("4 of your specialties", body)
                self.assertIn("Spicy, Traditional, Handmade, and 1 more.", body)

    def test_group_expires_from_creation_instead_of_last_update(self):
        self.create_vouch()
        original = Notification.objects.get()
        now = timezone.now()
        Notification.objects.filter(pk=original.pk).update(
            NOTF_CREATED_AT=now - timedelta(seconds=61),
            NOTF_UPDATED_AT=now - timedelta(seconds=1),
        )
        self.create_vouch(self.traditional_tag)
        self.assertEqual(Notification.objects.count(), 2)
        original.refresh_from_db()
        self.assertEqual(len(original.NOTF_METADATA["specialties"]), 1)

    def test_read_notice_is_frozen_for_later_vouches_from_same_explorer(self):
        self.create_vouch()
        original = Notification.objects.get()
        NotificationService.mark_read(self.business_owner, original.pk)
        original.refresh_from_db()
        body = original.NOTF_BODY
        read_at = original.NOTF_READ_AT
        self.create_vouch(self.traditional_tag)
        original.refresh_from_db()
        self.assertEqual(original.NOTF_BODY, body)
        self.assertEqual(original.NOTF_READ_AT, read_at)
        self.assertEqual(Notification.objects.count(), 2)
        self.assertEqual(NotificationService.unread_count(self.business_owner), 1)

    def test_different_explorers_keep_separate_unread_notices(self):
        self.create_vouch()
        VouchService.create_vouch(
            user=self.second_user,
            business_id=self.business.pk,
            tag_id=self.spicy_tag.pk,
        )
        self.assertEqual(Notification.objects.count(), 2)
        self.assertEqual(NotificationService.unread_count(self.business_owner), 2)

    def test_failed_vouch_transaction_does_not_change_an_existing_group(self):
        self.create_vouch()
        original = Notification.objects.get()
        body = original.NOTF_BODY
        metadata = original.NOTF_METADATA
        with self.assertRaises(RuntimeError):
            with transaction.atomic():
                self.create_vouch(self.traditional_tag)
                raise RuntimeError("Rollback")
        original.refresh_from_db()
        self.assertEqual(original.NOTF_BODY, body)
        self.assertEqual(original.NOTF_METADATA, metadata)
        self.assertEqual(Notification.objects.count(), 1)
        self.assertEqual(BusinessVouch.objects.count(), 1)

    def test_appended_event_replay_stays_idempotent_after_read_and_expiry(self):
        self.create_vouch()
        second = self.create_vouch(self.traditional_tag)
        original = Notification.objects.get()
        NotificationService.mark_read(self.business_owner, original.pk)
        Notification.objects.filter(pk=original.pk).update(
            NOTF_CREATED_AT=timezone.now() - timedelta(minutes=2),
        )
        NotificationEventService.business_vouch_received(second)
        self.assertEqual(Notification.objects.count(), 1)
        original.refresh_from_db()
        self.assertIsNotNone(original.NOTF_READ_AT)
        self.assertEqual(len(original.NOTF_METADATA["vouch_ids"]), 2)

    def test_repeated_specialty_does_not_inflate_distinct_specialty_count(self):
        self.create_vouch()
        VouchService.remove_vouch(
            user=self.user,
            business_id=self.business.pk,
            tag_id=self.spicy_tag.pk,
        )
        self.create_vouch()
        notice = Notification.objects.get()
        self.assertEqual(len(notice.NOTF_METADATA["specialties"]), 1)
        self.assertEqual(len(notice.NOTF_METADATA["vouch_ids"]), 1)

    def test_legacy_notice_is_not_rewritten_or_duplicated_on_replay(self):
        vouch = self.create_vouch()
        original = Notification.objects.get()
        Notification.objects.filter(pk=original.pk).update(NOTF_METADATA={})
        NotificationEventService.business_vouch_received(vouch)
        self.create_vouch(self.traditional_tag)
        self.assertEqual(Notification.objects.count(), 2)
        original.refresh_from_db()
        self.assertEqual(original.NOTF_METADATA, {})

    def test_new_vouch_notifies_only_owner_without_navigation_target(self):
        self.create_vouch()
        notice = Notification.objects.get()
        self.assertEqual(notice.USER_ID_id, self.business_owner.pk)
        self.assertEqual(notice.NOTF_TYPE, "business_vouch_received")
        self.assertEqual(notice.NOTF_TITLE, "New specialty vouch")
        self.assertEqual(
            notice.NOTF_BODY,
            f"{self.user.full_name} vouched for your {self.spicy_tag.TAG_NAME} specialty.",
        )
        self.assertEqual(notice.NOTF_TARGET_TYPE, "")
        self.assertIsNone(notice.NOTF_TARGET_ID)
        self.assertIsNone(notice.NOTF_READ_AT)
        self.assertNotIn(self.user.USER_EMAIL, notice.NOTF_BODY)

    def test_duplicate_submission_and_event_do_not_create_extra_notices(self):
        vouch = self.create_vouch()
        NotificationEventService.business_vouch_received(vouch)
        with self.assertRaises(ValidationError):
            self.create_vouch()
        self.assertEqual(Notification.objects.count(), 1)

    def test_new_vouch_leaves_previously_read_notice_unchanged(self):
        self.create_vouch()
        original = NotificationService.mark_read(
            self.business_owner,
            Notification.objects.get().pk,
        )
        read_at = original.NOTF_READ_AT
        body = original.NOTF_BODY
        VouchService.create_vouch(
            user=self.second_user,
            business_id=self.business.pk,
            tag_id=self.spicy_tag.pk,
        )
        original.refresh_from_db()
        self.assertEqual(original.NOTF_READ_AT, read_at)
        self.assertEqual(original.NOTF_BODY, body)
        self.assertEqual(Notification.objects.count(), 2)
        self.assertEqual(
            NotificationService.unread_count(self.business_owner),
            1,
        )

    def test_blank_public_name_uses_explorer_fallback(self):
        self.user.USER_FNAME = " "
        self.user.USER_LNAME = " "
        self.user.save(update_fields=["USER_FNAME", "USER_LNAME"])
        self.create_vouch()
        self.assertEqual(
            Notification.objects.get().NOTF_BODY,
            "An explorer vouched for your Spicy specialty.",
        )

    def test_removing_vouch_preserves_its_informational_notice(self):
        self.create_vouch()
        VouchService.remove_vouch(
            user=self.user,
            business_id=self.business.pk,
            tag_id=self.spicy_tag.pk,
        )
        self.assertFalse(
            BusinessVouch.objects.filter(
                VOUCH_WITHDRAWN_AT__isnull=True,
            ).exists(),
        )
        self.assertEqual(BusinessVouch.objects.count(), 1)
        self.assertEqual(Notification.objects.count(), 1)

    def test_rollback_does_not_leave_vouch_or_notification(self):
        with self.assertRaises(RuntimeError):
            with transaction.atomic():
                self.create_vouch()
                raise RuntimeError("Rollback")
        self.assertFalse(BusinessVouch.objects.exists())
        self.assertFalse(Notification.objects.exists())
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_VOUCH_COUNT, 0)


class ConcurrentVouchNotificationTests(VouchNotificationFixtures, TransactionTestCase):
    """Exercise competing writes and a read committed between group lookup and update."""

    def setUp(self):
        """Create committed fixtures for independently connected workers."""
        self.setUpTestData()
        super().setUp()

    def _create_in_connection(
        self,
        tag_id,
        barrier=None,
    ):
        """Run the production vouch transaction using a worker-owned connection."""
        close_old_connections()
        try:
            if barrier is not None:
                barrier.wait(timeout=10)
            user = User.objects.get(pk=self.user.pk)
            return VouchService.create_vouch(
                user=user,
                business_id=self.business.pk,
                tag_id=tag_id,
            ).pk
        finally:
            close_old_connections()

    def test_simultaneous_specialty_vouches_share_one_group_without_losing_tags(self):
        if connection.vendor != "postgresql":
            self.skipTest("Grouping concurrency requires PostgreSQL row locks.")
        barrier = Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as executor:
            first = executor.submit(
                self._create_in_connection,
                self.spicy_tag.pk,
                barrier,
            )
            second = executor.submit(
                self._create_in_connection,
                self.traditional_tag.pk,
                barrier,
            )
            vouch_ids = [first.result(timeout=20), second.result(timeout=20)]
        notice = Notification.objects.get()
        self.assertCountEqual(notice.NOTF_METADATA["vouch_ids"], vouch_ids)
        self.assertCountEqual(
            [
                item["id"]
                for item in notice.NOTF_METADATA["specialties"]
            ],
            [self.spicy_tag.pk, self.traditional_tag.pk],
        )

    def test_read_winning_the_update_race_freezes_old_body_and_starts_new_notice(self):
        if connection.vendor != "postgresql":
            self.skipTest("Grouping concurrency requires PostgreSQL row locks.")
        self.create_vouch()
        original = Notification.objects.get()
        body = original.NOTF_BODY
        group_found = Event()
        allow_update = Event()
        format_body = VouchNotificationService._body

        def pause_group_update(metadata):
            """Let the reader commit after lookup but before the conditional update."""
            if len(metadata["specialties"]) == 2:
                group_found.set()
                if not allow_update.wait(timeout=10):
                    raise RuntimeError("The read transaction did not complete.")
            return format_body(metadata)

        with patch.object(
            VouchNotificationService,
            "_body",
            side_effect=pause_group_update,
        ):
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(
                    self._create_in_connection,
                    self.traditional_tag.pk,
                )
                try:
                    self.assertTrue(group_found.wait(timeout=10))
                    NotificationService.mark_read(self.business_owner, original.pk)
                finally:
                    allow_update.set()
                future.result(timeout=20)
        original.refresh_from_db()
        self.assertEqual(original.NOTF_BODY, body)
        self.assertIsNotNone(original.NOTF_READ_AT)
        self.assertEqual(Notification.objects.count(), 2)
        self.assertEqual(NotificationService.unread_count(self.business_owner), 1)
