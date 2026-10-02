"""Persist live photos without changing application evidence."""

from typing import ClassVar

from django.db import transaction
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.business.models import Business, BusinessPhoto
from apps.merchant_application.models import MerchantApplicationPhotos
from apps.shared.services.cloudinary_service import CloudinaryService


class BusinessPhotoService:
    PHOTO_LIMITS: ClassVar[dict[BusinessPhoto.PhotoCategory, int]] = {
        BusinessPhoto.PhotoCategory.STOREFRONT: 3,
        BusinessPhoto.PhotoCategory.INTERIOR: 5,
        BusinessPhoto.PhotoCategory.PRODUCTS: 5,
        BusinessPhoto.PhotoCategory.ADDITIONAL: 5,
    }

    @staticmethod
    def _delete_unreferenced_asset(public_id):
        """Never destroy evidence or an asset still used by another live row."""

        if MerchantApplicationPhotos.objects.filter(
            MPHT_PHOTO_PUBLIC_ID=public_id,
        ).exists():
            return

        if BusinessPhoto.objects.filter(
            BPHO_PHOTO_PUBLIC_ID=public_id,
        ).exists():
            return

        CloudinaryService.delete_image(public_id)

    @staticmethod
    @transaction.atomic
    def save_photos(user, validated_data):
        try:
            business = Business.objects.select_for_update().get(USER_ID=user)
        except Business.DoesNotExist:
            raise NotFound("Your business could not be found.")

        if business.BUSN_STATUS != Business.BusinessStatus.ACTIVE:
            raise PermissionDenied(
                "Photos cannot be edited while your business is suspended."
            )

        deleted_ids = validated_data.get("deleted_photo_ids", [])
        existing = list(
            BusinessPhoto.objects.filter(BUSN_ID=business).order_by("BPHO_ID")
        )
        existing_by_id = {
            photo.BPHO_ID: photo
            for photo in existing
        }

        unknown_ids = set(deleted_ids) - set(existing_by_id)
        if unknown_ids:
            raise ValidationError({
                "deleted_photo_ids": [
                    "One or more photos do not belong to your business."
                ],
            })

        deleted_id_set = set(deleted_ids)
        final_counts = {}

        for category, maximum in BusinessPhotoService.PHOTO_LIMITS.items():
            retained_count = sum(
                1
                for photo in existing
                if photo.BPHO_CATEGORY == category
                and photo.BPHO_ID not in deleted_id_set
            )
            final_count = retained_count + len(validated_data.get(category, []))
            final_counts[category] = final_count

            if final_count > maximum:
                raise ValidationError({
                    category: [f"You can only have up to {maximum} {category} photos."],
                })

        if final_counts[BusinessPhoto.PhotoCategory.STOREFRONT] < 1:
            raise ValidationError({
                "storefront": ["At least one storefront photo is required."],
            })

        uploaded_public_ids = []

        try:
            for category in BusinessPhotoService.PHOTO_LIMITS:
                for photo_file in validated_data.get(category, []):
                    result = CloudinaryService.upload_image(
                        file=photo_file,
                        folder="business_profile_photos",
                    )
                    public_id = result["public_id"]
                    uploaded_public_ids.append(public_id)

                    BusinessPhoto.objects.create(
                        BUSN_ID=business,
                        BPHO_CATEGORY=category,
                        BPHO_PHOTO_URL=result["secure_url"],
                        BPHO_PHOTO_PUBLIC_ID=public_id,
                        BPHO_FILE_NAME=getattr(photo_file, "name", None),
                    )

            removed_public_ids = {
                existing_by_id[photo_id].BPHO_PHOTO_PUBLIC_ID
                for photo_id in deleted_ids
            }

            if deleted_ids:
                BusinessPhoto.objects.filter(
                    BUSN_ID=business,
                    BPHO_ID__in=deleted_ids,
                ).delete()

            for public_id in removed_public_ids:
                transaction.on_commit(
                    lambda public_id=public_id: (
                        BusinessPhotoService._delete_unreferenced_asset(public_id)
                    )
                )

            saved_photos = list(
                BusinessPhoto.objects.filter(BUSN_ID=business).order_by("BPHO_ID")
            )
        except Exception:
            for public_id in uploaded_public_ids:
                CloudinaryService.delete_image(public_id)

            raise

        return saved_photos
