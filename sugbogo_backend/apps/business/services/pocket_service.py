import logging

from django.db import OperationalError, transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from apps.business.models import (
    Business,
    BusinessPocket,
    PocketCollection,
    PocketMembership,
)
from apps.business.services.pocket_collection_service import PocketCollectionService
from apps.business.services.visibility_event_service import (
    VisibilityEventService,
    VisibilityTrackingUnavailable,
)
from apps.users.models import User

logger = logging.getLogger(__name__)


class PocketService:
    """Coordinates collection memberships with the unique save and analytics lifecycle."""

    @staticmethod
    def get_current_holder_count(business_id, *, as_of):
        """Count current distinct holders without treating retained rows as save history."""
        return BusinessPocket.objects.filter(
            BUSN_ID=business_id, PCKT_CREATED_AT__lte=as_of,
        ).values("USER_ID").distinct().count()

    @staticmethod
    @transaction.atomic
    def create_pocket(
        user: User,
        business_id: int,
    ) -> BusinessPocket:
        """Adds Favorites membership while preserving the legacy duplicate-save error."""
        owner = PocketCollectionService.lock_owner(user)
        business = PocketService._get_business(business_id, lock=True)
        favorites = PocketCollectionService.provision_favorites(owner)
        current_ids = PocketService._membership_ids(owner, business_id)
        if favorites.pk in current_ids:
            raise ValidationError(
                "You have already added this business to your pocket.",
            )
        PocketService._replace_locked(
            owner,
            business,
            sorted([*current_ids, favorites.pk]),
        )
        return BusinessPocket.objects.get(USER_ID=owner, BUSN_ID=business)

    @staticmethod
    def _record_save_visibility_event(
        explorer_id: int,
        business_id: int,
        occurred_at=None,
    ) -> None:
        """Record a committed save or enqueue bounded recovery without undoing the save."""
        if occurred_at is None:
            occurred_at = timezone.now()
        try:
            VisibilityEventService.record_save(
                explorer_id=explorer_id,
                business_id=business_id,
                occurred_at=occurred_at,
            )
        except (VisibilityTrackingUnavailable, OperationalError):
            from apps.business.tasks import (
                TRANSIENT_RETRY_BASE_SECONDS,
                retry_save_visibility_event,
            )

            try:
                retry_save_visibility_event.apply_async(
                    kwargs={
                        "explorer_id": explorer_id,
                        "business_id": business_id,
                        "occurred_at": occurred_at.isoformat(),
                    },
                    countdown=TRANSIENT_RETRY_BASE_SECONDS,
                )
            except Exception:
                logger.exception("Failed to enqueue committed-save visibility recovery.")
        except Exception:
            logger.exception(
                "Failed to record the derived Pocket SAVE visibility event.",
            )

    @staticmethod
    @transaction.atomic
    def remove_pocket(
        user: User,
        business_id: int,
    ) -> None:
        """Removes every membership while preserving the legacy missing-save error."""
        owner = PocketCollectionService.lock_owner(user)
        if not BusinessPocket.objects.filter(
            USER_ID=owner,
            BUSN_ID=business_id,
        ).exists():
            raise NotFound("This business is not in your pocket.")
        business = PocketService._get_business(business_id, lock=True)
        PocketService._replace_locked(owner, business, [])

    @staticmethod
    def has_pocketed(
        user: User,
        business_id: int,
    ) -> bool:
        """Checks the aggregate save used by existing discovery and recommendation queries."""
        return BusinessPocket.objects.filter(
            BUSN_ID=business_id,
            USER_ID=user,
        ).exists()

    @staticmethod
    def _get_business(business_id, *, lock=False):
        """Retrieves a business including unavailable ones for membership removal."""
        queryset = Business.objects.all()
        if lock:
            queryset = queryset.select_for_update()
        try:
            return queryset.get(BUSN_ID=business_id)
        except Business.DoesNotExist:
            raise NotFound("The business could not be found.") from None

    @staticmethod
    def _membership_ids(user, business_id):
        """Returns the complete owned membership set independently of list pagination."""
        return list(
            PocketMembership.objects.filter(
                PCOL_ID__USER_ID=user,
                PCKT_ID__USER_ID=user,
                PCKT_ID__BUSN_ID=business_id,
            )
            .order_by("PCOL_ID_id")
            .values_list("PCOL_ID", flat=True)
        )

    @staticmethod
    def _membership_state(business_id, pocket_ids):
        """Builds the authoritative membership response shared by all new writes."""
        return {
            "business_id": business_id,
            "pocket_ids": pocket_ids,
            "is_pocketed": bool(pocket_ids),
        }

    @staticmethod
    def get_memberships(user, business_id):
        """Reads every selected Pocket ID without requiring an active business."""
        PocketService._get_business(business_id)
        return PocketService._membership_state(
            business_id,
            PocketService._membership_ids(user, business_id),
        )

    @staticmethod
    def _validate_pocket_ids(user, pocket_ids):
        """Validates the complete desired set before changing any persisted relationship."""
        if not isinstance(pocket_ids, (list, tuple)) or any(
            type(value) is not int or value <= 0 for value in pocket_ids
        ):
            raise ValidationError({"pocket_ids": "Use a list of positive integer IDs."})
        normalized = sorted(set(pocket_ids))
        owned_count = PocketCollection.objects.filter(
            USER_ID=user,
            PCOL_ID__in=normalized,
        ).count()
        if owned_count != len(normalized):
            raise ValidationError(
                {"pocket_ids": "One or more Pockets could not be found."},
            )
        return normalized

    @staticmethod
    @transaction.atomic
    def replace_memberships(user, business_id, pocket_ids):
        """Atomically and idempotently replaces one business's complete membership set."""
        owner = PocketCollectionService.lock_owner(user)
        selected_ids = PocketService._validate_pocket_ids(owner, pocket_ids)
        business = PocketService._get_business(business_id, lock=True)
        return PocketService._replace_locked(owner, business, selected_ids)

    @staticmethod
    @transaction.atomic
    def remove_membership(user, collection_id, business_id):
        """Removes one owned membership idempotently without touching other collections."""
        owner = PocketCollectionService.lock_owner(user)
        PocketCollectionService.get_collection(owner, collection_id)
        business = PocketService._get_business(business_id, lock=True)
        remaining_ids = [
            value for value in PocketService._membership_ids(owner, business_id)
            if value != collection_id
        ]
        return PocketService._replace_locked(owner, business, remaining_ids)

    @staticmethod
    def _replace_locked(owner, business, selected_ids):
        """Applies a validated set while the owner and business rows remain locked."""
        current_ids = set(PocketService._membership_ids(owner, business.pk))
        desired_ids = set(selected_ids)
        added_ids = desired_ids - current_ids
        removed_ids = current_ids - desired_ids
        if added_ids and business.BUSN_STATUS != Business.BusinessStatus.ACTIVE:
            raise ValidationError("You cannot save an inactive business.")

        saved = BusinessPocket.objects.filter(USER_ID=owner, BUSN_ID=business).first()
        if desired_ids and saved is None:
            saved = BusinessPocket.objects.create(USER_ID=owner, BUSN_ID=business)
            Business.objects.filter(pk=business.pk).update(
                BUSN_POCKET_COUNT=F("BUSN_POCKET_COUNT") + 1,
            )
            transaction.on_commit(
                lambda: PocketService._record_save_visibility_event(
                    explorer_id=owner.pk,
                    business_id=business.pk,
                    occurred_at=saved.PCKT_CREATED_AT,
                ),
            )

        if saved is not None:
            PocketMembership.objects.filter(
                PCKT_ID=saved,
                PCOL_ID__in=removed_ids,
            ).delete()
            PocketMembership.objects.bulk_create([
                PocketMembership(PCOL_ID_id=collection_id, PCKT_ID=saved)
                for collection_id in sorted(added_ids)
            ])
            if not desired_ids:
                PocketService.delete_empty_saves(owner, [business.pk])

        if added_ids or removed_ids:
            PocketCollection.objects.filter(pk__in=added_ids | removed_ids).update(
                PCOL_UPDATED_AT=timezone.now(),
            )
        return PocketService._membership_state(business.pk, sorted(desired_ids))

    @staticmethod
    def delete_empty_saves(owner, business_ids):
        """Deletes orphaned saves once under existing owner and ordered business locks."""
        orphaned = BusinessPocket.objects.filter(
            USER_ID=owner,
            BUSN_ID__in=business_ids,
            collection_memberships__isnull=True,
        )
        removed_business_ids = list(orphaned.values_list("BUSN_ID", flat=True))
        if not removed_business_ids:
            return
        orphaned.delete()
        Business.objects.filter(pk__in=removed_business_ids).update(
            BUSN_POCKET_COUNT=F("BUSN_POCKET_COUNT") - 1,
        )
