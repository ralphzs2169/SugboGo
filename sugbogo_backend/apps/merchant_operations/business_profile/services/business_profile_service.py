from django.db import transaction
from django.db.models import Case, IntegerField, Prefetch, Value, When
from rest_framework.exceptions import APIException, NotFound, PermissionDenied

from apps.business.models import (
    Business,
    BusinessLandmark,
    BusinessOperatingHours,
    BusinessPhoto,
    BusinessSpecialtyTag,
)
from apps.business.services.display_cover_photo import display_cover_photo_expression
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationDocument,
)
from apps.shared.services.cloudinary_service import CloudinaryService


class BusinessOperatingHoursEditConflict(APIException):
    """Reject a full-week replacement based on an outdated schedule."""

    status_code = 409
    default_detail = (
        "Your operating hours changed while you were editing. "
        "Review the latest hours before saving again. Your draft has been kept."
    )
    default_code = "BUSINESS_OPERATING_HOURS_EDIT_CONFLICT"


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
                .annotate(
                    display_cover_photo_url=display_cover_photo_expression(),
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
    def get_verification_document_for_merchant(user, document_id):
        """Return a document only from the caller's approved business application."""
        try:
            return MerchantApplicationDocument.objects.select_related(
                "MAPP_ID",
            ).get(
                MDOC_ID=document_id,
                MAPP_ID__BUSN_ID__USER_ID=user,
                MAPP_ID__MAPP_STATUS=(
                    MerchantApplication.ApplicationStatus.APPROVED
                ),
            )
        except MerchantApplicationDocument.DoesNotExist:
            raise NotFound("The requested document could not be found.")

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
    def _operating_day_values(
        is_open,
        is_24_hours,
        open_time,
        close_time,
    ):
        """Compare only applicable schedule values using the shared day semantics."""
        if not is_open:
            return False, False, None, None
        if is_24_hours:
            return True, True, None, None
        return True, False, open_time, close_time

    @staticmethod
    @transaction.atomic
    def update_operating_hours(
        user,
        hours,
        expected_hours,
    ):
        """Replace the week only when its locked current values match the baseline."""

        try:
            business = Business.objects.select_for_update().get(USER_ID=user)
        except Business.DoesNotExist:
            raise NotFound("Your business could not be found.")

        if business.BUSN_STATUS != Business.BusinessStatus.ACTIVE:
            raise PermissionDenied(
                "Operating hours cannot be edited while your business is suspended."
            )

        existing_hours = {
            item.BOHR_DAY: item
            for item in BusinessOperatingHours.objects.select_for_update().filter(
                BUSN_ID=business,
            )
        }

        current_values = {
            day: BusinessProfileService._operating_day_values(
                item.BOHR_IS_OPEN,
                item.BOHR_IS_24_HOURS,
                item.BOHR_OPEN_TIME,
                item.BOHR_CLOSE_TIME,
            )
            for day, item in existing_hours.items()
        }
        expected_values = {
            item["day"]: BusinessProfileService._operating_day_values(
                item["is_open"],
                item["is_24_hours"],
                item.get("open_time"),
                item.get("close_time"),
            )
            for item in expected_hours
        }
        if current_values != expected_values:
            raise BusinessOperatingHoursEditConflict()

        for item in hours:
            day = item["day"]
            schedule = existing_hours.get(day)

            if schedule is None:
                schedule = BusinessOperatingHours(
                    BUSN_ID=business,
                    BOHR_DAY=day,
                )

            schedule.BOHR_IS_OPEN = item["is_open"]
            schedule.BOHR_IS_24_HOURS = item["is_24_hours"]
            schedule.BOHR_OPEN_TIME = item.get("open_time")
            schedule.BOHR_CLOSE_TIME = item.get("close_time")
            schedule.save()

        saved_hours = list(
            BusinessOperatingHours.objects.filter(BUSN_ID=business)
        )

        return sorted(
            saved_hours,
            key=lambda schedule: BusinessOperatingHours.Day.values.index(
                schedule.BOHR_DAY
            ),
        )

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
