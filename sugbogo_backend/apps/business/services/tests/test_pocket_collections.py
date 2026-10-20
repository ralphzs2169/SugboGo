from datetime import timedelta
from unittest.mock import patch

from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.business.models import Business, BusinessPocket, PocketCollection, PocketMembership
from apps.business.services.pocket_collection_service import PocketCollectionService
from apps.business.services.pocket_service import PocketService
from apps.explorer_operations.explore_businesses.services.pocket_collection_query_service import (
    PocketCollectionQueryService,
)
from apps.users.models import User

from .pocket_fixtures import PocketFixtures


class PocketCollectionServiceTests(PocketFixtures, TestCase):
    """Covers ownership, provisioning, defaults, names, and collection cleanup."""

    def test_eager_favorites_for_eligible_roles_only(self):
        for user in (self.user, self.owner):
            self.assertEqual(user.pocket_collections.filter(PCOL_IS_DEFAULT=True).count(), 1)
            existing = PocketCollectionService.provision_favorites(user)
            self.assertEqual(existing.PCOL_NAME, "Favorites")
            self.assertEqual(user.pocket_collections.filter(PCOL_IS_DEFAULT=True).count(), 1)
        admin = self.make_user("pocket-admin", User.UserRole.ADMIN)
        self.assertFalse(admin.pocket_collections.exists())

    def test_user_and_favorites_provisioning_roll_back_together(self):
        with patch.object(PocketCollectionService, "provision_favorites", side_effect=RuntimeError):
            with self.assertRaises(RuntimeError):
                self.make_user("pocket-failed-provision")
        self.assertFalse(User.objects.filter(USER_EMAIL="pocket-failed-provision@example.com").exists())

    def test_names_normalize_whitespace_and_are_unique_per_owner(self):
        collection = PocketCollectionService.create_collection(self.user, "  Cebu\t food\n trips  ")
        self.assertEqual(collection.PCOL_NAME, "Cebu food trips")
        for name in ("cebu food trips", "CEBU  FOOD\tTRIPS", " favorites "):
            with self.subTest(name=name), self.assertRaises(ValidationError):
                PocketCollectionService.create_collection(self.user, name)
        self.assertEqual(
            PocketCollectionService.create_collection(self.other, "Cebu food trips").PCOL_NAME,
            "Cebu food trips",
        )

    def test_name_constraints_apply_to_raw_database_writes(self):
        for name in (" cafes ", "CAFES", "", "   "):
            with self.subTest(name=name), self.assertRaises(IntegrityError):
                with transaction.atomic():
                    PocketCollection.objects.create(USER_ID=self.user, PCOL_NAME=name)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                PocketCollection.objects.create(
                    USER_ID=self.user, PCOL_NAME="Favorites", PCOL_IS_DEFAULT=True,
                )

    def test_default_cannot_be_renamed_or_deleted(self):
        with self.assertRaisesMessage(ValidationError, "Favorites cannot be renamed."):
            PocketCollectionService.rename_collection(self.user, self.favorites.pk, "Other")
        with self.assertRaisesMessage(ValidationError, "Favorites cannot be deleted."):
            PocketCollectionService.delete_collection(self.user, self.favorites.pk)
        self.assertTrue(PocketCollection.objects.filter(pk=self.favorites.pk).exists())

    def test_empty_custom_collection_can_be_renamed_and_deleted(self):
        renamed = PocketCollectionService.rename_collection(self.user, self.custom.pk, " New\tname ")
        self.assertEqual(renamed.PCOL_NAME, "New name")
        self.assertEqual(renamed.business_count, 0)
        PocketCollectionService.delete_collection(self.user, renamed.pk)
        self.assertFalse(PocketCollection.objects.filter(pk=renamed.pk).exists())

    def test_rename_conflict_leaves_original_name(self):
        with self.assertRaises(ValidationError):
            PocketCollectionService.rename_collection(self.user, self.custom.pk, "weekend")
        self.custom.refresh_from_db()
        self.assertEqual(self.custom.PCOL_NAME, "Cafes")

    def test_invalid_names_are_rejected_before_writes(self):
        for name in (None, "\t\n ", "x" * 101):
            with self.subTest(name=name), self.assertRaises(ValidationError):
                PocketCollectionService.create_collection(self.user, name)
        self.assertEqual(self.user.pocket_collections.count(), 3)

    def test_foreign_collections_are_not_exposed_or_modified(self):
        for operation in (
            lambda: PocketCollectionService.get_collection(self.user, self.foreign.pk),
            lambda: PocketCollectionService.rename_collection(self.user, self.foreign.pk, "Mine"),
            lambda: PocketCollectionService.delete_collection(self.user, self.foreign.pk),
        ):
            with self.assertRaises(NotFound):
                operation()

    def test_ineligible_or_inactive_owner_cannot_write(self):
        for field, value in (("USER_ROLE", User.UserRole.ADMIN), ("USER_STATUS", User.UserStatus.SUSPENDED)):
            original = getattr(self.user, field)
            User.objects.filter(pk=self.user.pk).update(**{field: value})
            with self.assertRaises(PermissionDenied):
                PocketCollectionService.create_collection(self.user, "Blocked")
            User.objects.filter(pk=self.user.pk).update(**{field: original})

    def test_collection_deletion_preserves_shared_saves_and_cleans_final_saves(self):
        PocketService.replace_memberships(self.user, self.business.pk, [self.custom.pk, self.second.pk])
        PocketService.replace_memberships(self.user, self.business_two.pk, [self.custom.pk])
        saved = BusinessPocket.objects.get(USER_ID=self.user, BUSN_ID=self.business)
        PocketCollectionService.delete_collection(self.user, self.custom.pk)
        self.assertTrue(BusinessPocket.objects.filter(pk=saved.pk).exists())
        self.assertFalse(BusinessPocket.objects.filter(USER_ID=self.user, BUSN_ID=self.business_two).exists())
        self.business.refresh_from_db()
        self.business_two.refresh_from_db()
        self.assertEqual(self.business.BUSN_POCKET_COUNT, 1)
        self.assertEqual(self.business_two.BUSN_POCKET_COUNT, 0)
        self.assertEqual(PocketService.get_memberships(self.user, self.business.pk)["pocket_ids"], [self.second.pk])

    def test_collection_deletion_rolls_back_if_aggregate_cleanup_fails(self):
        PocketService.replace_memberships(self.user, self.business.pk, [self.custom.pk])
        with patch.object(PocketService, "delete_empty_saves", side_effect=RuntimeError):
            with self.assertRaises(RuntimeError):
                PocketCollectionService.delete_collection(self.user, self.custom.pk)
        self.assertTrue(PocketCollection.objects.filter(pk=self.custom.pk).exists())
        self.assertEqual(PocketService.get_memberships(self.user, self.business.pk)["pocket_ids"], [self.custom.pk])


class PocketMembershipServiceTests(PocketFixtures, TestCase):
    """Protects atomic set replacement and the aggregate-save lifecycle."""

    def replace(self, ids):
        """Changes memberships on the primary fixture business."""
        return PocketService.replace_memberships(self.user, self.business.pk, ids)

    def test_multi_select_and_repeated_requests_create_only_one_save(self):
        state = self.replace([self.custom.pk, self.favorites.pk, self.custom.pk])
        for _ in range(2):
            self.assertEqual(self.replace(state["pocket_ids"]), state)
        self.business.refresh_from_db()
        self.assertEqual(BusinessPocket.objects.filter(USER_ID=self.user, BUSN_ID=self.business).count(), 1)
        self.assertEqual(PocketMembership.objects.count(), 2)
        self.assertEqual(self.business.BUSN_POCKET_COUNT, 1)
        self.assertEqual(PocketService.get_current_holder_count(self.business.pk, as_of=timezone.now()), 1)

    def test_move_and_add_preserve_aggregate_and_unchanged_membership_timestamps(self):
        self.replace([self.favorites.pk])
        saved = BusinessPocket.objects.get(USER_ID=self.user, BUSN_ID=self.business)
        original_time = timezone.now() - timedelta(days=10)
        BusinessPocket.objects.filter(pk=saved.pk).update(PCKT_CREATED_AT=original_time)
        membership = PocketMembership.objects.get(PCKT_ID=saved)
        with patch.object(PocketService, "_record_save_visibility_event") as record:
            with self.captureOnCommitCallbacks(execute=True):
                self.replace([self.favorites.pk, self.custom.pk])
                self.replace([self.favorites.pk, self.second.pk])
            record.assert_not_called()
        saved.refresh_from_db()
        membership.refresh_from_db()
        self.assertEqual(saved.PCKT_CREATED_AT, original_time)
        self.assertTrue(PocketMembership.objects.filter(pk=membership.pk).exists())
        self.assertEqual(PocketService.get_current_holder_count(self.business.pk, as_of=original_time), 1)

    def test_mixed_foreign_or_missing_ids_roll_back_entire_selection(self):
        self.replace([self.favorites.pk])
        for invalid in (self.foreign.pk, 999999):
            with self.assertRaises(ValidationError):
                self.replace([self.custom.pk, invalid])
            self.assertEqual(PocketService.get_memberships(self.user, self.business.pk)["pocket_ids"], [self.favorites.pk])

    def test_invalid_id_types_are_rejected_by_service(self):
        for ids in (None, [True], ["1"], [0], [-1]):
            with self.subTest(ids=ids), self.assertRaises(ValidationError):
                self.replace(ids)
        self.assertFalse(BusinessPocket.objects.filter(USER_ID=self.user).exists())

    def test_membership_failure_rolls_back_save_counter_and_commit_callback(self):
        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            with patch.object(PocketMembership.objects, "bulk_create", side_effect=RuntimeError):
                with self.assertRaises(RuntimeError):
                    self.replace([self.custom.pk])
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_POCKET_COUNT, 0)
        self.assertFalse(BusinessPocket.objects.filter(USER_ID=self.user).exists())
        self.assertEqual(callbacks, [])

    def test_failed_move_restores_the_previous_membership(self):
        self.replace([self.favorites.pk])
        membership = PocketMembership.objects.get(PCOL_ID=self.favorites)
        with patch.object(PocketMembership.objects, "bulk_create", side_effect=RuntimeError):
            with self.assertRaises(RuntimeError):
                self.replace([self.custom.pk])
        self.assertTrue(PocketMembership.objects.filter(pk=membership.pk).exists())
        self.assertEqual(PocketService.get_memberships(self.user, self.business.pk)["pocket_ids"], [self.favorites.pk])

    def test_membership_uniqueness_is_enforced_by_database(self):
        self.replace([self.custom.pk])
        saved = BusinessPocket.objects.get(USER_ID=self.user, BUSN_ID=self.business)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                PocketMembership.objects.create(PCOL_ID=self.custom, PCKT_ID=saved)

    def test_individual_then_final_removal_is_idempotent(self):
        self.replace([self.custom.pk, self.second.pk])
        state = PocketService.remove_membership(self.user, self.custom.pk, self.business.pk)
        self.assertEqual(state["pocket_ids"], [self.second.pk])
        self.assertTrue(state["is_pocketed"])
        PocketService.remove_membership(self.user, self.custom.pk, self.business.pk)
        self.replace([])
        self.replace([])
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_POCKET_COUNT, 0)
        self.assertFalse(PocketService.has_pocketed(self.user, self.business.pk))

    def test_unavailable_business_retains_memberships_but_only_allows_removals(self):
        self.replace([self.favorites.pk, self.custom.pk])
        Business.objects.filter(pk=self.business.pk).update(BUSN_STATUS=Business.BusinessStatus.SUSPENDED)
        self.assertEqual(PocketCollectionService.get_collection(self.user, self.favorites.pk).business_count, 0)
        self.assertFalse(PocketCollectionQueryService.list_businesses(self.user, self.favorites.pk).exists())
        with self.assertRaises(ValidationError):
            self.replace([self.favorites.pk, self.second.pk])
        self.assertEqual(len(PocketService.get_memberships(self.user, self.business.pk)["pocket_ids"]), 2)
        self.replace([self.favorites.pk])
        Business.objects.filter(pk=self.business.pk).update(BUSN_STATUS=Business.BusinessStatus.ACTIVE)
        self.assertEqual(PocketCollectionService.get_collection(self.user, self.favorites.pk).business_count, 1)
        Business.objects.filter(pk=self.business.pk).update(BUSN_STATUS=Business.BusinessStatus.SUSPENDED)
        PocketService.remove_pocket(self.user, self.business.pk)
        self.assertFalse(PocketService.has_pocketed(self.user, self.business.pk))

    def test_legacy_save_adds_favorites_without_replacing_custom_save(self):
        self.replace([self.custom.pk])
        original = BusinessPocket.objects.get(USER_ID=self.user, BUSN_ID=self.business)
        saved = PocketService.create_pocket(self.user, self.business.pk)
        self.assertEqual(saved.pk, original.pk)
        self.assertEqual(saved.PCKT_CREATED_AT, original.PCKT_CREATED_AT)
        self.assertEqual(PocketService.get_memberships(self.user, self.business.pk)["pocket_ids"], sorted([self.favorites.pk, self.custom.pk]))
        with self.assertRaises(ValidationError):
            PocketService.create_pocket(self.user, self.business.pk)
        PocketService.remove_pocket(self.user, self.business.pk)
        self.assertFalse(PocketMembership.objects.filter(PCKT_ID=original.pk).exists())
        with self.assertRaises(NotFound):
            PocketService.remove_pocket(self.user, self.business.pk)

    def test_new_and_legacy_saves_reject_unavailable_business(self):
        Business.objects.filter(pk=self.business.pk).update(BUSN_STATUS=Business.BusinessStatus.SUSPENDED)
        with self.assertRaises(ValidationError):
            self.replace([self.custom.pk])
        with self.assertRaises(ValidationError):
            PocketService.create_pocket(self.user, self.business.pk)
        self.assertFalse(PocketService.has_pocketed(self.user, self.business.pk))

    def test_missing_and_foreign_resources_do_not_write(self):
        with self.assertRaises(NotFound):
            PocketService.replace_memberships(self.user, 999999, [self.custom.pk])
        with self.assertRaises(NotFound):
            PocketService.remove_membership(self.user, self.foreign.pk, self.business.pk)
        self.assertFalse(BusinessPocket.objects.filter(USER_ID=self.user).exists())

    def test_physical_business_deletion_cascades_saves_and_memberships(self):
        self.replace([self.custom.pk, self.second.pk])
        self.business.delete()
        self.assertFalse(BusinessPocket.objects.filter(USER_ID=self.user).exists())
        self.assertFalse(PocketMembership.objects.exists())
        self.assertTrue(PocketCollection.objects.filter(pk=self.custom.pk).exists())

    def test_another_users_save_is_independent(self):
        self.replace([self.custom.pk])
        PocketService.replace_memberships(self.other, self.business.pk, [self.foreign.pk])
        self.replace([])
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_POCKET_COUNT, 1)
        self.assertTrue(PocketService.has_pocketed(self.other, self.business.pk))
