from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.business.models import Business, PocketCollection
from apps.users.models import User


class PocketCollectionService:
    """Manages private collections while serializing writes for each owner."""

    @staticmethod
    def normalize_name(name):
        """Trims and collapses whitespace before enforcing the collection name limit."""
        if not isinstance(name, str):
            raise ValidationError({"name": "Enter a Pocket name."})
        normalized = " ".join(name.split())
        if not normalized:
            raise ValidationError({"name": "Pocket name is required."})
        if len(normalized) > 100:
            raise ValidationError({"name": "Pocket name cannot exceed 100 characters."})
        return normalized

    @staticmethod
    def provision_favorites(user, *, using=None):
        """Ensures an eligible account has its default collection on its own database."""
        if user.USER_ROLE not in (User.UserRole.EXPLORER, User.UserRole.MERCHANT):
            return None
        collection, _ = PocketCollection.objects.using(
            using or user._state.db,
        ).get_or_create(
            USER_ID=user,
            PCOL_IS_DEFAULT=True,
            defaults={"PCOL_NAME": "Favorites"},
        )
        return collection

    @staticmethod
    def lock_owner(user):
        """Locks the shared owner row before any collection or membership write."""
        try:
            owner = User.objects.select_for_update().get(USER_ID=user.pk)
        except User.DoesNotExist:
            raise NotFound("The user could not be found.") from None
        if (
            not owner.is_active
            or owner.USER_ROLE not in (User.UserRole.EXPLORER, User.UserRole.MERCHANT)
        ):
            raise PermissionDenied("You cannot manage Pockets with this account.")
        return owner

    @staticmethod
    def list_collections(user):
        """Returns owned collections with counts matching the available business list."""
        return PocketCollection.objects.filter(USER_ID=user).annotate(
            business_count=Count(
                "memberships",
                filter=Q(
                    memberships__PCKT_ID__BUSN_ID__BUSN_STATUS=(
                        Business.BusinessStatus.ACTIVE
                    ),
                ),
            ),
        ).order_by("-PCOL_IS_DEFAULT", "PCOL_CREATED_AT", "PCOL_ID")

    @staticmethod
    def get_collection(user, collection_id):
        """Retrieves only an owned collection without revealing another owner's data."""
        try:
            return PocketCollectionService.list_collections(user).get(
                PCOL_ID=collection_id,
            )
        except PocketCollection.DoesNotExist:
            raise NotFound("The Pocket could not be found.") from None

    @staticmethod
    @transaction.atomic
    def create_collection(user, name):
        """Creates an empty custom collection with an owner-unique normalized name."""
        owner = PocketCollectionService.lock_owner(user)
        name = PocketCollectionService.normalize_name(name)
        try:
            with transaction.atomic():
                collection = PocketCollection.objects.create(
                    USER_ID=owner,
                    PCOL_NAME=name,
                )
        except IntegrityError:
            raise ValidationError(
                {"name": "You already have a Pocket with this name."},
            ) from None
        return PocketCollectionService.get_collection(owner, collection.pk)

    @staticmethod
    @transaction.atomic
    def rename_collection(user, collection_id, name):
        """Renames an owned custom collection while protecting Favorites."""
        owner = PocketCollectionService.lock_owner(user)
        collection = PocketCollectionService.get_collection(owner, collection_id)
        if collection.PCOL_IS_DEFAULT:
            raise ValidationError("Favorites cannot be renamed.")
        collection.PCOL_NAME = PocketCollectionService.normalize_name(name)
        try:
            with transaction.atomic():
                collection.save(update_fields=["PCOL_NAME", "PCOL_UPDATED_AT"])
        except IntegrityError:
            raise ValidationError(
                {"name": "You already have a Pocket with this name."},
            ) from None
        return collection

    @staticmethod
    @transaction.atomic
    def delete_collection(user, collection_id):
        """Deletes a custom collection and removes only saves left without memberships."""
        from apps.business.services.pocket_service import PocketService

        owner = PocketCollectionService.lock_owner(user)
        collection = PocketCollectionService.get_collection(owner, collection_id)
        if collection.PCOL_IS_DEFAULT:
            raise ValidationError("Favorites cannot be deleted.")

        # Use the same user-then-business lock order as individual membership writes.
        business_ids = list(
            Business.objects.select_for_update()
            .filter(pocket_entries__collection_memberships__PCOL_ID=collection)
            .order_by("BUSN_ID")
            .values_list("BUSN_ID", flat=True)
        )
        collection.delete()
        PocketService.delete_empty_saves(owner, business_ids)
