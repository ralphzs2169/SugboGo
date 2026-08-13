from typing import ClassVar

from django.db import transaction
from django.shortcuts import get_object_or_404

from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationPhotos,
)
from apps.merchant_application.services.application_service import ApplicationService
from apps.shared.services.cloudinary_service import CloudinaryService


class PhotoService:
    STEP = 4

    PHOTO_LIMITS: ClassVar[
        dict[MerchantApplicationPhotos.PhotoCategory, int]
    ] = {
        MerchantApplicationPhotos.PhotoCategory.STOREFRONT: 3,
        MerchantApplicationPhotos.PhotoCategory.INTERIOR: 5,
        MerchantApplicationPhotos.PhotoCategory.PRODUCTS: 5,
        MerchantApplicationPhotos.PhotoCategory.ADDITIONAL: 5,
    }

    @staticmethod
    @transaction.atomic
    def save_photos(application, validated_data):
        """
        Saves the complete Step 4 photo changes.

        Only newly added files are uploaded and created.
        Only explicitly deleted photo IDs are removed.
        Existing unchanged photos remain untouched.

        Final photo limits are validated against the complete resulting
        state before any database or Cloudinary changes are made.
        """
        # Lock the application row to prevent concurrent photo saves.
        application = (
            MerchantApplication.objects
            .select_for_update()
            .get(MAPP_ID=application.MAPP_ID)
        )

        ApplicationService.validate_step_access(
            application,
            PhotoService.STEP,
        )

        deleted_photo_ids = validated_data.pop("deleted_photo_ids", [])

        # Organize the newly added photos by category.
        new_photos = {
            MerchantApplicationPhotos.PhotoCategory.STOREFRONT: validated_data.pop(
                "storefront", []
            ),
            MerchantApplicationPhotos.PhotoCategory.INTERIOR: validated_data.pop(
                "interior", []
            ),
            MerchantApplicationPhotos.PhotoCategory.PRODUCTS: validated_data.pop(
                "products", []
            ),
            MerchantApplicationPhotos.PhotoCategory.ADDITIONAL: validated_data.pop(
                "additional", []
            ),
        }

        # Find the photos requested for deletion.
        photos_to_delete = MerchantApplicationPhotos.objects.filter(
            MAPP_ID=application,
            MPHT_ID__in=deleted_photo_ids,
        )

        if photos_to_delete.count() != len(set(deleted_photo_ids)):
            raise ValueError(
                "One or more selected photos do not belong to this application."
            )

        # Validate the final number of photos in each category.
        PhotoService._validate_final_photo_counts(
            application=application,
            photos_to_delete=photos_to_delete,
            new_photos=new_photos,
        )

        # Delete the requested database records and schedule Cloudinary cleanup.
        deleted_public_ids = [
            photo.MPHT_PHOTO_PUBLIC_ID
            for photo in photos_to_delete
            if photo.MPHT_PHOTO_PUBLIC_ID
        ]

        photos_to_delete.delete()

        for public_id in deleted_public_ids:
            transaction.on_commit(
                lambda public_id=public_id: CloudinaryService.delete_image(
                    public_id
                )
            )

        # Upload only newly added photos.
        created_photos = []

        try:
            for category, files in new_photos.items():
                for file in files:
                    result = CloudinaryService.upload_image(
                        file=file,
                        folder="merchant_application_photos",
                    )

                    photo = MerchantApplicationPhotos.objects.create(
                        MAPP_ID=application,
                        MPHT_CATEGORY=category,
                        MPHT_PHOTO_URL=result["secure_url"],
                        MPHT_PHOTO_PUBLIC_ID=result["public_id"],
                        MPHT_FILE_NAME=getattr(file, "name", None),
                    )

                    created_photos.append(photo)

        except Exception:
            # Clean up Cloudinary uploads if the database operation fails.
            for photo in created_photos:
                if photo.MPHT_PHOTO_PUBLIC_ID:
                    CloudinaryService.delete_image(
                        photo.MPHT_PHOTO_PUBLIC_ID
                    )

            raise

        ApplicationService.mark_section_updated(
            application,
            "MAPP_PHOTOS_UPDATED_AT",
        )
        
        # Mark Step 4 complete after the entire save succeeds.
        ApplicationService.mark_step_completed(
            application,
            PhotoService.STEP,
        )

        return MerchantApplicationPhotos.objects.filter(
            MAPP_ID=application
        ).order_by("MPHT_ID")

    @staticmethod
    def _validate_final_photo_counts(
        application,
        photos_to_delete,
        new_photos,
    ):
        """Ensure the resulting photo state respects category limits."""

        existing_counts = {
            category: MerchantApplicationPhotos.objects.filter(
                MAPP_ID=application,
                MPHT_CATEGORY=category,
            ).count()
            for category in PhotoService.PHOTO_LIMITS
        }

        deleted_counts = {
            category: 0
            for category in PhotoService.PHOTO_LIMITS
        }

        for photo in photos_to_delete:
            deleted_counts[photo.MPHT_CATEGORY] += 1

        for category, limit in PhotoService.PHOTO_LIMITS.items():
            final_count = (
                existing_counts[category]
                - deleted_counts[category]
                + len(new_photos[category])
            )

            if final_count > limit:
                raise ValueError(
                    f"You can only have up to {limit} "
                    f"{category} photos."
                )

    @staticmethod
    def get_photo_for_application(application, photo_id):
        return get_object_or_404(
            MerchantApplicationPhotos,
            MPHT_ID=photo_id,
            MAPP_ID=application,
        )

   