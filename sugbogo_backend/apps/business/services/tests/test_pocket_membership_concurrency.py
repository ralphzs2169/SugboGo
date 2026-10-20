from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch

from django.db import close_old_connections, connections
from django.test import TransactionTestCase, skipUnlessDBFeature

from apps.business.models import BusinessPocket, PocketCollection, PocketMembership
from apps.business.services.pocket_collection_service import PocketCollectionService
from apps.business.services.pocket_service import PocketService
from apps.users.models import User

from .pocket_fixtures import PocketFixtures


@skipUnlessDBFeature("has_select_for_update")
class PocketMembershipConcurrencyTests(PocketFixtures, TransactionTestCase):
    """Uses separate real database connections to verify serialized membership writes."""

    def setUp(self):
        self.setUpTestData()
        patcher = patch.object(PocketService, "_record_save_visibility_event")
        self.record_save = patcher.start()
        self.addCleanup(patcher.stop)

    def concurrently(self, first, second):
        """Starts two writes together and always closes their thread-local connections."""
        barrier = Barrier(2)

        def run(operation):
            """Runs one independent transaction using a freshly retrieved owner."""
            close_old_connections()
            try:
                user = User.objects.get(pk=self.user.pk)
                barrier.wait(timeout=10)
                return operation(user)
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = [executor.submit(run, operation) for operation in (first, second)]
            return [future.result(timeout=30) for future in futures]

    def test_simultaneous_saves_increment_counter_and_emit_event_once(self):
        def save(user):
            """Replaces the same selection from two independent requests."""
            return PocketService.replace_memberships(
                user, self.business.pk, [self.favorites.pk, self.custom.pk],
            )

        states = self.concurrently(save, save)
        self.assertEqual(states[0], states[1])
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_POCKET_COUNT, 1)
        self.assertEqual(BusinessPocket.objects.filter(USER_ID=self.user, BUSN_ID=self.business).count(), 1)
        self.assertEqual(PocketMembership.objects.count(), 2)
        self.record_save.assert_called_once_with(explorer_id=self.user.pk, business_id=self.business.pk)

    def test_simultaneous_individual_removals_decrement_final_save_once(self):
        PocketService.replace_memberships(self.user, self.business.pk, [self.favorites.pk, self.custom.pk])
        self.record_save.reset_mock()
        self.concurrently(
            lambda user: PocketService.remove_membership(user, self.favorites.pk, self.business.pk),
            lambda user: PocketService.remove_membership(user, self.custom.pk, self.business.pk),
        )
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_POCKET_COUNT, 0)
        self.assertFalse(BusinessPocket.objects.filter(USER_ID=self.user, BUSN_ID=self.business).exists())
        self.assertFalse(PocketMembership.objects.exists())
        self.record_save.assert_not_called()

    def test_simultaneous_different_owners_count_as_two_holders(self):
        self.concurrently(
            lambda user: PocketService.replace_memberships(user, self.business.pk, [self.custom.pk]),
            lambda _: PocketService.replace_memberships(
                User.objects.get(pk=self.other.pk), self.business.pk, [self.foreign.pk],
            ),
        )
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_POCKET_COUNT, 2)
        self.assertEqual(BusinessPocket.objects.filter(BUSN_ID=self.business).count(), 2)
        self.assertEqual(self.record_save.call_count, 2)

    def test_collection_deletion_racing_with_replacement_leaves_no_orphan(self):
        PocketService.replace_memberships(self.user, self.business.pk, [self.custom.pk])
        self.concurrently(
            lambda user: PocketCollectionService.delete_collection(user, self.custom.pk),
            lambda user: PocketService.replace_memberships(user, self.business.pk, [self.second.pk]),
        )
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_POCKET_COUNT, 1)
        self.assertFalse(PocketCollection.objects.filter(pk=self.custom.pk).exists())
        state = PocketService.get_memberships(self.user, self.business.pk)
        self.assertEqual(state["pocket_ids"], [self.second.pk])
        self.assertEqual(BusinessPocket.objects.filter(USER_ID=self.user, BUSN_ID=self.business).count(), 1)
