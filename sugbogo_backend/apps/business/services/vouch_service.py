from django.db import IntegrityError, models, transaction
from rest_framework.exceptions import NotFound, ValidationError

from apps.business.models import (
    Business,
    BusinessSpecialtyTag,
    BusinessVouch,
    SpecialtyTag,
)
from apps.users.models import User


class VouchService:
    """Handles creating, removing, and checking user vouches."""

    @staticmethod
    @transaction.atomic
    def create_vouch(
        user: User,
        business_id: int,
        tag_id: int,
        device_id: str | None = None,
    ) -> BusinessVouch:
        try:
            locked_user = (
                User.objects
                .select_for_update()
                .get(
                    USER_ID=user.USER_ID,
                )
            )
        except User.DoesNotExist:
            raise NotFound(
                "The user could not be found.",
            )

        try:
            business = Business.objects.get(
                BUSN_ID=business_id,
            )
        except Business.DoesNotExist:
            raise NotFound(
                "The business could not be found.",
            )

        if business.USER_ID_id == locked_user.USER_ID:
            raise ValidationError(
                "You cannot vouch for your own business.",
            )

        try:
            tag = SpecialtyTag.objects.get(
                TAG_ID=tag_id,
            )
        except SpecialtyTag.DoesNotExist:
            raise NotFound(
                "The specialty tag could not be found.",
            )

        try:
            business_tag = (
                BusinessSpecialtyTag.objects
                .select_for_update()
                .get(
                    BUSN_ID=business_id,
                    TAG_ID=tag_id,
                    BST_IS_ACTIVE=True,
                )
            )
        except BusinessSpecialtyTag.DoesNotExist:
            raise ValidationError(
                "This specialty is not associated with the business.",
            )

        try:
            vouch = BusinessVouch.objects.create(
                BUSN_ID=business,
                USER_ID=locked_user,
                TAG_ID=tag,
                VOUCH_DEVICE_ID=device_id,
                VOUCH_REPUTATION_SNAPSHOT=(
                    locked_user.USER_REPUTATION
                ),
                VOUCH_EVIDENCE_IS_VALID=True,
            )
        except IntegrityError:
            raise ValidationError(
                "You have already vouched for this specialty.",
            )

        Business.objects.filter(
            BUSN_ID=business_id,
        ).update(
            BUSN_VOUCH_COUNT=models.F(
                "BUSN_VOUCH_COUNT",
            ) + 1,
        )

        BusinessSpecialtyTag.objects.filter(
            BST_ID=business_tag.BST_ID,
        ).update(
            BST_VOUCH_COUNT=models.F(
                "BST_VOUCH_COUNT",
            ) + 1,
        )

        return vouch

    @staticmethod
    @transaction.atomic
    def remove_vouch(
        user: User,
        business_id: int,
        tag_id: int,
    ) -> None:
        try:
            vouch = BusinessVouch.objects.get(
                BUSN_ID=business_id,
                USER_ID=user,
                TAG_ID=tag_id,
            )
        except BusinessVouch.DoesNotExist:
            raise NotFound(
                "Your vouch could not be found.",
            )

        vouch.delete()

        Business.objects.filter(
            BUSN_ID=business_id,
        ).update(
            BUSN_VOUCH_COUNT=models.F(
                "BUSN_VOUCH_COUNT",
            ) - 1,
        )

        BusinessSpecialtyTag.objects.filter(
            BUSN_ID=business_id,
            TAG_ID=tag_id,
        ).update(
            BST_VOUCH_COUNT=models.F(
                "BST_VOUCH_COUNT",
            ) - 1,
        )

    @staticmethod
    def has_vouched(
        user: User,
        business_id: int,
        tag_id: int,
    ) -> bool:
        return BusinessVouch.objects.filter(
            BUSN_ID=business_id,
            USER_ID=user,
            TAG_ID=tag_id,
        ).exists()
