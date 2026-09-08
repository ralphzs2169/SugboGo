from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound

from apps.business.models import BusinessSpecialtyTag


class BusinessSpecialtyService:
    """Handles lifecycle changes for business specialty assignments."""

    @staticmethod
    def _get_business_specialty(
        business_id: int,
        tag_id: int,
    ) -> BusinessSpecialtyTag:
        try:
            return (
                BusinessSpecialtyTag.objects
                .select_for_update()
                .get(
                    BUSN_ID=business_id,
                    TAG_ID=tag_id,
                )
            )
        except BusinessSpecialtyTag.DoesNotExist:
            raise NotFound(
                "The business specialty could not be found.",
            )

    @staticmethod
    @transaction.atomic
    def deactivate_specialty(
        business_id: int,
        tag_id: int,
    ) -> BusinessSpecialtyTag:
        business_specialty = BusinessSpecialtyService._get_business_specialty(
            business_id=business_id,
            tag_id=tag_id,
        )

        if not business_specialty.BST_IS_ACTIVE:
            return business_specialty

        business_specialty.BST_IS_ACTIVE = False
        business_specialty.BST_DEACTIVATED_AT = timezone.now()

        business_specialty.save(
            update_fields=[
                "BST_IS_ACTIVE",
                "BST_DEACTIVATED_AT",
                "BST_UPDATED_AT",
            ],
        )

        return business_specialty

    @staticmethod
    @transaction.atomic
    def reactivate_specialty(
        business_id: int,
        tag_id: int,
    ) -> BusinessSpecialtyTag:
        business_specialty = BusinessSpecialtyService._get_business_specialty(
            business_id=business_id,
            tag_id=tag_id,
        )

        if business_specialty.BST_IS_ACTIVE:
            return business_specialty

        business_specialty.BST_IS_ACTIVE = True
        business_specialty.BST_ACTIVATED_AT = timezone.now()
        business_specialty.BST_DEACTIVATED_AT = None

        business_specialty.save(
            update_fields=[
                "BST_IS_ACTIVE",
                "BST_ACTIVATED_AT",
                "BST_DEACTIVATED_AT",
                "BST_UPDATED_AT",
            ],
        )

        return business_specialty
