from django.db import transaction
from django.db.models import Case, IntegerField, Prefetch, Value, When
from rest_framework.exceptions import NotFound, PermissionDenied

from apps.business.models import (
    Business,
    BusinessLandmark,
    BusinessOperatingHours,
    BusinessPhoto,
    BusinessSpecialtyTag,
)
from apps.merchant_application.models import MerchantApplicationDocument
from apps.shared.services.cloudinary_service import CloudinaryService


class BusinessProfileService:
    """Service class for merchant-facing business profile management."""

    @staticmethod
    def get_business_for_merchant(user):
        """Retrieve the business owned by the authenticated merchant."""

        day_order = Case(
            *[
                When(BOHR_DAY=day, then=Value(index))
                for index, day in enumerate(BusinessOperatingHours.Day.values)
            ],
            output_field=IntegerField(),
        )

        try:
            return (
                Business.objects
                .select_related(
                    "USER_ID",
                    "CTGRY_ID",
                    "CTGRY_ID__CLUS_ID",
                    "LOCT_ID",
                    "merchant_application",
                    "merchant_application__identity",
                )
                .prefetch_related(
                    Prefetch(
                        "specialty_tag_links",
                        queryset=(
                            BusinessSpecialtyTag.objects
                            .filter(BST_IS_ACTIVE=True)
                            .select_related("TAG_ID")
                            .order_by("TAG_ID__TAG_NAME")
                        ),
                        to_attr="active_specialty_tag_links",
                    ),
                    Prefetch(
                        "LOCT_ID__landmarks",
                        queryset=BusinessLandmark.objects.order_by("BLMK_ID"),
                    ),
                    Prefetch(
                        "operating_hours",
                        queryset=(
                            BusinessOperatingHours.objects
                            .annotate(day_order=day_order)
                            .order_by("day_order")
                        ),
                    ),
                    Prefetch(
                        "photos",
                        queryset=BusinessPhoto.objects.order_by("BPHO_ID"),
                    ),
                    Prefetch(
                        "merchant_application__documents",
                        queryset=MerchantApplicationDocument.objects.order_by(
                            "MDOC_ID",
                        ),
                    ),
                )
                .get(
                    USER_ID=user,
                )
            )
        except Business.DoesNotExist:
            raise NotFound(
                "Your business could not be found.",
            )

    @staticmethod
    def update_information(business, validated_data):
        """Persist only validated operational fields on the live business."""

        if business.BUSN_STATUS != Business.BusinessStatus.ACTIVE:
            raise PermissionDenied(
                "Business information cannot be edited while your business is suspended.",
            )

        if not validated_data:
            return business

        for field, value in validated_data.items():
            setattr(business, field, value)

        business.save(
            update_fields=[
                *validated_data.keys(),
                "BUSN_UPDATED_AT",
            ],
        )

        return business

    @staticmethod
    @transaction.atomic
    def update_cover_photo(business, photo):
        """
        Replace the business cover photo with a newly uploaded image.

        The business row is locked for the duration of the transaction to
        prevent concurrent cover photo updates from overwriting each other.
        The previous Cloudinary asset is removed only after the database
        transaction successfully commits.
        """

        business = (
            Business.objects
            .select_for_update()
            .get(
                pk=business.pk,
            )
        )

        old_public_id = business.BUSN_COVER_PHOTO_PUBLIC_ID

        try:
            result = CloudinaryService.upload_image(
                file=photo,
                folder="business_profile_covers",
            )

            business.BUSN_COVER_PHOTO_URL = result["secure_url"]
            business.BUSN_COVER_PHOTO_PUBLIC_ID = result["public_id"]

            business.save(
                update_fields=[
                    "BUSN_COVER_PHOTO_URL",
                    "BUSN_COVER_PHOTO_PUBLIC_ID",
                    "BUSN_UPDATED_AT",
                ],
            )

        except Exception:
            if "result" in locals() and result.get("public_id"):
                CloudinaryService.delete_image(
                    result["public_id"],
                )

            raise

        if old_public_id:
            transaction.on_commit(
                lambda: CloudinaryService.delete_image(
                    old_public_id,
                )
            )

        return business
