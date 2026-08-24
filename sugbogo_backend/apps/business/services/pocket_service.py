from django.db import IntegrityError, transaction
from rest_framework.exceptions import NotFound, ValidationError

from apps.business.models import Business, BusinessPocket
from apps.users.models import User


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
            return BusinessPocket.objects.create(
                BUSN_ID=business,
                USER_ID=user,
            )
        except IntegrityError:
            raise ValidationError(
                "You have already added this business to your pocket.",
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

        pocket.delete()

    @staticmethod
    def has_pocketed(
        user: User,
        business_id: int,
    ) -> bool:
        return BusinessPocket.objects.filter(
            BUSN_ID=business_id,
            USER_ID=user,
        ).exists()