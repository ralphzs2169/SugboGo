from django.db import IntegrityError, transaction
from rest_framework.exceptions import NotFound, ValidationError

from apps.business.models import Business, BusinessVouch, SpecialtyTag
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
            business = Business.objects.get(
                BUSN_ID=business_id,
            )
        except Business.DoesNotExist:
            raise NotFound(
                "The business could not be found.",
            )

        if business.USER_ID_id == user.USER_ID:
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

        if not business.SPECIALTY_TAGS.filter(
            TAG_ID=tag.TAG_ID,
        ).exists():
            raise ValidationError(
                "This specialty is not associated with the business.",
            )

        try:
            return BusinessVouch.objects.create(
                BUSN_ID=business,
                USER_ID=user,
                TAG_ID=tag,
                VOUCH_DEVICE_ID=device_id,
            )
        except IntegrityError:
            raise ValidationError(
                "You have already vouched for this specialty.",
            )

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