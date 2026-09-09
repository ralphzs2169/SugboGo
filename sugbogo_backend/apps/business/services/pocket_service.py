import logging

from django.db import IntegrityError, transaction
from django.db.models import F
from rest_framework.exceptions import NotFound, ValidationError

from apps.business.models import Business, BusinessPocket
from apps.business.services.visibility_event_service import (
    VisibilityEventService,
    VisibilityTrackingUnavailable,
)
from apps.users.models import User


logger = logging.getLogger(__name__)


class PocketService:
    """Handles creating, removing, and checking user business pockets."""

    @staticmethod
    @transaction.atomic
    def create_pocket(
        user: User,
        business_id: int,
    ) -> BusinessPocket:
        try:
            business = Business.objects.get(
                BUSN_ID=business_id,
            )
        except Business.DoesNotExist:
            raise NotFound(
                "The business could not be found.",
            )

        try:
            pocket = BusinessPocket.objects.create(
                BUSN_ID=business,
                USER_ID=user,
            )
        except IntegrityError:
            raise ValidationError(
                "You have already added this business to your pocket.",
            )

        Business.objects.filter(
            BUSN_ID=business.BUSN_ID,
        ).update(
            BUSN_POCKET_COUNT=F("BUSN_POCKET_COUNT") + 1,
        )

        transaction.on_commit(
            lambda: PocketService._record_save_visibility_event(
                explorer_id=user.USER_ID,
                business_id=business.BUSN_ID,
            ),
        )

        return pocket

    @staticmethod
    def _record_save_visibility_event(
        explorer_id: int,
        business_id: int,
    ) -> None:
        try:
            VisibilityEventService.record_save(
                explorer_id=explorer_id,
                business_id=business_id,
            )
        except VisibilityTrackingUnavailable:
            return
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
        try:
            pocket = BusinessPocket.objects.get(
                BUSN_ID=business_id,
                USER_ID=user,
            )
        except BusinessPocket.DoesNotExist:
            raise NotFound(
                "This business is not in your pocket.",
            )

        business_id = pocket.BUSN_ID_id

        pocket.delete()

        Business.objects.filter(
            BUSN_ID=business_id,
        ).update(
            BUSN_POCKET_COUNT=F("BUSN_POCKET_COUNT") - 1,
        )

    @staticmethod
    def has_pocketed(
        user: User,
        business_id: int,
    ) -> bool:
        return BusinessPocket.objects.filter(
            BUSN_ID=business_id,
            USER_ID=user,
        ).exists()
